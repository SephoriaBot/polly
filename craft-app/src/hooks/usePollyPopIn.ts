import { useEffect, useRef, useState } from 'react';
import type { PollyMood } from '../components/Polly';
import { getPollyPopIn } from '../lib/pollyMessages';

/*
 * Tuning knobs:
 * - APPEAR_CHANCE: odds Polly shows up at all on a given page visit
 * - MIN_DELAY / MAX_DELAY: how long after landing on the page before he appears
 * - VISIBLE_DURATION: how long the bubble stays up before fading back out
 *
 * Nothing here is persisted — it re-rolls fresh every time `page` changes,
 * so it never settles into a predictable pattern per page or per session.
 */
const APPEAR_CHANCE = 0.35;
const MIN_DELAY = 1000;
const MAX_DELAY = 3000;
const VISIBLE_DURATION = 6000;

export function usePollyPopIn(page: string) {
  const [visible, setVisible] = useState(false);
  const [mood, setMood] = useState<PollyMood>('neutral');
  const [message, setMessage] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // fresh roll every time the page changes
    setVisible(false);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (Math.random() > APPEAR_CHANCE) return;

    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

    const showTimer = window.setTimeout(() => {
      const { mood: rolledMood, message: rolledMessage } = getPollyPopIn();
      setMood(rolledMood);
      setMessage(rolledMessage);
      setVisible(true);

      const hideTimer = window.setTimeout(() => {
        setVisible(false);
      }, VISIBLE_DURATION);
      timers.current.push(hideTimer);
    }, delay);

    timers.current.push(showTimer);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [page]);

  function dismiss() {
    setVisible(false);
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  return { visible, mood, message, dismiss };
}
