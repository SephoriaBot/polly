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
//
// Spawn model: at most one active quest exists at a time, enforced by a
// DB constraint (quests_one_active_per_user) as well as in application
// logic. Each calendar day rolls once — via maybeSpawnQuest, called from
// QuestBoard.tsx on mount, the single place that triggers spawning — for
// whether a new quest appears at all; there's no guaranteed daily/weekly
// quest anymore. A quest that isn't claimed by the end of the day it
// spawned on simply disappears (expires) with no carryover; the next
// quest, if any, comes from a fresh roll on a later day.
import { supabase } from './supabase';
import { publishToast } from './toastBus';
import { publishQuestChanged } from './questBus';
import { HABITAT_ITEMS } from './habitatItems';

const SPECIES = ['wereham', 'noodle', 'dragon', 'bunt', 'wrendel'] as const;
type Species = (typeof SPECIES)[number];

// How long a hatching egg takes to be ready. Tune as you like.
const EGG_HATCH_HOURS = 24;

// Chance, on any given day, that a quest spawns at all — only rolled when
// no quest is currently active. Tune as you like.
const DAILY_SPAWN_CHANCE = 0.4;

type RewardType = 'cosmetic' | 'egg' | 'points' | 'shelf_item';

// Relative odds each reward type is picked. Equal by default — tune as
// you like (e.g. lower egg/shelf_item if they should feel rarer).
const REWARD_WEIGHTS: Record<RewardType, number> = {
  cosmetic: 1,
  egg: 1,
  points: 1,
  shelf_item: 1,
};

// Bank-point reward scaling. Chore "difficulty" is estimated_minutes off
// the chore itself; action-quest difficulty comes from the
// quest_templates.difficulty column (a small int you set per template,
// e.g. 1-5). Clamped so no single quest is worth an absurd number of
// points. Tune all four as you like.
const CHORE_POINTS_PER_MINUTE = 2;
const ACTION_POINTS_PER_DIFFICULTY = 15;
const MIN_POINTS_REWARD = 10;
const MAX_POINTS_REWARD = 150;

function pointsForDifficulty(sourceType: 'chore' | 'action', difficulty: number): number {
  const raw =
    sourceType === 'chore'
      ? difficulty * CHORE_POINTS_PER_MINUTE
      : difficulty * ACTION_POINTS_PER_DIFFICULTY;
  return Math.max(MIN_POINTS_REWARD, Math.min(MAX_POINTS_REWARD, Math.round(raw)));
}

