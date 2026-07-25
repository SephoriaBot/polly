// almanac.ts
// All astronomy here is computed locally with standard low-precision formulas
// (Meeus, "Astronomical Algorithms") — no API, nothing hallucinated, accurate
// to well under a degree for the moon's position, which is more than enough
// for picking a zodiac sign. Only the closing note text comes from Groq, and
// even that is instructed to invent nothing factual — it's just style.

const SYNODIC_MONTH = 29.53058867; // days, new moon to new moon
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14); // a reference new moon

function daysSince2000(date: Date): number {
  return (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0) - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
}

// --- Moon phase --------------------------------------------------------

export interface MoonPhase {
  phaseName: string;
  illuminationPct: number;
  ageDays: number;
  daysUntilFull: number;
  daysUntilNew: number;
}

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

export function getMoonPhase(date: Date): MoonPhase {
  const dayMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0);
  const age = (((dayMs - KNOWN_NEW_MOON_UTC) / 86400000) % SYNODIC_MONTH + SYNODIC_MONTH) % SYNODIC_MONTH;
  const illuminationPct = Math.round(((1 - Math.cos((age / SYNODIC_MONTH) * 2 * Math.PI)) / 2) * 100);
  const bin = Math.round((age / SYNODIC_MONTH) * 8) % 8;
  const halfMonth = SYNODIC_MONTH / 2;
  const daysUntilFull = age <= halfMonth ? halfMonth - age : SYNODIC_MONTH - age + halfMonth;
  const daysUntilNew = SYNODIC_MONTH - age;

  return {
    phaseName: PHASE_NAMES[bin],
    illuminationPct,
    ageDays: Math.round(age * 10) / 10,
    daysUntilFull: Math.round(daysUntilFull * 10) / 10,
    daysUntilNew: Math.round(daysUntilNew * 10) / 10,
  };
}

// --- Moon's zodiac position (for planting-by-the-signs) ----------------

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const ELEMENT_BY_SIGN: Record<string, "fire" | "earth" | "air" | "water"> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

// The old almanac / biodynamic convention: which part of the plant each
// element favors working on while the moon is passing through it.
const GARDEN_DAY_BY_ELEMENT: Record<string, string> = {
  earth: "Root Day",
  water: "Leaf Day",
  air: "Flower Day",
  fire: "Fruit & Seed Day",
};

const GARDEN_DAY_NOTE: Record<string, string> = {
  "Root Day": "favorable for planting or harvesting root crops, and for transplanting",
  "Leaf Day": "favorable for leafy greens and heavy watering — traditionally the most fruitful of the four",
  "Flower Day": "favorable for flowering plants and cutting blooms",
  "Fruit & Seed Day": "favorable for sowing seed and harvesting fruiting crops",
};

export interface MoonSign {
  sign: string;
  element: string;
  gardenDayType: string;
  gardenDayNote: string;
}

// Low-precision lunar longitude (Meeus ch. 47, truncated to the largest
// periodic terms) — good to roughly a third of a degree, which is far
// tighter than needed to place the moon in the correct 30° zodiac sign.
export function getMoonSign(date: Date): MoonSign {
  const d = daysSince2000(date);
  const T = d / 36525;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const norm = (deg: number) => ((deg % 360) + 360) % 360;

  const Lp = norm(218.3164477 + 481267.88123421 * T);
  const D = norm(297.8501921 + 445267.1114034 * T);
  const M = norm(357.5291092 + 35999.0502909 * T);
  const Mp = norm(134.9633964 + 477198.8675055 * T);

  let lambda =
    Lp +
    6.289 * Math.sin(toRad(Mp)) -
    1.274 * Math.sin(toRad(2 * D - Mp)) +
    0.658 * Math.sin(toRad(2 * D)) -
    0.186 * Math.sin(toRad(M)) -
    0.059 * Math.sin(toRad(2 * D - 2 * Mp)) -
    0.057 * Math.sin(toRad(2 * D - M - Mp)) +
    0.053 * Math.sin(toRad(2 * D + Mp)) +
    0.046 * Math.sin(toRad(2 * D - M)) +
    0.041 * Math.sin(toRad(Mp - M)) -
    0.035 * Math.sin(toRad(D)) -
    0.031 * Math.sin(toRad(Mp + M));

  lambda = norm(lambda);

  const signIndex = Math.floor(lambda / 30);
  const sign = ZODIAC_SIGNS[signIndex];
  const element = ELEMENT_BY_SIGN[sign];
  const gardenDayType = GARDEN_DAY_BY_ELEMENT[element];

  return { sign, element, gardenDayType, gardenDayNote: GARDEN_DAY_NOTE[gardenDayType] };
}

// --- Herb lore rotation --------------------------------------------------
// Traditional Western folk-herbalism entries — old-world associations, not
// modern wellness-trend framing. Rotates one per day, deterministically, so
// it's the same for everyone on a given date and repeats on a ~26-day cycle.

