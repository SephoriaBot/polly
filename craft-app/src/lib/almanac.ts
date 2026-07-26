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

// Maps the phase names produced by getMoonPhase() to the illustrated icon
// filenames in public/icons/ (moon-new.png, moon-waxing-crescent.png, etc).
// Shared so every page that shows a moon phase points at the same art.
export const MOON_ICON_BY_PHASE: Record<string, string> = {
  "New Moon": "moon-new",
  "Waxing Crescent": "moon-waxing-crescent",
  "First Quarter": "moon-first-quarter",
  "Waxing Gibbous": "moon-waxing-gibbous",
  "Full Moon": "moon-full",
  "Waning Gibbous": "moon-waning-gibbous",
  "Last Quarter": "moon-last-quarter",
  "Waning Crescent": "moon-waning-crescent",
};

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

export const ZODIAC_ICON_BY_SIGN: Record<string, IconName> = {
  Aries: "aries",
  Taurus: "taurus",
  Gemini: "gemini",
  Cancer: "cancer",
  Leo: "leo",
  Virgo: "virgo",
  Libra: "libra",
  Scorpio: "scorpio",
  Sagittarius: "sagittarius",
  Capricorn: "capricorn",
  Aquarius: "aquarius",
  Pisces: "pisces",
};

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
  { name: "Yarrow", lore: "Its Latin name, Achillea, comes from Achilles, who was said to use it to treat his soldiers' wounds. It was a standard part of field medicine kits well into the 19th century." },
  { name: "Mugwort", lore: "Related to wormwood, it grows as a common roadside weed across Europe and Asia. It's been burned as incense and used in folk medicine for centuries, and is a traditional ingredient in some East Asian foods and moxibustion therapy." },
  { name: "Rue", lore: "A bitter, blue-green shrub once grown in nearly every European herb garden. Its sap can cause skin irritation in sunlight (phytophotodermatitis), so it's handled with gloves even today." },
  { name: "Vervain", lore: "A tall, slender plant with small purple flowers, historically associated with Celtic and Roman ritual. It's still used in some herbal teas today, often blended with other calming herbs." },
  { name: "Elderflower", lore: "The small white flower clusters of the elder tree are used to make cordial, tea, and the French liqueur St-Germain. The berries need to be cooked before eating — raw elderberries can cause stomach upset." },
  { name: "Chamomile", lore: "One of the most common herbal teas worldwide. Gardeners have long claimed it helps neighboring plants recover from disease, though there's not strong scientific evidence for that specific effect." },
  { name: "Lavender", lore: "Native to the Mediterranean, its name likely comes from the Latin lavare, 'to wash' — it was commonly added to bathwater and laundry. Moths genuinely do avoid its scent, so it's still used as a natural repellent in closets." },
  { name: "Calendula", lore: "Also called pot marigold, its bright orange-yellow petals are edible and were historically used to color butter and cheese when saffron was too expensive." },
  { name: "Feverfew", lore: "A relative of the daisy, traditionally used to try to prevent migraines. Some modern studies suggest a modest effect, though results are mixed." },
  { name: "Comfrey", lore: "Its old nickname 'knitbone' comes from centuries of use in poultices for bruises and fractures. It contains compounds that are toxic if ingested in quantity, so modern use is topical only." },
  { name: "Nettle", lore: "The sting comes from tiny hollow hairs that inject formic acid on contact, but cooking or drying completely neutralizes it. Nettle soup is a genuine early-spring dish in several European culinary traditions." },
  { name: "Dandelion", lore: "Every part is edible — root, leaves, and flower. The root has been roasted and ground as a caffeine-free coffee substitute since at least the 19th century." },
  { name: "Plantain", lore: "Not related to the banana-like fruit of the same name — this is a low, broad-leafed lawn plant. It earned the nickname 'white man's foot' from Indigenous peoples in North America because it sprang up wherever European settlers traveled." },
  { name: "Chickweed", lore: "A small, fast-growing plant that's edible raw, often the first fresh green available after winter in temperate climates. It's mild and slightly grassy in flavor." },
  { name: "Self-Heal", lore: "A low-growing member of the mint family with small purple flowers, found on lawns worldwide. Its name reflects centuries of use as a wound-treatment herb." },
  { name: "Wormwood", lore: "Best known as the source of the compound thujone and a key flavoring in absinthe and vermouth (vermouth is even named after the German word for wormwood, Wermut)." },
  { name: "Angelica", lore: "A tall plant with large umbrella-shaped flower clusters. Its candied stalks were a popular decorative treat in old European baking, and it's still used to flavor gin and some liqueurs." },
  { name: "Valerian", lore: "Its root has a strong, distinctive smell that many cats respond to almost like catnip. It's a common ingredient in over-the-counter sleep aids, though clinical evidence for effectiveness is mixed." },
  { name: "St. John's Wort", lore: "Named for blooming around the feast of St. John the Baptist in late June. It's one of the more studied herbal supplements for mood support, but it interacts with many prescription medications, including birth control." },
  { name: "Horehound", lore: "A bitter mint-family plant long used to flavor cough drops and old-fashioned hard candy — horehound candy is still sold today, mostly as a nostalgia item." },
  { name: "Tansy", lore: "A yellow-flowered plant with a strong, camphor-like scent. It was historically used as an insect repellent in stored grain and linens, though it's toxic in large doses and rarely used internally today." },
  { name: "Betony", lore: "A member of the mint family once considered an all-purpose remedy in medieval Europe, prescribed for everything from headaches to nightmares." },
  { name: "Sage", lore: "Its genus name Salvia comes from the Latin salvere, 'to be saved' or 'to heal,' reflecting its long history as a medicinal herb as well as a culinary one." },
  { name: "Rosemary", lore: "Traditionally associated with memory — students in ancient Greece reportedly wore rosemary sprigs while studying for exams. Modern research has found some evidence its scent may modestly aid memory recall." },
  { name: "Borage", lore: "A fuzzy-leafed plant with star-shaped blue flowers and a mild cucumber flavor, often floated in drinks or added to salads. It's also a favorite of bees and other pollinators." },
  { name: "Thyme", lore: "One of the most widely used culinary herbs, native to the Mediterranean. Ancient Greeks burned it as incense, and its essential oil (thymol) is still used today as a natural antiseptic in some mouthwashes." },
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
  return `You are writing a short daily almanac entry. Plain, modern, conversational English — like a knowledgeable friend giving you the day's facts, NOT old-fashioned or archaic language (no "thee/thou," no faux-medieval phrasing, no invented quotes in old English).

Today is ${dateLabel}.
Moon: ${moon.phaseName}, ${moon.illuminationPct}% illuminated, in ${moonSign.sign} (${moonSign.gardenDayType} — ${moonSign.gardenDayNote}).
Herb of the day: ${herb.name} — ${herb.lore}
${holiday ? `Also notable: today is ${holiday}.` : ""}

Write 2-3 sentences that weave these facts together into one flowing entry, in plain modern voice. Do NOT invent any new factual claims, dates, weather predictions, or numbers beyond what's given above — only use the facts provided. Respond with ONLY the entry text, no preamble, no quotation marks, no markdown.`;
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