function pickWeightedRewardType(weights: Record<RewardType, number>): RewardType {
  const entries = Object.entries(weights) as [RewardType, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// 1. CANDIDATE POOL — every chore and every active action template is a
//    possible quest. One is drawn at random when a quest spawns (see
//    maybeSpawnQuest below), rather than each chore/template guaranteeing
//    its own quest on a fixed schedule.
// ---------------------------------------------------------------------------

interface QuestCandidate {
  source_type: 'chore' | 'action';
  chore_id?: string;
  template_id?: string;
  title: string;
  difficulty: number;
}

async function getCandidatePool(userId: string): Promise<QuestCandidate[]> {
  const [{ data: chores, error: choresErr }, { data: templates, error: templatesErr }] =
    await Promise.all([
      supabase.from('chores').select('id, name, estimated_minutes').eq('user_id', userId),
      supabase.from('quest_templates').select('id, title, difficulty').eq('active', true),
    ]);

  if (choresErr) console.error('getCandidatePool: failed to load chores', choresErr);
  if (templatesErr) console.error('getCandidatePool: failed to load templates', templatesErr);

  const choreCandidates: QuestCandidate[] = (chores ?? []).map((c) => ({
    source_type: 'chore' as const,
    chore_id: c.id,
    title: c.name,
    difficulty: c.estimated_minutes ?? 15,
  }));

  const actionCandidates: QuestCandidate[] = (templates ?? []).map((t) => ({
    source_type: 'action' as const,
    template_id: t.id,
    title: t.title,
    difficulty: t.difficulty ?? 1,
  }));

  return [...choreCandidates, ...actionCandidates];
}

// ---------------------------------------------------------------------------
// 2. REWARD ROLL — one reward, of one of four types, per spawned quest.
// ---------------------------------------------------------------------------

interface RewardRoll {
  reward_type: RewardType;
  reward_cosmetic_id: string | null;
  reward_points: number | null;
  reward_shelf_item_key: string | null;
}

async function rollReward(
  userId: string,
  sourceType: 'chore' | 'action',
  difficulty: number
): Promise<RewardRoll> {
  let type = pickWeightedRewardType(REWARD_WEIGHTS);

  if (type === 'shelf_item') {
    const { data: unlocked } = await supabase
      .from('habitat_unlocked_items')
      .select('item_key')
      .eq('user_id', userId);
    const owned = new Set((unlocked ?? []).map((r) => r.item_key));
    const available = HABITAT_ITEMS.filter((i) => !owned.has(i.key));

    if (available.length === 0) {
      // Every shelf item is already owned — fall back to points instead
      // of leaving the quest without a reward.
      type = 'points';
    } else {
      const picked = available[Math.floor(Math.random() * available.length)];
      return {
        reward_type: 'shelf_item',
        reward_cosmetic_id: null,
        reward_points: null,
        reward_shelf_item_key: picked.key,
      };
    }
  }

  if (type === 'points') {
    return {
      reward_type: 'points',
      reward_cosmetic_id: null,
      reward_points: pointsForDifficulty(sourceType, difficulty),
      reward_shelf_item_key: null,
    };
  }

  if (type === 'egg') {
    return {
      reward_type: 'egg',
      reward_cosmetic_id: null,
      reward_points: null,
      reward_shelf_item_key: null,
    };
  }

  // cosmetic
  const { data: cosmetics } = await supabase.from('cosmetics').select('id');
  const pool = cosmetics ?? [];
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    reward_type: 'cosmetic',
    reward_cosmetic_id: picked?.id ?? null,
    reward_points: null,
    reward_shelf_item_key: null,
  };
}

// ---------------------------------------------------------------------------
// 3. SPAWNING — call on app load (or on a timer). At most one active quest
//    at a time; each calendar day rolls once for whether a new one appears.
// ---------------------------------------------------------------------------

/**
 * Rolls today's spawn chance (once per calendar day) and, if it succeeds
 * and no quest is currently active, creates one from a random candidate.
 * A no-op if a quest is already active, or if today's roll already
 * happened (whether or not it succeeded).
 */
export async function maybeSpawnQuest(userId: string) {
  // limit(1) instead of maybeSingle(): if duplicate active quests ever
  // exist (e.g. from an old race before the DB-level unique constraint
  // below was added), this must not throw — it should just see "yes,
  // something's active" and stop, same as the single-quest case.
  const { data: activeQuests } = await supabase
    .from('quests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);

  if (activeQuests && activeQuests.length > 0) return; // one active quest at a time — nothing to do

  const today = todayDateKey();
  const { data: spawnState } = await supabase
    .from('quest_spawn_state')
    .select('last_roll_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (spawnState?.last_roll_date === today) return; // already rolled today

  // Record that today's roll happened regardless of outcome, so reopening
  // the app later today doesn't roll again.
  await supabase
    .from('quest_spawn_state')
    .upsert({ last_roll_date: today }, { onConflict: 'user_id' });

  if (Math.random() >= DAILY_SPAWN_CHANCE) return; // no quest today

  const pool = await getCandidatePool(userId);
  if (pool.length === 0) return;

  const candidate = pool[Math.floor(Math.random() * pool.length)];
  const reward = await rollReward(userId, candidate.source_type, candidate.difficulty);

  const { error: insertError } = await supabase.from('quests').insert({
    source_type: candidate.source_type,
    chore_id: candidate.chore_id ?? null,
    template_id: candidate.template_id ?? null,
    title: candidate.title,
    reward_type: reward.reward_type,
    reward_cosmetic_id: reward.reward_cosmetic_id,
    reward_points: reward.reward_points,
    reward_shelf_item_key: reward.reward_shelf_item_key,
    // Missed = gone: expires at the end of the day it spawned on, with
    // no carryover into tomorrow.
    expires_at: endOfTodayIso(),
  });

  // If this loses a race against another spawn call, the DB's
  // quests_one_active_per_user constraint rejects the insert here
  // rather than throwing — nothing was actually created, so skip the
  // "something changed" broadcast.
  if (insertError) {
    console.error('maybeSpawnQuest: insert failed', insertError);
    return;
  }

  publishQuestChanged();
}

/**
 * Called when a chore is marked done elsewhere in the app. Finds the
 * matching active quest (if any) and claims it automatically.
 */
export async function completeChoreQuest(userId: string, choreId: string) {
  const { data: quests } = await supabase
    .from('quests')
    .select('id')
    .eq('user_id', userId)
    .eq('chore_id', choreId)
    .eq('status', 'active')
    .limit(1);

  const quest = quests?.[0];
  if (!quest) return null;
  return claimQuest(userId, quest.id);
}

/**
 * Call this wherever the corresponding in-app event happens, e.g.:
 *   await triggerActionEvent(userId, 'battle_won')
 * after a battle resolves, or 'creature_purchased' after a Breeder purchase.
 * Only claims — it does NOT backfill a new quest. The next quest (if any)
 * only shows up via the next daily spawn roll, same as any other quest.
 */
export async function triggerActionEvent(userId: string, eventKey: string) {
  const { data: quests } = await supabase
    .from('quests')
    .select('id, quest_templates!inner(event_key)')
    .eq('user_id', userId)
    .eq('source_type', 'action')
    .eq('status', 'active')
    .eq('quest_templates.event_key', eventKey)
    .limit(1);

  const quest = quests?.[0];
  if (!quest) return null;
  return claimQuest(userId, quest.id);
}

// ---------------------------------------------------------------------------
// 4. CLAIM / REWARD FLOW
// ---------------------------------------------------------------------------

type ClaimResult =
  | { ok: true; reward: 'cosmetic'; cosmeticId: string }
  | { ok: true; reward: 'egg'; hatchAt: string }
  | { ok: true; reward: 'points'; points: number }
  | { ok: true; reward: 'shelf_item'; itemKey: string; itemLabel: string }
  | {
      ok: false;
      reason: 'egg_already_incubating' | 'not_found' | 'already_claimed';
    };

export async function claimQuest(
  userId: string,
  questId: string
): Promise<ClaimResult> {
  const { data: quest } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!quest) return { ok: false, reason: 'not_found' };
  if (quest.status !== 'active') {
    return { ok: false, reason: 'already_claimed' };
  }

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
    publishQuestChanged();
    return { ok: true, reward: 'egg', hatchAt };
  }

  if (quest.reward_type === 'points') {
    // Direct read-modify-write against bank_points, same pattern
    // useCreatureGrowth uses elsewhere. Note this doesn't push the new
    // total into any already-mounted useCreatureGrowth state — components
    // showing the bank balance pick it up on their own next fetch.
    const { data: bankRow } = await supabase.from('bank_points').select('points').maybeSingle();
    const current = Number(bankRow?.points) || 0;
    const rewardPoints = quest.reward_points ?? 0;
    const newPoints = current + rewardPoints;

    await supabase.from('bank_points').upsert({ points: newPoints }, { onConflict: 'user_id' });

    await supabase
      .from('quests')
      .update({ status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', questId);

    publishToast(`Quest complete: ${quest.title}! +${rewardPoints} points 💰`);
    publishQuestChanged();
    return { ok: true, reward: 'points', points: rewardPoints };
  }

  if (quest.reward_type === 'shelf_item') {
    await supabase
      .from('habitat_unlocked_items')
      .upsert({ item_key: quest.reward_shelf_item_key }, { onConflict: 'item_key' });

    await supabase
      .from('quests')
      .update({ status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', questId);

    const item = HABITAT_ITEMS.find((i) => i.key === quest.reward_shelf_item_key);
    publishToast(
      `Quest complete: ${quest.title}! You found ${item?.label ?? 'a new item'} for the shelf 🗄️`
    );
    publishQuestChanged();
    return {
      ok: true,
      reward: 'shelf_item',
      itemKey: quest.reward_shelf_item_key,
      itemLabel: item?.label ?? 'a new item',
    };
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
  publishQuestChanged();
  return { ok: true, reward: 'cosmetic', cosmeticId: quest.reward_cosmetic_id };
}

// ---------------------------------------------------------------------------
// 5. EGG COLLECTION — hatch a ready egg into a random new collection creature
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
// 6. MISSED QUESTS — expiry sweep + sad companion line
// ---------------------------------------------------------------------------

/**
 * Marks any active-but-overdue quests as expired. Call on app load, before
 * checking for a sad-companion message. With expires_at now always set to
 * end-of-day-spawned, this is what makes a missed quest disappear for
 * good rather than carrying over.
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