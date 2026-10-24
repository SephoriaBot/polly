/// <reference types="node" />
// api/daily-push.ts
//
// Runs from Vercel Cron (see vercel.json) and sends ONE push per person,
// only when something happened today:
//   - a chore came due today
//   - a quest spawned (the daily quest roll now happens here for anyone
//     with notifications on, so the quest exists before you open Polly)
//   - you have an appointment today
// If none of those is true, nothing is sent.
//
// Two cron entries (10:00 and 11:00 UTC) cover daylight saving; the code
// only does its work when it is 6am Eastern.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HABITAT_ITEMS } from '../src/lib/habitatItems.js';

const TZ = 'America/New_York';
const SEND_HOUR = 6;

// Keep these in step with src/lib/questSystem.ts
const DAILY_SPAWN_CHANCE = 0.4;
const CHORE_POINTS_PER_MINUTE = 2;
const ACTION_POINTS_PER_DIFFICULTY = 15;
const MIN_POINTS_REWARD = 10;
const MAX_POINTS_REWARD = 150;
const REWARD_TYPES = ['cosmetic', 'egg', 'points', 'shelf_item'] as const;
type RewardType = (typeof REWARD_TYPES)[number];

// ---------- time helpers (all in Eastern time) ----------

function tzParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: get('hour'),
    min: get('minute'),
    s: get('second'),
  };
}

function dateKey(d: Date): string {
  const p = tzParts(d);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function endOfTodayIso(todayKey: string): string {
  const [y, m, d] = todayKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  const p = tzParts(new Date(guess));
  const asIfUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  const offset = asIfUtc - Math.floor(guess / 1000) * 1000;
  return new Date(guess - offset).toISOString();
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// ---------- quest spawning (mirrors src/lib/questSystem.ts) ----------

function pointsFor(sourceType: 'chore' | 'action', difficulty: number): number {
  const raw =
    sourceType === 'chore'
      ? difficulty * CHORE_POINTS_PER_MINUTE
      : difficulty * ACTION_POINTS_PER_DIFFICULTY;
  return Math.max(MIN_POINTS_REWARD, Math.min(MAX_POINTS_REWARD, Math.round(raw)));
}

async function rollReward(
  db: SupabaseClient,
  userId: string,
  sourceType: 'chore' | 'action',
  difficulty: number,
) {
  let type: RewardType = REWARD_TYPES[Math.floor(Math.random() * REWARD_TYPES.length)];
  const base = {
    reward_type: type as RewardType,
    reward_cosmetic_id: null as string | null,
    reward_points: null as number | null,
    reward_shelf_item_key: null as string | null,
  };

  if (type === 'shelf_item') {
    const { data: unlocked } = await db
      .from('habitat_unlocked_items')
      .select('item_key')
      .eq('user_id', userId);
    const owned = new Set((unlocked ?? []).map((r) => r.item_key));
    const available = HABITAT_ITEMS.filter((i) => !owned.has(i.key));
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)];
      return { ...base, reward_type: 'shelf_item' as RewardType, reward_shelf_item_key: picked.key };
    }
    type = 'points';
  }

  if (type === 'points') {
    return { ...base, reward_type: 'points' as RewardType, reward_points: pointsFor(sourceType, difficulty) };
  }

  if (type === 'egg') {
    return { ...base, reward_type: 'egg' as RewardType };
  }

  const [{ data: cosmetics }, { data: ownedRows }] = await Promise.all([
    db.from('cosmetics').select('id'),
    db.from('user_cosmetics').select('cosmetic_id').eq('user_id', userId),
  ]);
  const ownedIds = new Set((ownedRows ?? []).map((r) => r.cosmetic_id));
  const pool = (cosmetics ?? []).filter((c) => !ownedIds.has(c.id));
  if (pool.length === 0) {
    return { ...base, reward_type: 'points' as RewardType, reward_points: pointsFor(sourceType, difficulty) };
  }
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return { ...base, reward_type: 'cosmetic' as RewardType, reward_cosmetic_id: picked.id as string };
}

