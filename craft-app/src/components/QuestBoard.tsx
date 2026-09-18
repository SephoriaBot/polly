// QuestBoard.tsx
// Location: craft-app/src/components/QuestBoard.tsx
//
// Shows the companion's currently active quest (at most one exists at a
// time — see lib/questSystem.ts) and the companion's sad line if anything
// expired unclaimed since the last visit. Quests spawn on their own
// schedule (a daily chance roll, not a guaranteed one), so it's normal
// for there to be no quest at all on a given day. Quests are claimed
// automatically wherever the underlying action happens — this is a
// read-only board so the player knows what's pending and what they'll get.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import Polly from './Polly';
import PollyBubble from './PollyBubble';
import { getMissedQuestMessage, maybeSpawnQuest } from '../lib/questSystem';
import { subscribeQuestBus } from '../lib/questBus';

interface QuestRow {
  id: string;
  title: string;
  source_type: 'chore' | 'action';
  reward_type: 'cosmetic' | 'egg' | 'points' | 'shelf_item';
  reward_cosmetic_id: string | null;
  reward_name?: string;
}

export default function QuestBoard({ userId }: { userId: string }) {
  const [quest, setQuest] = useState<QuestRow | null>(null);
  const [sadMessage, setSadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(opts: { spawnCheck: boolean }) {
      const missed = await getMissedQuestMessage(userId);
      // Rolls today's spawn chance (once per calendar day) and creates a
      // quest if the roll succeeds and nothing is currently active. Only
      // needed on mount — a quest-changed event from claiming doesn't
      // need its own spawn check, since maybeSpawnQuest already handles
      // "already rolled today" internally either way.
      if (opts.spawnCheck) await maybeSpawnQuest(userId);

      const { data } = await supabase
        .from('quests')
        .select(
          'id, title, source_type, reward_type, reward_cosmetic_id, cosmetics(name)'
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1);

      if (cancelled) return;

      const q = data?.[0];

      const row: QuestRow | null = q
        ? {
            id: q.id,
            title: q.title,
            source_type: q.source_type,
            reward_type: q.reward_type,
            reward_cosmetic_id: q.reward_cosmetic_id,
            reward_name: q.cosmetics?.name,
          }
        : null;

      setQuest(row);
      setSadMessage(missed);
      setLoading(false);
    }

    load({ spawnCheck: true });

    // Refetch whenever a quest is claimed or spawned anywhere in the
    // app — e.g. marking a chore done on a different page — so this
    // board never sits showing a quest that's already been completed.
    const unsubscribe = subscribeQuestBus(() => load({ spawnCheck: false }));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  if (loading) return null;

  return (
    <section className="quest-board card">
      <div className="section-label">
        <Icon name="clipboard-list" size={18} /> Quests
      </div>

      <p className="quest-board__descriptor">
        Your companion doesn't always have a quest ready — when one shows
        up, finish it before the day's out to claim your reward.
      </p>

      {sadMessage && (
        <div className="quest-board__companion-line">
          <Polly size="tiny" mood="sad" animate={false} />
          <PollyBubble message={sadMessage} size="small" />
        </div>
      )}

      {!quest && (
        <p className="quest-board__empty">
          No quest today — check back tomorrow!
        </p>
      )}

      {quest && (
        <div className="quest-board__row">
          <Icon
            name={
              quest.source_type === 'chore'
                ? 'washing-machine'
                : 'sparkle-single'
            }
            size={20}
          />

          <span className="quest-board__title">{quest.title}</span>

          <span className="quest-board__reward--mystery">
            <Icon name="help-circle" size={16} />
            ???
          </span>
        </div>
      )}
    </section>
  );
}