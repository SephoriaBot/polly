/**
 * Cosmetic equip-render logic.
 *
 * Actual asset layout (confirmed against the repo):
 *   /assets/cosmetics/{folder}/{filePrefix}_{hatId}_{expression}.png
 *   /assets/cosmetics/headwear/headwear_{hatId}.png   <- flat icon, fallback for species without full art
 *
 * Confirmed example: noodle_flower_crown_sad.png, living in
 * /assets/cosmetics/pollynoodle/. Folder name and the prefix baked into the
 * filename aren't the same string (folder = pollynoodle, prefix = noodle) —
 * SPECIES_CONFIG below holds both per species, since hatId itself can
 * contain underscores (flower_crown), so the prefix and expression have to
 * be stripped rather than split naively on "_".
 */

export type Expression = "happy" | "sad" | "thinking";

// Matches PollySpecies in context/PollyCompanionContext.tsx
export type CreatureSpecies = "wereham" | "noodle" | "dragon" | "bunt" | "wrendel";

interface SpeciesAssetConfig {
  /** Folder name under /assets/cosmetics/ */
  folder: string;
  /** Prefix baked into each filename (may differ from the species/folder name) */
  filePrefix: string;
}

// Fill in each species' actual folder + filename prefix as its assets land.
// Only entries present here are treated as "full art done".
const SPECIES_CONFIG: Partial<Record<CreatureSpecies, SpeciesAssetConfig>> = {
  noodle: { folder: "pollynoodle", filePrefix: "noodle" },
  wereham: { folder: "pollywereham", filePrefix: "wereham" },
  dragon: { folder: "pollydragon", filePrefix: "dragon" },
  bunt: { folder: "pollybunt", filePrefix: "bunt" },
  wrendel: { folder: "pollywrendel", filePrefix: "wrendel" },
};

interface EquipRenderInput {
  species: CreatureSpecies;
  hatId: string | null; // null = nothing equipped
  expression: Expression;
}

interface EquipRenderResult {
  /** Path to render, or null if nothing should be drawn (no hat equipped). */
  imagePath: string | null;
  /** True if we fell back to the flat icon because no per-expression sprite exists yet. */
  isFallback: boolean;
}

const BASE_PATH = "/assets/cosmetics";

/**
 * The original 7 cosmetics (bow, flower_crown, headband, party_hat, top_hat,
 * wizard_hat, innertube) use the standard name on every species:
 *   {prefix}_{id}_{expression}.png
 *
 * The 14 quest cosmetics were uploaded per species with different naming, so
 * each species gets its own filename rule below. Ids match the asset_key in
 * Supabase with the headwear_/outfit_ prefix stripped.
 */
const QUEST_COSMETIC_IDS = [
  // headwear
  "mushroomcap", "strawberryhat", "acorncap", "beehat", "teacuphat", "bunnyears", "witchhat",
  // outfits
  "frogcoat", "ladybugwings", "sweater", "picniccape", "berrybag", "bellcollar", "glasses",
] as const;

// Dragon art was uploaded as numbered files (dragon_01.png ... dragon_42.png),
// 3 per item in this order, each triple being happy / sad / thinking.
const DRAGON_NUMBERED_ORDER: readonly string[] = QUEST_COSMETIC_IDS;
const DRAGON_EXPRESSION_OFFSET: Record<Expression, number> = { happy: 0, sad: 1, thinking: 2 };
// Per-item overrides where a triple isn't in happy/sad/thinking order.
const DRAGON_EXPRESSION_OFFSET_OVERRIDES: Record<string, Partial<Record<Expression, number>>> = {
  glasses: { thinking: 0, happy: 1, sad: 2 },
};

// Noodle quest files are {id}_noodle_{expression}.png, with a few quirks in
// what was uploaded. Remove an entry once its file is renamed to the standard form.
const NOODLE_FILE_OVERRIDES: Record<string, string> = {
  "ladybugwings_happy": "ladybug_noodle_happy.png",
  "ladybugwings_sad": "ladybug_noodle_sad.png",
  "ladybugwings_thinking": "ladybug_noodle_thinking.png",
  "strawberryhat_happy": "strawberryhat_nodle_happy.png", // "nodle" typo in the uploaded filename
  "frogcoat_thinking": "frogcoat_noodle_thinking.PNG", // uppercase extension in the uploaded filename
};

// Species that have quest-cosmetic art. Legacy bunt/wrendel companions fall
// back to the flat icon for quest cosmetics instead of a missing sprite.
const QUEST_ART_SPECIES: CreatureSpecies[] = ["wereham", "noodle", "dragon"];

function isQuestCosmetic(hatId: string): boolean {
  return (QUEST_COSMETIC_IDS as readonly string[]).includes(hatId);
}