// Returns the new quest's title if one spawned, otherwise null.
async function maybeSpawnQuest(db: SupabaseClient, userId: string, today: string): Promise<string | null> {
  const { data: active } = await db
    .from('quests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  if (active && active.length > 0) return null;

  const { data: spawnState } = await db
    .from('quest_spawn_state')
    .select('last_roll_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (spawnState?.last_roll_date === today) return null;

  await db
    .from('quest_spawn_state')
    .upsert({ user_id: userId, last_roll_date: today }, { onConflict: 'user_id' });

  if (Math.random() >= DAILY_SPAWN_CHANCE) return null;

  const [{ data: chores }, { data: templates }] = await Promise.all([
    db.from('chores').select('id, name, estimated_minutes').eq('user_id', userId),
    db.from('quest_templates').select('id, title, difficulty').eq('active', true),
  ]);

  const pool = [
    ...(chores ?? []).map((c) => ({
      source_type: 'chore' as const,
      chore_id: c.id as string,
      template_id: null as string | null,
      title: c.name as string,
      difficulty: (c.estimated_minutes ?? 15) as number,
    })),
    ...(templates ?? []).map((t) => ({
      source_type: 'action' as const,
      chore_id: null as string | null,
      template_id: t.id as string,
      title: t.title as string,
      difficulty: (t.difficulty ?? 1) as number,
    })),
  ];
  if (pool.length === 0) return null;

  const candidate = pool[Math.floor(Math.random() * pool.length)];
  const reward = await rollReward(db, userId, candidate.source_type, candidate.difficulty);

  const { error } = await db.from('quests').insert({
    user_id: userId,
    source_type: candidate.source_type,
    chore_id: candidate.chore_id,
    template_id: candidate.template_id,
    title: candidate.title,
    ...reward,
    expires_at: endOfTodayIso(today),
  });
  if (error) {
    console.error('daily-push: quest insert failed', error);
    return null;
  }
  return candidate.title;
}

// ---------- chores due today / appointments today ----------

async function choresDueToday(db: SupabaseClient, userId: string, today: string): Promise<string[]> {
  const { data } = await db
    .from('chores')
    .select('name, interval_days, last_done_at')
    .eq('user_id', userId);
  const todayNum = dayNumber(today);
  const due: string[] = [];
  for (const c of data ?? []) {
    if (!c.last_done_at) continue;
    const since = todayNum - dayNumber(dateKey(new Date(c.last_done_at)));
    if (c.interval_days - since === 0) due.push(c.name);
  }
  return due;
}

async function appointmentsToday(db: SupabaseClient, userId: string, today: string): Promise<string[]> {
  const from = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
  const { data } = await db
    .from('appointments')
    .select('title, date_time')
    .eq('user_id', userId)
    .gte('date_time', from)
    .lte('date_time', to)
    .order('date_time', { ascending: true });
  return (data ?? [])
    .filter((a) => dateKey(new Date(a.date_time)) === today)
    .map((a) => `${a.title} at ${timeLabel(a.date_time)}`);
}

// ---------- handler ----------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error('daily-push: missing environment variables');
    return res.status(500).json({ error: 'Not configured' });
  }

  // Only act at 6am Eastern (?force=1 skips this, for testing).
  const now = new Date();
  if (tzParts(now).h !== SEND_HOUR && req.query.force !== '1') {
    return res.status(200).json({ skipped: 'not send hour' });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = dateKey(now);

  const { data: subs, error: subsError } = await db
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth');
  if (subsError) {
    console.error('daily-push: could not load subscriptions', subsError);
    return res.status(500).json({ error: 'Could not load subscriptions' });
  }

  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  }

  let sent = 0;
  for (const [userId, userSubs] of byUser) {
    try {
      const lines: string[] = [];

      const quest = await maybeSpawnQuest(db, userId, today);
      if (quest) lines.push(`New quest: ${quest}`);

      const chores = await choresDueToday(db, userId, today);
      if (chores.length > 0) lines.push(`Chores due: ${chores.join(', ')}`);

      const appts = await appointmentsToday(db, userId, today);
      if (appts.length > 0) lines.push(`Today: ${appts.join('; ')}`);

      if (lines.length === 0) continue;

      const payload = JSON.stringify({ title: 'Polly', body: lines.join('\n'), tag: `polly-${today}`, url: '/' });
      for (const s of userSubs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from('push_subscriptions').delete().eq('id', s.id);
          } else {
            console.error('daily-push: send failed', status);
          }
        }
      }
    } catch (err) {
      console.error('daily-push: failed for a user', err);
    }
  }

  return res.status(200).json({ users: byUser.size, sent });
}
