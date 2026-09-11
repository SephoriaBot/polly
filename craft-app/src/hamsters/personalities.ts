// personalities.ts
// A pool of good traits and quirky "bad" traits, now shared across all
// three species (a dragon can be just as obsessed with sunbeams as a
// hamster). Each hatched creature gets 2 good traits + 1 quirk, rolled
// randomly and saved permanently with it.

import type { Species, EvolutionStage } from "./creatures";

export const GOOD_TRAITS: string[] = [
  "Loves a great nap",
  "Really appreciates a good listener",
  "Fiercely loyal to its favorite blanket",
  "Greets you by standing straight up",
  "Very sentimental",
  "Doesn't talk much but smiles often",
  "Thoughtful and considerate",
  "Hums while it eats",
  "Favorite activity is a good snuggle",
  "Always shares (eventually, reluctantly)",
  "Very brave about very small things",
  "Very neat and tidy",
  "Loves a good grooming session",
  "Curious about everything",
  "Puts everyone and everything before itself",
  "Loves all foods and eats 6 meals a day",
];

export const QUIRKY_TRAITS: string[] = [
  "Steals snacks the second you look away",
  "Dramatic about the tiniest inconveniences",
  "Hides everything in places it can return to later",
  "Judges your life choices silently",
  "Wakes up on the wrong side of the bed, always",
  "Suspicious of new things for at least a week",
  "Gives you the cold shoulder for no reason",
  "Will start a fight and then pretend it didn't",
  "Chronically overdramatic about baths",
  "Petty in general",
  "Naps through anything important",
  "Bites first, cuddles later",
];

