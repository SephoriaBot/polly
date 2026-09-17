// questSystem.ts
// Location: craft-app/src/lib/questSystem.ts
//
// Companion Quest System — core logic.
//
// userId is passed explicitly everywhere below (matches how Goals.tsx
// already does it via `const { user } = useAuth()`), rather than relying
// only on the RLS default the way Chores.tsx does — needed here because
// several functions read/write rows the RLS default alone can't target
// (e.g. checking polly_companion before granting an egg).
import { supabase } from './supabase';
import { publishToast } from './toastBus';

const SPECIES = ['wereham', 'noodle', 'dragon', 'bunt', 'wrendel'] as const;
type Species = (typeof SPECIES)[number];

// How long a hatching egg takes to be ready. Tune as you like.
const EGG_HATCH_HOURS = 24;

// Odds that an eligible quest hands out an egg instead of a cosmetic.
// Only applies to chore quests — action quests use whatever reward_type
// is set on their template.
const CHORE_EGG_CHANCE = 0.2;

// ---------------------------------------------------------------------------
// 1. CHORE QUESTS — generated from the user's recurring chores, capped so a
//    chore never produces a quest more often than it actually recurs.
// ---------------------------------------------------------------------------

/**
 * Call this on app load (or on a timer). For every chore belonging to the
 * user, checks whether it's time for a new quest — i.e. the most recent
 * chore-linked quest for that chore is at least `interval_days` old (or
 * doesn't exist yet) — and creates one if so.
 */