export const HERB_LORE: { name: string; lore: string }[] = [
  { name: "Yarrow", lore: "Long carried by travelers and soldiers for staunching wounds; old herbals called it 'nosebleed' for the same reason. Also gathered for divination on Midsummer's Eve." },
  { name: "Mugwort", lore: "Tucked under pillows by travelers to ward off fatigue, and burned in old smoke-cleansing bundles. Said to sharpen dreams when kept near the bed." },
  { name: "Rue", lore: "Called the 'herb of grace' in old England, once strewn in courtrooms and sickrooms alike. Considered protective, though handled with care — the sap can irritate skin in sunlight." },
  { name: "Vervain", lore: "Sacred to Druids and Romans alike, gathered at dawn without being seen by the sun. Woven into charms for safe travel." },
  { name: "Elderflower", lore: "The elder tree was thought to house a protective spirit; old custom held you should ask its permission before cutting any branch." },
  { name: "Chamomile", lore: "Called 'the plant's physician' by old gardeners, who believed it revived any sickly plant growing near it." },
  { name: "Lavender", lore: "Strewn on floors in place of rushes for its scent, and tucked into linens to keep moths away — a habit still worth keeping." },
  { name: "Calendula", lore: "Marigold petals were once dried and added to broths and stews through winter, both for color and for their keeping medicine." },
  { name: "Feverfew", lore: "Planted near the door in old cottage gardens, believed to purify the air around the home." },
  { name: "Comfrey", lore: "Old bonesetters swore by it, calling it 'knitbone' for its use in poultices for breaks and bruises." },
  { name: "Nettle", lore: "Scorned as a weed and prized as a tonic in the same breath — old country wisdom held that the first nettle soup of spring cleared the winter from the blood." },
  { name: "Dandelion", lore: "Every part was once put to use — root roasted for a bitter coffee, leaves for salad, flowers for wine. Nothing about it was ever truly a weed to the old cottage gardener." },
  { name: "Plantain", lore: "Called 'white man's foot' by some Indigenous peoples of North America, for how it sprang up wherever settlers walked. Long used as a poultice for stings and cuts." },
  { name: "Chickweed", lore: "One of the first greens up in late winter, gathered by cottagers as a sign the growing season was near." },
  { name: "Self-Heal", lore: "Its very name is its old reputation — a dooryard herb kept close at hand for cuts and small hurts." },
  { name: "Wormwood", lore: "Grown along garden borders in old cottage plots, believed to keep pests from wandering in among the vegetables." },
  { name: "Angelica", lore: "Said to bloom near Michaelmas and once thought to ward off plague; candied stalks were a treat in old English kitchens." },
  { name: "Valerian", lore: "Cats are drawn to it nearly as much as catnip — old apothecaries kept it under lock for its strong scent alone." },
  { name: "St. John's Wort", lore: "Traditionally gathered at midsummer, when its yellow flowers were thought to be at their most potent, and hung over doorways for protection." },
  { name: "Horehound", lore: "Boiled down into old-fashioned cough drops and candies long before the pharmacy took over the job." },
  { name: "Tansy", lore: "Once strewn among stored linens and grains as a natural moth and pest deterrent in the pantry." },
  { name: "Betony", lore: "An old saying held 'sell your coat and buy betony' — it was once considered a cure-all worth any price." },
  { name: "Sage", lore: "An old proverb asks, 'why should a man die while sage grows in his garden?' — it was long considered one of the great keeping herbs." },
  { name: "Rosemary", lore: "Planted by the garden gate in old custom, said to grow best where the woman of the house 'wore the britches.'" },
  { name: "Borage", lore: "Old herbals claimed it 'driveth away sorrow' when steeped into wine — a cottage-garden staple for both bees and spirits." },
  { name: "Thyme", lore: "A bed of wild thyme was once thought to be a favorite resting place of fairies, best left a little untidy." },
];

export function getHerbOfDay(date: Date): { name: string; lore: string } {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000
  );
  return HERB_LORE[dayOfYear % HERB_LORE.length];
}

// --- Real holiday check (optional, factual, free/no-key) -----------------

export async function fetchTodaysHolidayUS(date: Date): Promise<string | null> {
  try {
    const year = date.getUTCFullYear();
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);
    if (!res.ok) return null;
    const holidays: { date: string; localName: string }[] = await res.json();
    const iso = date.toISOString().slice(0, 10);
    const match = holidays.find((h) => h.date === iso);
    return match ? match.localName : null;
  } catch {
    return null;
  }
}

// --- Groq-generated closing note -----------------------------------------
// The model is given every fact already computed above and explicitly told
// not to invent new factual claims — it's only writing the connective,
// old-almanac-voiced prose around facts that are already correct.

export function buildAlmanacPrompt(input: {
  dateLabel: string;
  moon: MoonPhase;
  moonSign: MoonSign;
  herb: { name: string; lore: string };
  holiday: string | null;
}): string {
  const { dateLabel, moon, moonSign, herb, holiday } = input;
  return `You are writing a single short entry in the style of an old-fashioned farmer's almanac — plainspoken, a little wry, rooted in old country/cottage tradition, never modern-wellness or corporate in tone.

Today is ${dateLabel}.
Moon: ${moon.phaseName}, ${moon.illuminationPct}% illuminated, in ${moonSign.sign} (${moonSign.gardenDayType} — ${moonSign.gardenDayNote}).
Herb of the day: ${herb.name} — ${herb.lore}
${holiday ? `Also notable: today is ${holiday}.` : ""}

Write 2-3 sentences that weave these facts together into one flowing almanac entry, in that old voice. Do NOT invent any new factual claims, dates, weather predictions, or numbers beyond what's given above — only use the facts provided. Respond with ONLY the entry text, no preamble, no quotation marks, no markdown.`;
}

export async function generateAlmanacNote(prompt: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 220,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}