export interface Personality {
  good: [string, string];
  quirk: string;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function rollPersonality(): Personality {
  const [g1, g2] = pickRandom(GOOD_TRAITS, 2);
  const [quirk] = pickRandom(QUIRKY_TRAITS, 1);
  return { good: [g1, g2], quirk };
}

// --- Combat abilities --------------------------------------------------
// Rolled when a creature evolves. Old traits/abilities are never removed —
// evolving only adds more on top. Teen abilities lean scrappy/defensive;
// final abilities lean bigger and more offensive, matching the jump in
// form size on the teen -> final art. Each species keeps the same cute-
// then-uncanny tone as the original hamster set.

// --- Hamster (original) -------------------------------------------------

export const HAMSTER_BABY_ABILITIES = [
  "Nibble — a curious, slightly sharp bite",
  "Wobble Charge — an unsteady but earnest rush",
  "Squeak Cry — a surprised little shriek",
  "Little Slap - a charged but very little slap",
];

export const HAMSTER_TEEN_ABILITIES: string[] = [
  "Bristle Charge — lowers a head that turns too far to rush a rival",
  "Cheek Pouch Slam — the impact sounds wetter than it should",
  "Burrow Dodge — vanishes underground; something else surfaces where it left",
  "Static Fur — a shock on contact, and for a second its shadow doesn't match it",
  "Piercing Squeak — a shriek pitched wrong, like it's coming from behind you",
  "Claw Flurry — a scratching combo too fast to count the hands",
  "Thorn Nibble — gnaws clean through an opponent's guard without slowing down",
  "Warning Stomp — tiny feet, a thud that comes from directly underneath you",
  "Sticky Paws — grapples and holds; it does not let go, does not tire, does not blink",
  "Adrenaline Sprint — a burst of speed, eyes gone fully black, smile a little too wide",
  "Hollow Stare — locks eyes and the rival simply forgets how to move",
  "Molt Shed — sheds fur that keeps twitching, keeps crawling, long after",
  "Second Mouth — a seam along the cheek opens where no mouth should be",
  "Wrong Number of Legs — for one frame there are more of them than there should be",
];

export const HAMSTER_FINAL_ABILITIES: string[] = [
  "Seed Cannon — launches hardened seeds hard enough to go clean through bark and bone",
  "Overgrowth Roots — vines erupt from beneath and drag a foe down into the dark",
  "Sonic Whisker Boom — a shockwave squeak that cracks stone and stops hearts for a beat",
  "Molten Cheek Pouch — the bite that follows smells like it shouldn't still be alive",
  "Guardian's Bulwark — hunkers down, and the ground around it stops obeying physics",
  "Frenzied Rampage — a relentless assault with too many limbs moving out of sync",
  "Venom Nibble — a bite that spreads numbness, then silence, then nothing at all",
  "Storm Caller — the sky answers something that isn't quite a hamster anymore",
  "Void Burrow — the tunnel it opens has no bottom, and something breathes up from it",
  "Apex Roar — a cry too big for something this small, in a voice that isn't its own",
  "Maw Beneath the Fur — the cheek pouches split open onto rows of teeth that don't fit",
  "Thousand-Eye Nest — every shadow in the room opens an eye and turns to watch",
  "Undying Gnaw — jaws lock on and keep working long after the rest of it stops moving",
  "Warren of the Lost — the burrow opens onto somewhere that was never the yard",
  "Skin It Wears — for a moment the fur is not fur, and it is not alone in there",
  "Nest of Small Hungers — a hundred tiny mouths answer from beneath the bedding",
];

// --- Noodle (cat-like) — agility/stealth themed -------------------------

export const NOODLE_BABY_ABILITIES: string[] = [
  "Paw Bat — a wobbly swat",
  "Pounce Practice — leaps a little too early and misses the landing",
  "Mew Startle — a tiny, surprised cry",
  "Zoomies — a burst of directionless speed",
];

export const NOODLE_TEEN_ABILITIES: string[] = [
  "Silent Pounce — clears the distance without a sound, and lands with all its weight",
  "Shadow Slip — slides between two shadows that shouldn't touch, and comes out of a third",
  "Claw Rake — three lines open before the strike is even seen landing",
  "Purr That Isn't — a low vibration that isn't coming from its chest anymore",
  "Nine Lives Feint — dodges a killing blow like it's done this exact moment before",
  "Tail Whip Cascade — one tail becomes several for exactly as long as it needs to",
  "Midnight Stare — pupils blown fully round, and the room gets a little colder",
  "Hairball Hex — coughs up something that was never fur to begin with",
  "Box Vanish — disappears into a space too small to hold it, then isn't there when you check",
  "Whisker Static — a crackle down each whisker that makes the air taste like metal",
  "Second Shadow — its shadow moves a half-second before it does",
  "Grin Without a Face — for a moment, only the smile is visible in the dark",
];

export const NOODLE_FINAL_ABILITIES: string[] = [
  "Void Pounce — leaps through where the rival was standing and it simply stops being there",
  "Nine Lives Unbound — dies mid-strike and finishes the attack anyway",
  "Cheshire Fracture — its body arrives in pieces, grinning, before it reassembles",
  "Moonless Prowl — the shadows it walks through stop casting light back out",
  "Purr of the Deep — a vibration low enough to loosen teeth from the inside",
  "Claws That Remember — rakes a wound that was already there before the fight started",
  "The Cat That Watches Twice — one set of eyes on the rival, one set somewhere behind you",
  "Ninth Life Reckoning — every dodge it's ever made comes due at once, in the rival's favor",
  "Unraveling Yarn — pulls a single thread and the opponent's outline starts to fray with it",
  "Sphinx's Riddle — asks a question mid-battle that the rival can't stop trying to answer",
  "Midnight Feast — a hunger with too many teeth, wearing a housecat's shape",
  "Grimalkin's Bargain — offers a trade neither side remembers agreeing to, and wins it anyway",
  "Hollow Meow — a cry pitched for something that isn't in the room yet",
  "Nine Shadows, One Cat — for a moment there are nine of it, and only one was ever real",
  "The Cat Door to Nowhere — opens a flap in the air itself and something reaches through",
  "Curled Up Inside You — the warmth you feel settling in is not comfort",
];

// --- Dragon — fire/flight themed ----------------------------------------

export const DRAGON_BABY_ABILITIES: string[] = [
  "Spark Puff — a tiny cough of smoke, more sizzle than flame",
  "Wing Flap — an uncoordinated hop-glide that barely clears the ground",
  "Tail Thump — an enthusiastic but clumsy swipe",
  "Roar Practice — a squeak trying very hard to be a roar",
];

export const DRAGON_TEEN_ABILITIES: string[] = [
  "Cinder Breath — a jet of sparks that leaves the air shimmering long after",
  "Talon Dive — drops from higher than it should be able to reach, and hits harder for it",
  "Smoke Veil — exhales a cloud that swallows the light around it, not just the view",
  "Wing Buffet — a gust that carries grit, ash, and something that isn't either",
  "Molten Hide — its scales glow, and touching them costs more than it should",
  "Hoard Instinct — snatches anything shiny mid-fight, armor included",
  "Ember Trail — leaves embers behind that keep burning long after it's moved on",
  "Serpent Coil — wraps tight enough that the air stops moving, then the light does too",
  "Cracked Roar — a roar with a second voice underneath it, older and lower",
  "Ash Molt — sheds a layer of scale that keeps smoldering on the ground",
  "Furnace Eye — one eye glows brighter, and whatever it looks at starts to smoke",
  "Broken Wingbeat — a downdraft timed wrong on purpose, so the impact lands twice",
];

export const DRAGON_FINAL_ABILITIES: string[] = [
  "Inferno Maw — a breath hot enough to turn armor to slag mid-swing",
  "Skyfall Talon — a dive from altitude that opens the ground on landing",
  "Obsidian Hide — scales gone black and glassy, and the heat radiating off them isn't natural anymore",
  "Hoard's Wrath — every stolen glint it's ever swallowed erupts out at once",
  "Ashfall Wingstorm — beats its wings until the sky itself starts raining cinders",
  "Voice of the Old Flame — a roar that predates the word for dragon",
  "Molten Undertow — the ground beneath the rival goes liquid and pulls them down slow",
  "Second Sun — for one instant, the whole battlefield is lit like it's noon, and it burns like it too",
  "Coil of Smoke and Bone — wraps a form that's half solid, half something the fire left behind",
  "The Hoard Remembers — the treasure it's eaten over centuries answers back, all at once",
  "Cinder Wake — leaves nothing behind it but ash shaped like whatever it destroyed",
  "Furnace Heart Exposed — a crack in its chest opens onto something still burning after all this time",
  "Wyrm Beneath the Scale — for a moment the dragon shape is just what it's wearing",
  "Undying Ember — reduced to nothing but a coal, and the coal keeps fighting",
  "Sky Given Teeth — the clouds above the fight grow a mouth and answer its call",
  "Last Hoard of the First Fire — every ability it has ever used lands again, all together, once",
];

// --- Species-aware lookups ------------------------------------------------

export const BABY_ABILITIES_BY_SPECIES: Record<Species, string[]> = {
  hamster: HAMSTER_BABY_ABILITIES,
  noodle: NOODLE_BABY_ABILITIES,
  dragon: DRAGON_BABY_ABILITIES,
};

export const TEEN_ABILITIES_BY_SPECIES: Record<Species, string[]> = {
  hamster: HAMSTER_TEEN_ABILITIES,
  noodle: NOODLE_TEEN_ABILITIES,
  dragon: DRAGON_TEEN_ABILITIES,
};

export const FINAL_ABILITIES_BY_SPECIES: Record<Species, string[]> = {
  hamster: HAMSTER_FINAL_ABILITIES,
  noodle: NOODLE_FINAL_ABILITIES,
  dragon: DRAGON_FINAL_ABILITIES,
};

export function abilityPoolFor(species: Species, stage: EvolutionStage): string[] {
  if (stage === "final") return FINAL_ABILITIES_BY_SPECIES[species];
  if (stage === "teen") return TEEN_ABILITIES_BY_SPECIES[species];
  return BABY_ABILITIES_BY_SPECIES[species];
}

// Backward-compatible aliases — old call sites that imported the
// hamster-only names keep working unchanged (they just mean "hamster").
export const BABY_ABILITIES = HAMSTER_BABY_ABILITIES;
export const TEEN_ABILITIES = HAMSTER_TEEN_ABILITIES;
export const FINAL_ABILITIES = HAMSTER_FINAL_ABILITIES;

export function rollAbilities(pool: string[], count: number, exclude: string[] = []): string[] {
  const available = pool.filter((a) => !exclude.includes(a));
  return pickRandom(available, Math.min(count, available.length));
}