export async function generateChoreQuests(userId: string) {
  const { data: chores, error: choresErr } = await supabase
    .from('chores')
    .select('id, name, interval_days')
    .eq('user_id', userId);

  if (choresErr || !chores) {
    console.error('generateChoreQuests: failed to load chores', choresErr);
    return;
  }

  for (const chore of chores) {
    const { data: lastQuest } = await supabase
      .from('quests')
      .select('created_at')
      .eq('user_id', userId)
      .eq('chore_id', chore.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const intervalMs = chore.interval_days * 24 * 60 * 60 * 1000;
    const dueForNewQuest =
      !lastQuest ||
      Date.now() - new Date(lastQuest.created_at).getTime() >= intervalMs;

    if (!dueForNewQuest) continue;

    const reward = await pickReward(userId, CHORE_EGG_CHANCE);
    const expiresAt = new Date(Date.now() + intervalMs).toISOString();

    await supabase.from('quests').insert({
      source_type: 'chore',
      chore_id: chore.id,
      title: chore.name,
      reward_type: reward.reward_type,
      reward_cosmetic_id: reward.reward_cosmetic_id,
      expires_at: expiresAt,
    });
  }
}

/**
 * Called when a chore is marked done elsewhere in the app. Finds the
 * matching active quest (if any) and claims it automatically.
 */
export async function completeChoreQuest(userId: string, choreId: string) {
  const { data: quest } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('chore_id', choreId)
    .eq('status', 'active')
    .maybeSingle();

  if (!quest) return null;
  return claimQuest(userId, quest.id);
}

// ---------------------------------------------------------------------------
// 2. ACTION QUESTS — always-present quests pulled from the global
//    quest_templates pool (win a battle, buy a creature, etc.)
// ---------------------------------------------------------------------------

/**
 * Ensures every active quest_template has a corresponding active quest
 * instance for this user. Call on app load alongside generateChoreQuests.
 */
export async function ensureActionQuests(userId: string) {
  const { data: templates, error: templatesErr } = await supabase
    .from('quest_templates')
    .select('*')
    .eq('active', true);

  if (templatesErr || !templates) {
    console.error('ensureActionQuests: failed to load templates', templatesErr);
    return;
  }

  const { data: existing } = await supabase
    .from('quests')
    .select('template_id')
    .eq('user_id', userId)
    .eq('source_type', 'action')
    .eq('status', 'active');

  const activeTemplateIds = new Set((existing ?? []).map((q) => q.template_id));

  const missing = templates.filter((t) => !activeTemplateIds.has(t.id));
  if (missing.length === 0) return;

  await supabase.from('quests').insert(
    missing.map((t) => ({
      source_type: 'action' as const,
      template_id: t.id,
      title: t.title,
      reward_type: t.reward_type,
      reward_cosmetic_id: t.reward_cosmetic_id,
      // Action quests don't expire on their own — they persist until done.
      expires_at: null,
    })),
  );
}

/**
 * Call this wherever the corresponding in-app event happens, e.g.:
 *   await triggerActionEvent(userId, 'battle_won')
 * after a battle resolves, or 'creature_purchased' after a Breeder purchase.
 */
export async function triggerActionEvent(userId: string, eventKey: string) {
  const { data: quest } = await supabase
    .from('quests')
    .select('*, quest_templates!inner(event_key)')
    .eq('user_id', userId)
    .eq('source_type', 'action')
    .eq('status', 'active')
    .eq('quest_templates.event_key', eventKey)
    .maybeSingle();

  if (!quest) return null;

  const result = await claimQuest(userId, quest.id);
  // Action quests are always present — immediately backfill a fresh one.
  await ensureActionQuests(userId);
  return result;
}

// ---------------------------------------------------------------------------
// 3. CLAIM / REWARD FLOW — shared by chore and action quests
// ---------------------------------------------------------------------------

type ClaimResult =
  | { ok: true; reward: 'cosmetic'; cosmeticId: string }
  | { ok: true; reward: 'egg'; hatchAt: string }
  | { ok: false; reason: 'egg_already_incubating' | 'not_found' | 'already_claimed' };

export async function claimQuest(userId: string, questId: string): Promise<ClaimResult> {
  const { data: quest } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!quest) return { ok: false, reason: 'not_found' };
  if (quest.status !== 'active') return { ok: false, reason: 'already_claimed' };

  if (quest.reward_type === 'egg') {
    const { data: companion } = await supabase
      .from('polly_companion')
      .select('active_egg_hatch_at')
      .eq('user_id', userId)
      .single();

    if (companion?.active_egg_hatch_at) {
      // Only one egg at a time — leave the quest active so it can be
      // claimed once the current egg is collected.
      return { ok: false, reason: 'egg_already_incubating' };
    }

    const hatchAt = new Date(Date.now() + EGG_HATCH_HOURS * 60 * 60 * 1000).toISOString();
    await supabase
      .from('polly_companion')
      .update({
        active_egg_acquired_at: new Date().toISOString(),
        active_egg_hatch_at: hatchAt,
      })
      .eq('user_id', userId);

    await supabase
      .from('quests')
      .update({ status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', questId);

    publishToast(`Quest complete: ${quest.title}! An egg is in the Incubator 🥚`);
    return { ok: true, reward: 'egg', hatchAt };
  }

  // Cosmetic reward
  await supabase
    .from('user_cosmetics')
    .upsert(
      { cosmetic_id: quest.reward_cosmetic_id, user_id: userId },
      { onConflict: 'user_id,cosmetic_id', ignoreDuplicates: true },
    );

  await supabase
    .from('quests')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', questId);

  const { data: cosmetic } = await supabase
    .from('cosmetics')
    .select('name')
    .eq('id', quest.reward_cosmetic_id)
    .maybeSingle();

  publishToast(`Quest complete: ${quest.title}! You won ${cosmetic?.name ?? 'a new cosmetic'} 🎀`);
  return { ok: true, reward: 'cosmetic', cosmeticId: quest.reward_cosmetic_id };
}

async function pickReward(userId: string, eggChance: number) {
  if (Math.random() < eggChance) {
    return { reward_type: 'egg' as const, reward_cosmetic_id: null };
  }

  const { data: cosmetics } = await supabase.from('cosmetics').select('id');
  const pool = cosmetics ?? [];
  const picked = pool[Math.floor(Math.random() * pool.length)];

  return { reward_type: 'cosmetic' as const, reward_cosmetic_id: picked?.id ?? null };
}

// ---------------------------------------------------------------------------
// 4. EGG COLLECTION — hatch a ready egg into a random new collection creature
// ---------------------------------------------------------------------------

export async function collectEgg(userId: string) {
  const { data: companion } = await supabase
    .from('polly_companion')
    .select('active_egg_hatch_at')
    .eq('user_id', userId)
    .single();

  if (!companion?.active_egg_hatch_at) return { ok: false as const, reason: 'no_egg' as const };

  if (new Date(companion.active_egg_hatch_at) > new Date()) {
    return { ok: false as const, reason: 'not_ready' as const };
  }

  const species: Species = SPECIES[Math.floor(Math.random() * SPECIES.length)];

  const { data: newCreature, error } = await supabase
    .from('hamster_collection')
    .insert({
      hamster_id: crypto.randomUUID(),
      species,
      stage: 'baby',
      source: 'egg',
    })
    .select()
    .single();

  if (error) {
    console.error('collectEgg: failed to insert new creature', error);
    return { ok: false as const, reason: 'insert_failed' as const };
  }

  await supabase
    .from('polly_companion')
    .update({ active_egg_acquired_at: null, active_egg_hatch_at: null })
    .eq('user_id', userId);

  return { ok: true as const, creature: newCreature };
}

// ---------------------------------------------------------------------------
// 5. MISSED QUESTS — expiry sweep + sad companion line
// ---------------------------------------------------------------------------

/**
 * Marks any active-but-overdue quests as expired. Call on app load, before
 * checking for a sad-companion message.
 */
export async function expireOverdueQuests(userId: string) {
  const { data: expired } = await supabase
    .from('quests')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return expired?.length ?? 0;
}

const SAD_LINES = [
  "I had a few things I was hoping we'd get to today...",
  "Some of our quests slipped away unfinished. That's okay, there's always tomorrow.",
  "I was looking forward to those. Maybe next time?",
];

/**
 * Returns a sad line if quests expired since the last check, or null.
 * Doesn't distinguish accidental vs. intentional misses, per design.
 */
export async function getMissedQuestMessage(userId: string): Promise<string | null> {
  const missedCount = await expireOverdueQuests(userId);
  if (missedCount === 0) return null;
  return SAD_LINES[Math.floor(Math.random() * SAD_LINES.length)];
}

// ---------------------------------------------------------------------------
// 6. Convenience — call once on app load / dashboard mount
// ---------------------------------------------------------------------------

export async function refreshQuestBoard(userId: string) {
  const sadMessage = await getMissedQuestMessage(userId);
  await generateChoreQuests(userId);
  await ensureActionQuests(userId);

  const { data: quests } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  return { quests: quests ?? [], sadMessage };
}