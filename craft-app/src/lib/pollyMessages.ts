import type { PollyMood } from '../components/Polly';

const POLLY_MESSAGES: Partial<Record<PollyMood, string[]>> = {
  neutral: [
    "Ready when you are.",
    "Let's see what's on the schedule today.",
    "Howdy!",
    "What's first?",
    "How are you?",
  ],
  yawning: [
    "Take it easy today.",
    "No rush.",
    "One thing at a time is plenty.",
    "Lets just cancel it today.",
  ],
};

export function getPollyMessage(mood: PollyMood): string | null {
  const pool = POLLY_MESSAGES[mood];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
