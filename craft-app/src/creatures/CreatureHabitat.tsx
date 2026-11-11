import { useEffect, useMemo, useState } from "react";
import { useCreatureGrowth } from "./CreatureGrowthContext";
import { allBabiesFor, imageForForm, SPECIES_LABELS, SPECIES } from "./creatures";
import type { Species, EvolutionStage } from "./creatures";
import Icon, { type IconName } from "../components/Icon";
import CreatureStatTraining from "./CreatureStatTraining";
import EmptyState from '../components/EmptyState';
import emptyHabitat from '../assets/icons/empty-habitat.png';
import { STAT_CAPS, isMaxedOut } from "./battle";
import type { TrainedStats } from "./battle";

function imageFor(species: Species, hamsterId: string) {
  return allBabiesFor(species).find((h) => h.id === hamsterId)?.image;
}

const STAGE_LABEL: Record<string, { text: string }> = {
  baby: { text: "Baby"},
  teen: { text: "Teen"},
  final: { text: "Final Form" },
};

// Highest-effort stage first, so a group opens with its most-evolved
// creatures rather than a wall of babies.
const STAGE_ORDER: Record<EvolutionStage, number> = { final: 0, teen: 1, baby: 2 };

type StageFilter = "all" | EvolutionStage;
type SpeciesFilter = "all" | Species;

// Evolution is no longer point/threshold-based — it's unlocked by maxing
// every trained stat for the current stage (see isMaxedOut in battle.ts).
// This shows how many of the 4 stats are maxed, and surfaces the Evolve
// button once all 4 are — so the meter reads as "battle & train more" until
// it's actually ready, rather than a generic progress bar.
function EvolutionReadiness({
  stage,
  trained,
  onEvolve,
  evolving,
}: {
  stage: "baby" | "teen";
  trained: TrainedStats;
  onEvolve: () => void;
  evolving: boolean;
}) {
  const cap = STAT_CAPS[stage];
  const statKeys: Array<keyof TrainedStats> = ["hp", "attack", "defense", "speed"];
  const maxedCount = statKeys.filter((k) => trained[k] >= cap[k]).length;
  const ready = isMaxedOut(stage, trained);

  return (
    <div className="evolve-block">
      <div className="progress is-thick">
        <div
          className={`progress-fill${ready ? " is-ready" : " is-pink"}`}
          style={{ width: `${(maxedCount / 4) * 100}%` }}
        />
      </div>
      <div className="help-text center-text">
        {ready ? "Ready to evolve!" : `${maxedCount}/4 stats maxed — win battles to earn TP`}
      </div>
      {ready && (
        <button
          className="btn btn-primary btn-block is-spaced"
          onClick={onEvolve}
          disabled={evolving}
        >
          <Icon name="sparkles-cluster" size={16} /> {evolving ? "Evolving..." : "Evolve!"}
        </button>
      )}
    </div>
  );
}

