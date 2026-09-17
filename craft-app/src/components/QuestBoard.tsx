// QuestBoard.tsx
// Location: craft-app/src/components/QuestBoard.tsx
//
// Shows the companion's currently active quest (one at a time) and
// shows the companion's sad line if anything expired unclaimed since the
// last visit. Quests themselves are claimed automatically wherever the
// underlying action happens (see lib/questSystem.ts) — this is a
// read-only board so the player knows what's pending and what they'll get.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import Polly from './Polly';
import PollyBubble from './PollyBubble';
import { getMissedQuestMessage } from '../lib/questSystem';

interface QuestRow {
  id: string;
  title: string;
  source_type: 'chore' | 'action';
  reward_type: 'cosmetic' | 'egg';
  reward_cosmetic_id: string | null;
  reward_name?: string;
}

export default function QuestBoard({ userId }: { userId: string }) {
  const [quest, setQuest] = useState<QuestRow | null>(null);
  const [sadMessage, setSadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const missed = await getMissedQuestMessage(userId);

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

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return null;

  return (
    <section className="quest-board">
      <div className="section-label">
        <Icon name="clipboard-list" size={18} /> Quests
      </div>

      {sadMessage && (
        <div className="quest-board__companion-line">
          <Polly size="tiny" mood="sad" animate={false} />
          <PollyBubble message={sadMessage} size="small" />
        </div>
      )}

      {!quest && (
        <p className="quest-board__empty">
          No quests right now — check back soon!
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

          <span className="quest-board__reward">
            <Icon
              name={quest.reward_type === 'egg' ? 'egg' : 'trophy'}
              size={16}
            />

            {quest.reward_type === 'egg'
              ? 'Egg'
              : quest.reward_name ?? 'Cosmetic'}
          </span>
        </div>
      )}
    </section>
  );
}