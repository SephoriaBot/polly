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

/* =========================================================
   RANDOM POP-INS
   Short, low-stakes lines for when Polly randomly shows up
   on whatever page you're already on.
   ========================================================= */

const POLLY_POPIN_MESSAGES: string[] = [
  "Just checking in!",
  "Boop.",
  "Still here if you need me.",
  "Hi again!",
  "Sneaking by...",
  "You're doing great.",
  "Carry on, just visiting.",
  "*waves*",
];

const POLLY_POPIN_MOODS: PollyMood[] = ['neutral', 'cheering'];

export function getPollyPopIn(): { mood: PollyMood; message: string } {
  const mood =
    POLLY_POPIN_MOODS[Math.floor(Math.random() * POLLY_POPIN_MOODS.length)];
  const message =
    POLLY_POPIN_MESSAGES[Math.floor(Math.random() * POLLY_POPIN_MESSAGES.length)];
  return { mood, message };
}