export default function CreatureHabitat() {
  const { loading, collection, justEvolved, clearJustEvolved, evolveCreature } = useCreatureGrowth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [evolving, setEvolving] = useState(false);
  const [evolveMessage, setEvolveMessage] = useState<string | null>(null);
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>("all");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  // Grouped by species (in a fixed order) and sorted final -> teen -> baby
  // within each group, so the grid reads as organized sections instead of
  // one long unsorted wall of creatures. Filters just narrow which
  // groups/entries show up; the grouping itself always applies.
  const groups = useMemo(() => {
    const filtered = collection.filter(
      (e) =>
        (speciesFilter === "all" || e.species === speciesFilter) &&
        (stageFilter === "all" || e.stage === stageFilter)
    );
    return SPECIES.map((sp) => ({
      species: sp,
      entries: filtered
        .filter((e) => e.species === sp)
        .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || +new Date(b.hatchedAt) - +new Date(a.hatchedAt)),
    })).filter((g) => g.entries.length > 0);
  }, [collection, speciesFilter, stageFilter]);

  const handleEvolve = async (entryId: number) => {
    setEvolving(true);
    setEvolveMessage(null);
    const result = await evolveCreature(entryId);
    if (!result.ok && result.reason) setEvolveMessage(result.reason);
    setEvolving(false);
  };

  useEffect(() => {
    if (justEvolved) {
      const t = setTimeout(clearJustEvolved, 3500);
      return () => clearTimeout(t);
    }
  }, [justEvolved, clearJustEvolved]);

  if (loading) return null;

  const selected = collection.find((c) => c.id === selectedId) || null;
  const evolvedEntry = justEvolved ? collection.find((c) => c.id === justEvolved.entryId) : null;

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-head">
          <div className="section-label"><Icon name="house" size={16} /> Habitat</div>
          <span className="badge badge-pink">{collection.length} hatched</span>
        </div>

        {justEvolved && evolvedEntry && (
          <div className="evolve-banner">
            <img
              className="evolve-img"
              src={imageForForm(evolvedEntry.species, justEvolved.stage, evolvedEntry.teenFormId, evolvedEntry.finalFormId, imageFor(evolvedEntry.species, evolvedEntry.hamsterId) || "")}
              alt="evolved"
            />
            <div className="evolve-title">
              {justEvolved.stage === "final"
                ? <>Reached final form! </>
                : <>Evolved! </>}
            </div>
            {justEvolved.newAbilities.length > 0 && (
              <div className="help-text">
                New: {justEvolved.newAbilities.join(" • ")}
              </div>
            )}
          </div>
        )}

        {collection.length === 0 ? (
        <EmptyState image={emptyHabitat} message="No creatures in the habitat yet." />
        ) : (
          <>
            <div className="filter-row">
              <select
                className="form-input"
                value={speciesFilter}
                onChange={(e) => setSpeciesFilter(e.target.value as SpeciesFilter)}
                aria-label="Filter by species"
              >
                <option value="all">All species</option>
                {SPECIES.map((sp) => (
                  <option key={sp} value={sp}>{SPECIES_LABELS[sp]}</option>
                ))}
              </select>
              <select
                className="form-input"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as StageFilter)}
                aria-label="Filter by stage"
              >
                <option value="all">All stages</option>
                {(["final", "teen", "baby"] as EvolutionStage[]).map((st) => (
                  <option key={st} value={st}>{STAGE_LABEL[st].text}</option>
                ))}
              </select>
            </div>

            {groups.length === 0 ? (
              <p className="hint-text center-text">Nothing matches those filters yet.</p>
            ) : (
              <div className="group-list">
                {groups.map((group) => (
                  <div key={group.species}>
                    <div className="group-label">
                      <span>{SPECIES_LABELS[group.species]}s</span>
                      <span className="badge badge-pink">{group.entries.length}</span>
                    </div>
                    <div className="creature-grid">
                      {group.entries.map((entry) => {
                        const img = imageForForm(entry.species, entry.stage, entry.teenFormId, entry.finalFormId, imageFor(entry.species, entry.hamsterId) || "");
                        const isSelected = entry.id === selectedId;
                        return (
                          <button
                            key={entry.id}
                            className={`creature-tile${isSelected ? " is-selected" : ""}`}
                            onClick={() => {
                              setSelectedId(isSelected ? null : entry.id);
                              setEvolveMessage(null);
                            }}
                          >
                            {img && <img src={img} alt={entry.name || entry.hamsterId} />}
                          
                            {entry.name && <span className="creature-name">{entry.name}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <div className="detail-panel">
                <div className="detail-head">
                  {imageForForm(selected.species, selected.stage, selected.teenFormId, selected.finalFormId, imageFor(selected.species, selected.hamsterId) || "") && (
                    <img
                      src={imageForForm(selected.species, selected.stage, selected.teenFormId, selected.finalFormId, imageFor(selected.species, selected.hamsterId) || "")}
                      alt=""
                    />
                  )}
                  <div>
                    <div className="detail-title">
                      <Icon name={STAGE_LABEL[selected.stage].icon} size={16} /> {STAGE_LABEL[selected.stage].text} · {SPECIES_LABELS[selected.species]}
                    </div>
                    <div className="help-text">
                      hatched {new Date(selected.hatchedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {selected.personality ? (
                  <div className="trait-list">
                    <div className="trait is-good"><Icon name="clipboard-check" size={16} /> {selected.personality.good[0]}</div>
                    <div className="trait is-good"><Icon name="clipboard-check" size={16} /> {selected.personality.good[1]}</div>
                    <div className="trait is-quirk"><Icon name="lightning" size={16} /> {selected.personality.quirk}</div>
                  </div>
                ) : (
                  <div className="help-text">no personality on record yet</div>
                )}

                {selected.abilities.length > 0 && (
                  <div className="trait-list">
                    <div className="mini-label">Combat abilities</div>
                    {selected.abilities.map((a, i) => (
                      <div key={i} className="trait"><Icon name="medal-wings" size={16} /> {a}</div>
                    ))}
                  </div>
                )}

                {selected.stage !== "final" && (
                  <>
                    <EvolutionReadiness
                      stage={selected.stage}
                      trained={selected.trainedStats}
                      onEvolve={() => handleEvolve(selected.id)}
                      evolving={evolving}
                    />
                    {evolveMessage && (
                      <div className="help-text center-text">
                        {evolveMessage}
                      </div>
                    )}
                  </>
                )}

                <CreatureStatTraining
                  entryId={selected.id}
                  stage={selected.stage}
                  name={selected.name}
                  trainingPoints={selected.trainingPoints}
                  trainedStats={selected.trainedStats}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