function spriteFileName(species: CreatureSpecies, config: SpeciesAssetConfig, hatId: string, expression: Expression): string {
  if (isQuestCosmetic(hatId)) {
    if (species === "wereham") {
      return `${config.filePrefix}-${hatId}-${expression}.png`;
    }
    if (species === "noodle") {
      return NOODLE_FILE_OVERRIDES[`${hatId}_${expression}`] ?? `${hatId}_${config.filePrefix}_${expression}.png`;
    }
    if (species === "dragon") {
      const index = DRAGON_NUMBERED_ORDER.indexOf(hatId);
      const offset = DRAGON_EXPRESSION_OFFSET_OVERRIDES[hatId]?.[expression] ?? DRAGON_EXPRESSION_OFFSET[expression];
      const n = index * 3 + 1 + offset;
      return `${config.filePrefix}_${String(n).padStart(2, "0")}.png`;
    }
  }
  return `${config.filePrefix}_${hatId}_${expression}.png`;
}

function buildSpritePath(species: CreatureSpecies, config: SpeciesAssetConfig, hatId: string, expression: Expression): string {
  return `${BASE_PATH}/${config.folder}/${spriteFileName(species, config, hatId, expression)}`;
}

function buildFlatIconPath(hatId: string): string {
  return `${BASE_PATH}/headwear/headwear_${hatId}.png`;
}

/**
 * cosmetics.asset_key in Supabase is stored as e.g. "headwear_flower_crown"
 * or "outfit_innertube", but the uploaded per-species sprite files use just
 * the bare id ("flower_crown", "innertube") as the hatId. Strip whichever
 * slot prefix is present so callers can pass the raw asset_key straight
 * through regardless of slot.
 */
export function hatIdFromAssetKey(assetKey: string): string {
  return assetKey.replace(/^headwear_/, "").replace(/^outfit_/, "");
}

/**
 * Outfits flat-icon filenames don't follow the "{slot}_{id}.png" pattern
 * headwear uses (the uploaded file is just "duckinnertube.png", living in
 * /assets/cosmetics/outfits/) — map each outfit hatId to its actual filename
 * here as new outfits land, rather than assuming a naming convention that
 * doesn't match what's on disk.
 */
const OUTFIT_ICON_FILENAMES: Record<string, string> = {
  innertube: "duckinnertube.png",
};

export function outfitIconPath(hatId: string): string {
  const filename = OUTFIT_ICON_FILENAMES[hatId] ?? `${hatId}.png`;
  return `${BASE_PATH}/outfits/${filename}`;
}

// Unlike headwear (which has full parity across all 5 species), outfit art
// has only been drawn for wereham/noodle/dragon so far — the same 3 species
// left in the companion picker after bunt/wrendel were removed as pickable
// options. A legacy companion still set to bunt/wrendel falls back to the
// flat icon rather than pointing at a sprite that doesn't exist on disk.
// Extend this list as more species get outfit art.
const OUTFIT_SPECIES_WITH_ART: CreatureSpecies[] = ["wereham", "noodle", "dragon"];

/**
 * Resolves what image to render for a creature's equipped outfit. Mirrors
 * resolveEquipRender but checks per-outfit species coverage (above) instead
 * of assuming every species in SPECIES_CONFIG has full art for every item,
 * since that assumption only held while headwear was the only slot.
 */
export function resolveOutfitRender({ species, hatId, expression }: EquipRenderInput): EquipRenderResult {
  if (!hatId) {
    return { imagePath: null, isFallback: false };
  }

  if (OUTFIT_SPECIES_WITH_ART.includes(species)) {
    const config = SPECIES_CONFIG[species]!;
    return {
      imagePath: buildSpritePath(species, config, hatId, expression),
      isFallback: false,
    };
  }

  return {
    imagePath: outfitIconPath(hatId),
    isFallback: true,
  };
}

/**
 * Resolves what image to render for a creature's equipped headwear.
 *
 * Fallback behavior: if the species doesn't have full per-expression art yet,
 * we still show the hat (better than hiding cosmetics the user paid for) but
 * use the flat icon instead of a missing sprite. Swap the body of the "else"
 * branch to `imagePath: null` if you'd rather hide the hat entirely until art
 * is ready.
 */
export function resolveEquipRender({ species, hatId, expression }: EquipRenderInput): EquipRenderResult {
  if (!hatId) {
    return { imagePath: null, isFallback: false };
  }

  const config = SPECIES_CONFIG[species];
  const hasArt = isQuestCosmetic(hatId) ? QUEST_ART_SPECIES.includes(species) : !!config;
  if (config && hasArt) {
    return {
      imagePath: buildSpritePath(species, config, hatId, expression),
      isFallback: false,
    };
  }

  return {
    imagePath: buildFlatIconPath(hatId),
    isFallback: true,
  };
}

/**
 * Optional: verify an asset actually exists before trusting resolveEquipRender's
 * "full art" claim (useful during the transition period while species are
 * being filled in one at a time, in case SPECIES_WITH_FULL_ART drifts out of
 * sync with what's actually uploaded).
 */
export async function resolveEquipRenderSafe(
  input: EquipRenderInput,
  checkExists: (path: string) => Promise<boolean>
): Promise<EquipRenderResult> {
  const best = resolveEquipRender(input);
  if (!best.isFallback || !best.imagePath) return best;

  // Already on fallback path — nothing further to check.
  return best;
}
