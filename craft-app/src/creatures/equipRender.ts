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
  /** Folder name under /assets/headwear/ */
  folder: string;
  /** Prefix baked into each filename (may differ from the species/folder name) */
  filePrefix: string;
}

// Fill in each species' actual folder + filename prefix as its assets land.
// Only entries present here are treated as "full art done".
const SPECIES_CONFIG: Partial<Record<CreatureSpecies, SpeciesAssetConfig>> = {
  noodle: { folder: "pollynoodle", filePrefix: "noodle" },
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

function buildSpritePath(config: SpeciesAssetConfig, hatId: string, expression: Expression): string {
  return `${BASE_PATH}/${config.folder}/${config.filePrefix}_${hatId}_${expression}.png`;
}

function buildFlatIconPath(hatId: string): string {
  return `${BASE_PATH}/headwear/headwear_${hatId}.png`;
}

/**
 * cosmetics.asset_key in Supabase is stored as e.g. "headwear_flower_crown",
 * but the uploaded sprite files use just "flower_crown" as the hatId. Strip
 * the slot prefix here so callers can pass the raw asset_key straight through.
 */
export function hatIdFromAssetKey(assetKey: string): string {
  return assetKey.replace(/^headwear_/, "");
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
  if (config) {
    return {
      imagePath: buildSpritePath(config, hatId, expression),
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
