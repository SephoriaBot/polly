// hamsters.ts
// The 20-hamster roster and the random "which one hatches" logic.
// Duplicates are allowed — fully random every time, per your call.

export interface Hamster {
  id: string;
  image: string; // path to /assets/hamsters/<id>.png
}

export const HAMSTERS: Hamster[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `hamster_${n}`, image: `/assets/hamsters/hamster_${n}.png` };
});

export function rollRandomHamster(): Hamster {
  return HAMSTERS[Math.floor(Math.random() * HAMSTERS.length)];
}
