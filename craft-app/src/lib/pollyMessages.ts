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

const POLLY_POPIN_MESSAGES_BY_PAGE: Partial<Record<string, string[]>> = {
  grocery: [
    "Get me one, too!",
    "Don't forget the good stuff.",
    "Smart cart, smart choices.",
    "What's for dinner?",
  ],
  dailyplanner: [
    "One thing at a time.",
    "Look at you, staying on top of it.",
    "Small steps count too.",
    "Don't forget anything!",
  ],
  wallet: [
    "Just peeking at the numbers.",
    "Looking good!",
    "Every little bit adds up.",
    "Budgets are just plans with math.",
  ],
  trackers: [
    "The data doesn't lie.",
    "Look at that progress!",
    "Patterns are neat, huh?",
    "I didn't notice that before!",
  ],
  decisions: [
    "Tough call?",
    "Trust your gut.",
    "I believe in you.",
    "Weighing your options, I see.",
  ],
  habitat: [
    "The hamsters say hi.",
    "Someone's been busy decorating.",
    "Squeak squeak!",
    "Don't forget your daily visit.",
  ],
};

const POLLY_POPIN_MOODS: PollyMood[] = ['neutral', 'cheering'];

export function getPollyPopIn(page?: string): { mood: PollyMood; message: string } {
  const pagePool = page ? POLLY_POPIN_MESSAGES_BY_PAGE[page] : undefined;
  const pool = pagePool && pagePool.length > 0 ? pagePool : POLLY_POPIN_MESSAGES;

  const mood =
    POLLY_POPIN_MOODS[Math.floor(Math.random() * POLLY_POPIN_MOODS.length)];
  const message = pool[Math.floor(Math.random() * pool.length)];
  return { mood, message };
}
