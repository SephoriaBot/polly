import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCreatureGrowth } from "./CreatureGrowthContext";
import {
  SPECIES,
  SPECIES_LABELS,
  allBabiesFor,
  imageForForm,
} from "./creatures";
import type {
  Creature,
  Species,
  EvolutionStage,
} from "./creatures";
import { todayKey, pickDaily } from "../lib/dailyRandom";
import Icon from "../components/Icon";
import ShopkeeperBubble, {
  type ShopkeeperExpression,
} from "./ShopkeeperBubble";
import {
  BREEDER_COST,
  SOURCE_LABELS,
  computeSellPrice,
} from "./useCreatureGrowth";
import {
  rollPersonality,
  rollAbilities,
  abilityPoolFor,
} from "./personalities";

/* -------------------------------------------------------------------------- */
/*                                BREEDER DATA                               */
/* -------------------------------------------------------------------------- */

const BREEDER_GREETINGS = [
  "Take a look at today's litter!",
  "Come on in, have a look around.",
  "These little ones just came in this morning.",
  "Take your time picking — no rush at all.",
  "Every one of these is a good egg, if you ask me.",
];

const STAGE_LABELS: Record<EvolutionStage, string> = {
  baby: "Baby",
  teen: "Middle",
  final: "Final",
};

const FIRST_CREATURE_STORAGE_KEY =
  "polly:first-creature-candidates:v1";

const FIRST_CREATURE_COMPLETED_KEY =
  "polly:first-creature-completed:v1";

/* -------------------------------------------------------------------------- */
/*                              NORMAL DAILY LITTER                           */
/* -------------------------------------------------------------------------- */

function todaysLitter(): Creature[] {
  const fullPool: Creature[] = SPECIES.flatMap((s) => allBabiesFor(s));

  return pickDaily(
    `${todayKey()}:breeder`,
    fullPool,
    3
  );
}

/* -------------------------------------------------------------------------- */
/*                         FIRST CREATURE CANDIDATES                          */
/* -------------------------------------------------------------------------- */

/**
 * The first-time litter is deliberately different from the normal breeder.
 *
 * - 5 babies instead of 3
 * - each baby comes from a different species
 * - selected from the entire species pool
 * - randomized once and then persisted in localStorage
 *
 * We persist IDs rather than entire Creature objects so the candidate data
 * always comes from the current creature definitions in creatures.ts.
 */
function generateFirstCreatureCandidates(): Creature[] {
  const allCreatures: Creature[] = SPECIES.flatMap((species) =>
    allBabiesFor(species)
  );

  const shuffled = [...allCreatures].sort(
    () => Math.random() - 0.5
  );

  const chosen: Creature[] = [];
  const speciesUsed = new Set<Species>();

  for (const creature of shuffled) {
    if (speciesUsed.has(creature.species)) continue;

    speciesUsed.add(creature.species);
    chosen.push(creature);

    if (chosen.length >= 5) break;
  }

  return chosen;
}

function loadFirstCreatureCandidates(): Creature[] {
  try {
    const saved = localStorage.getItem(
      FIRST_CREATURE_STORAGE_KEY
    );

    if (saved) {
      const ids = JSON.parse(saved);

      if (Array.isArray(ids) && ids.length === 5) {
        const allCreatures: Creature[] = SPECIES.flatMap((species) =>
          allBabiesFor(species)
        );

        const restored: Creature[] = [];

        for (const id of ids) {
          const creature = allCreatures.find(
            (candidate) => candidate.id === id
          );

          if (creature) {
            restored.push(creature);
          }
        }

        if (restored.length === 5) {
          return restored;
        }
      }
    }
  } catch (error) {
    console.error(
      "[CreatureBreeder] Failed to restore first-creature candidates:",
      error
    );
  }

  const generated = generateFirstCreatureCandidates();

  try {
    localStorage.setItem(
      FIRST_CREATURE_STORAGE_KEY,
      JSON.stringify(generated.map((creature) => creature.id))
    );
  } catch (error) {
    console.error(
      "[CreatureBreeder] Failed to save first-creature candidates:",
      error
    );
  }

  return generated;
}

/* -------------------------------------------------------------------------- */
/*                                  COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export default function CreatureBreeder() {
  const {
    loading,
    refreshing,
    refresh,
    bankPoints,
    recentPoints,
    buyFromBreeder,
    sellToBreeder,
    collection,
    justAdopted,
    clearJustAdopted,
    growthError,
    clearGrowthError,
  } = useCreatureGrowth();

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [confirmSellId, setConfirmSellId] =
    useState<number | null>(null);

  const [sellError, setSellError] = useState<string | null>(null);
  const [breederError, setBreederError] =
    useState<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /*                         FIRST-TIME EVENT STATE                         */
  /* ---------------------------------------------------------------------- */

  const [firstCreatureStep, setFirstCreatureStep] =
    useState<"intro" | "choose" | "confirm" | "complete" | null>(
      null
    );

  const [selectedFirstCreature, setSelectedFirstCreature] =
    useState<Creature | null>(null);

  const [claimingFirstCreature, setClaimingFirstCreature] =
    useState(false);

  const [firstCreatureError, setFirstCreatureError] =
    useState<string | null>(null);

  const [firstCreatureCandidates] = useState<Creature[]>(() => {
    if (typeof window === "undefined") return [];
    return loadFirstCreatureCandidates();
  });

  /*
   * A user is considered new to the creature collection when:
   *
   * 1. They have no creatures yet.
   * 2. They have not already completed this first-creature event.
   *
   * localStorage prevents the event from returning after the user has
   * completed it and subsequently sells their first creature.
   */
  const hasCompletedFirstCreatureEvent =
    typeof window !== "undefined" &&
    localStorage.getItem(FIRST_CREATURE_COMPLETED_KEY) === "true";

  const shouldShowFirstCreatureEvent =
    !loading &&
    collection.length === 0 &&
    !hasCompletedFirstCreatureEvent;

  /*
   * Start the event automatically the first time the user reaches the
   * breeder with an empty collection.
   */
  if (
    shouldShowFirstCreatureEvent &&
    firstCreatureStep === null
  ) {
    setFirstCreatureStep("intro");
  }

  /* ---------------------------------------------------------------------- */
  /*                         NORMAL BREEDER DATA                            */
  /* ---------------------------------------------------------------------- */

  const litter = useMemo(
    () => todaysLitter(),
    []
  );

  const greeting = useMemo(
    () =>
      pickDaily(
        `${todayKey()}:breeder-greeting`,
        BREEDER_GREETINGS,
        1
      )[0],
    []
  );

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <ShopkeeperBubble
            expression="thinking"
            message="Just checking my ledger..."
          />
        </div>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  function alreadyAdoptedToday(creatureId: string) {
    return collection.some(
      (entry) =>
        entry.source === "breeder" &&
        entry.hamsterId === creatureId &&
        new Date(entry.hatchedAt) >= todayStart
    );
  }

  const allAdoptedToday =
    litter.length > 0 &&
    litter.every((creature) =>
      alreadyAdoptedToday(creature.id)
    );

  /* ---------------------------------------------------------------------- */
  /*                         FIRST CREATURE CLAIM                           */
  /* ---------------------------------------------------------------------- */

  async function claimFirstCreature() {
    if (!selectedFirstCreature || claimingFirstCreature) {
      return;
    }

    setClaimingFirstCreature(true);
    setFirstCreatureError(null);

    const creature = selectedFirstCreature;

    try {
      /*
       * Generate the same personality/abilities that normal breeder
       * adoptions receive.
       */
      const personality = rollPersonality();

      const abilities = rollAbilities(
        abilityPoolFor(creature.species, "baby"),
        2
      );

      /*
       * This is intentionally FREE.
       *
       * We do NOT touch bank_points.
       */
      const { error } = await supabase
        .from("hamster_collection")
        .insert({
          hamster_id: creature.id,
          species: creature.species,
          source: "first_creature",
          personality,
          stage: "baby",
          evolution_points: 0,
          abilities,
          hatched_at: new Date().toISOString(),
          training_points: 0,
          trained_hp: 0,
          trained_attack: 0,
          trained_defense: 0,
          trained_speed: 0,
        });

      if (error) {
        console.error(
          "[CreatureBreeder] First creature claim failed:",
          error
        );

        setFirstCreatureError(
          error.message || "Couldn't bring this little one home."
        );

        return;
      }

      /*
       * The event is now permanently completed.
       *
       * This is intentionally separate from collection.length because
       * selling the creature later should NOT make the introductory event
       * appear again.
       */
      try {
        localStorage.setItem(
          FIRST_CREATURE_COMPLETED_KEY,
          "true"
        );

        localStorage.removeItem(
          FIRST_CREATURE_STORAGE_KEY
        );
      } catch (error) {
        console.error(
          "[CreatureBreeder] Failed to save first-creature completion:",
          error
        );
      }

      /*
       * Refresh the real collection so the rest of Polly immediately sees
       * the new creature.
       */
      await refresh();

      setFirstCreatureStep("complete");
    } catch (error) {
      console.error(
        "[CreatureBreeder] First creature claim failed:",
        error
      );

      setFirstCreatureError(
        error instanceof Error
          ? error.message
          : "Couldn't bring this little one home."
      );
    } finally {
      setClaimingFirstCreature(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                              NORMAL BUY                                */
  /* ---------------------------------------------------------------------- */

  async function handleBuy(
    species: Species,
    creature: Creature
  ) {
    if (buyingId !== null) return;

    setBreederError(null);
    clearGrowthError();
    setBuyingId(creature.id);

    try {
      const result = await buyFromBreeder(
        species,
        creature.id
      );

      if (!result.ok) {
        setBreederError(
          result.reason || "Couldn't adopt that one"
        );
      }
    } catch (error) {
      console.error(
        "[CreatureBreeder] adoption failed:",
        error
      );

      setBreederError(
        error instanceof Error
          ? error.message
          : "Couldn't adopt that one"
      );
    } finally {
      setBuyingId(null);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                              SELL                                      */
  /* ---------------------------------------------------------------------- */

  async function handleSell(entryId: number) {
    if (sellingId !== null) return;

    setSellError(null);
    clearGrowthError();
    setSellingId(entryId);

    try {
      const result = await sellToBreeder(entryId);

      if (!result.ok) {
        setSellError(
          result.reason || "Couldn't sell that one"
        );
      }
    } catch (error) {
      console.error(
        "[CreatureBreeder] sell failed:",
        error
      );

      setSellError(
        error instanceof Error
          ? error.message
          : "Couldn't sell that one"
      );
    } finally {
      setSellingId(null);
      setConfirmSellId(null);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                       BREEDER SHOPKEEPER MESSAGE                       */
  /* ---------------------------------------------------------------------- */

  let expression: ShopkeeperExpression = "welcome";
  let keeperMessage = greeting;

  if (firstCreatureStep === "intro") {
    expression = "welcome";
    keeperMessage =
      "Oh! You're just getting started, aren't you?";
  } else if (firstCreatureStep === "choose") {
    expression = "showing";
    keeperMessage =
      "I had an unexpected litter! Think you might have room for one?";
  } else if (firstCreatureStep === "confirm") {
    expression = "showing";
    keeperMessage =
      "That little one? I think you two might get along.";
  } else if (firstCreatureStep === "complete") {
    expression = "showing";
    keeperMessage =
      "There we go! Your first little creature. Take good care of them.";
  } else if (justAdopted) {
    expression = "showing";
    keeperMessage =
      "Welcome home, little one! Take good care of them.";
  } else if (growthError) {
    expression = "neutral";
    keeperMessage = growthError;
  } else if (buyingId) {
    expression = "thinking";
    keeperMessage =
      "Hold on now, let me wrap that up...";
  } else if (allAdoptedToday) {
    expression = "neutral";
    keeperMessage =
      "That's everyone for today — new litter at midnight.";
  }

  /* ---------------------------------------------------------------------- */
  /*                              FIRST EVENT                               */
  /* ---------------------------------------------------------------------- */

  function renderFirstCreatureEvent() {
    if (firstCreatureStep === "intro") {
      return (
        <div
          style={{
            textAlign: "center",
            padding: "14px 4px 8px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "var(--pink-dark)",
              marginBottom: 8,
            }}
          >
            An unexpected litter...
          </div>

          <div
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              color: "var(--ink-muted)",
              maxWidth: 330,
              margin: "0 auto",
            }}
          >
            I wasn't expecting these little ones today.
            <br />
            I've got one more baby than I have room for.
            <br />
            <br />
            Think you could give one a home?
          </div>

          <button
            type="button"
            onClick={() =>
              setFirstCreatureStep("choose")
            }
            style={{
              marginTop: 14,
              fontSize: 12,
              fontWeight: 800,
              color: "white",
              background: "var(--pink-dark)",
              border: "none",
              borderRadius: 99,
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >
            Let me see them
          </button>
        </div>
      );
    }

    if (firstCreatureStep === "choose") {
      return (
        <div style={{ paddingTop: 8 }}>
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--ink-muted)",
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            These little ones will join your collection.
            <br />
            Choose one to raise, evolve, and battle with.
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {firstCreatureCandidates.map(
              (creature) => (
                <button
                  key={creature.id}
                  type="button"
                  onClick={() => {
                    setSelectedFirstCreature(
                      creature
                    );
                    setFirstCreatureStep("confirm");
                    setFirstCreatureError(null);
                  }}
                  style={{
                    width: 92,
                    textAlign: "center",
                    border:
                      "1px solid var(--pink-light)",
                    borderRadius: 14,
                    padding: "9px 6px",
                    background: "var(--blush)",
                    cursor: "pointer",
                    transition:
                      "transform 0.15s ease",
                  }}
                >
                  <img
                    src={creature.image}
                    alt={`${SPECIES_LABELS[creature.species]} baby`}
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: "contain",
                    }}
                  />

                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--ink-muted)",
                      marginTop: 4,
                    }}
                  >
                    {
                      SPECIES_LABELS[
                        creature.species
                      ]
                    }
                  </div>

                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--ink-muted)",
                      marginTop: 2,
                    }}
                  >
                    Baby
                  </div>
                </button>
              )
            )}
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 9,
              color: "var(--ink-muted)",
              marginTop: 10,
            }}
          >
            You can only choose one.
          </div>
        </div>
      );
    }

    if (
      firstCreatureStep === "confirm" &&
      selectedFirstCreature
    ) {
      return (
        <div
          style={{
            textAlign: "center",
            padding: "12px 4px 8px",
          }}
        >
          <img
            src={selectedFirstCreature.image}
            alt={`${SPECIES_LABELS[selectedFirstCreature.species]} baby`}
            style={{
              width: 120,
              height: 120,
              objectFit: "contain",
              animation:
                "firstCreatureFloat 1.4s ease-in-out infinite",
            }}
          />

          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--pink-dark)",
              marginTop: 4,
            }}
          >
            {
              SPECIES_LABELS[
                selectedFirstCreature.species
              ]
            }
          </div>

          <div
            style={{
              fontSize: 11,
              color: "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            Your first collection creature
          </div>

          <div
            style={{
              fontSize: 10,
              color: "var(--ink-muted)",
              lineHeight: 1.5,
              maxWidth: 280,
              margin: "10px auto 0",
            }}
          >
            This little one isn't your Companion.
            They'll become part of your collection,
            where you can train, evolve, and battle
            with them.
          </div>

          {firstCreatureError && (
            <div
              style={{
                fontSize: 11,
                color: "var(--pink-dark)",
                marginTop: 10,
              }}
            >
              {firstCreatureError}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginTop: 14,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (claimingFirstCreature) return;

                setSelectedFirstCreature(null);
                setFirstCreatureError(null);
                setFirstCreatureStep("choose");
              }}
              disabled={claimingFirstCreature}
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                padding: "6px 8px",
              }}
            >
              choose another
            </button>

            <button
              type="button"
              onClick={claimFirstCreature}
              disabled={claimingFirstCreature}
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "white",
                background: "var(--pink-dark)",
                border: "none",
                borderRadius: 99,
                padding: "8px 18px",
                cursor: claimingFirstCreature
                  ? "default"
                  : "pointer",
                opacity: claimingFirstCreature
                  ? 0.65
                  : 1,
              }}
            >
              {claimingFirstCreature
                ? "Bringing them home..."
                : "Yes, I'll take them!"}
            </button>
          </div>
        </div>
      );
    }

    if (firstCreatureStep === "complete") {
      return (
        <div
          style={{
            textAlign: "center",
            padding: "12px 4px",
          }}
        >
          {selectedFirstCreature && (
            <img
              src={selectedFirstCreature.image}
              alt="your new creature"
              style={{
                width: 110,
                height: 110,
                objectFit: "contain",
                animation:
                  "adoptPop 0.7s ease",
              }}
            />
          )}

          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--pink-dark)",
              marginTop: 6,
            }}
          >
            Welcome home!{" "}
            <Icon
              name="sparkles-cluster"
              size={16}
            />
          </div>

          <div
            style={{
              fontSize: 11,
              color: "var(--ink-muted)",
              lineHeight: 1.5,
              marginTop: 6,
              maxWidth: 280,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Your new creature is now in your
            collection. Raise them, train them,
            and see what they become.
          </div>

          <button
            type="button"
            onClick={() => {
              setFirstCreatureStep(null);
              setSelectedFirstCreature(null);
            }}
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "var(--pink-dark)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            back to the breeder
          </button>
        </div>
      );
    }

    return null;
  }

  /* ---------------------------------------------------------------------- */
  /*                                  UI                                    */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="card">
      <div className="card-body">
        <div
          className="section-label"
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <Icon
              name="shopping-cart"
              size={16}
            />{" "}
            The Breeder
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "var(--ink-muted)",
              }}
            >
              {bankPoints} pts
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh bank points"
              title="Refresh bank points"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                padding: 0,
                border:
                  "1px solid var(--pink-light)",
                borderRadius: 99,
                background: "var(--blush)",
                cursor: refreshing
                  ? "default"
                  : "pointer",
                opacity: refreshing ? 0.6 : 1,
              }}
            >
              <Icon
                name="icon-recur"
                size={24}
                color="var(--pink-dark)"
                style={
                  refreshing
                    ? {
                        animation:
                          "breederRefreshSpin 0.8s linear infinite",
                      }
                    : undefined
                }
              />
            </button>
          </div>
        </div>

        <ShopkeeperBubble
          expression={expression}
          message={keeperMessage}
        />

        {/* ---------------------------------------------------------------- */}
        {/* FIRST-TIME CREATURE EXPERIENCE                                  */}
        {/* ---------------------------------------------------------------- */}

        {firstCreatureStep !== null ? (
          renderFirstCreatureEvent()
        ) : justAdopted ? (
          <div
            style={{
              textAlign: "center",
              padding: "10px 0",
            }}
          >
            <img
              src={justAdopted.image}
              alt="a new creature you adopted from the breeder"
              style={{
                width: 96,
                height: 96,
                objectFit: "contain",
                animation:
                  "adoptPop 0.7s ease",
              }}
            />

            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "var(--pink-dark)",
                marginTop: 6,
              }}
            >
              Welcome home!{" "}
              <Icon
                name="sparkles-cluster"
                size={16}
              />
            </div>

            <button
              type="button"
              onClick={clearJustAdopted}
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--pink-dark)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              back to the breeder
            </button>
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------ */}
            {/* NORMAL DAILY LITTER                                         */}
            {/* ------------------------------------------------------------ */}

            <div
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              Today's litter — {BREEDER_COST} pts each,
              new babies at midnight
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {litter.map((creature) => {
                const adopted =
                  alreadyAdoptedToday(
                    creature.id
                  );

                const canAfford =
                  bankPoints >= BREEDER_COST;

                const disabled =
                  adopted ||
                  !canAfford ||
                  buyingId === creature.id;

                return (
                  <div
                    key={creature.id}
                    style={{
                      width: 96,
                      textAlign: "center",
                      border:
                        "1px solid var(--pink-light)",
                      borderRadius: 14,
                      padding: 8,
                      background: "var(--blush)",
                    }}
                  >
                    <img
                      src={creature.image}
                      alt={`${SPECIES_LABELS[creature.species]} baby`}
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: "contain",
                      }}
                    />

                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--ink-muted)",
                        marginTop: 4,
                      }}
                    >
                      {
                        SPECIES_LABELS[
                          creature.species
                        ]
                      }
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleBuy(
                          creature.species,
                          creature
                        )
                      }
                      disabled={disabled}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: adopted
                          ? "var(--ink-muted)"
                          : "var(--pink-dark)",
                        background:
                          "var(--cream)",
                        border:
                          "1px solid var(--pink-light)",
                        borderRadius: 99,
                        padding: "4px 8px",
                        width: "100%",
                        cursor: disabled
                          ? "default"
                          : "pointer",
                        opacity:
                          buyingId ===
                          creature.id
                            ? 0.6
                            : 1,
                      }}
                    >
                      {adopted
                        ? "Adopted"
                        : buyingId ===
                            creature.id
                          ? "..."
                          : `${BREEDER_COST} pts`}
                    </button>
                  </div>
                );
              })}
            </div>

            {breederError && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pink-dark)",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                {breederError}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* SELL COLLECTION                                             */}
            {/* ------------------------------------------------------------ */}

            {collection.length > 0 && (
              <div
                className="card"
                style={{
                  marginTop: 14,
                  border:
                    "1px solid var(--pink-light)",
                }}
              >
                <div className="card-body">
                  <div
                    className="section-label"
                    style={{ marginBottom: 8 }}
                  >
                    Sell to the Breeder
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-muted)",
                      marginBottom: 10,
                      textAlign: "center",
                    }}
                  >
                    Price scales with stage and
                    trained stats. Unused training
                    points are lost on sale.
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      justifyContent: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {collection.map((entry) => {
                      const baseImage =
                        allBabiesFor(
                          entry.species
                        ).find(
                          (creature) =>
                            creature.id ===
                            entry.hamsterId
                        )?.image || "";

                      const image = imageForForm(
                        entry.species,
                        entry.stage,
                        entry.teenFormId,
                        entry.finalFormId,
                        baseImage
                      );

                      const price =
                        computeSellPrice(
                          entry.stage,
                          entry.trainedStats
                        );

                      const isThisSelling =
                        sellingId === entry.id;

                      const isConfirming =
                        confirmSellId ===
                        entry.id;

                      return (
                        <div
                          key={entry.id}
                          style={{
                            width: 96,
                            textAlign: "center",
                            border:
                              "1px solid var(--pink-light)",
                            borderRadius: 14,
                            padding: 8,
                            background:
                              "var(--blush)",
                          }}
                        >
                          <img
                            src={image}
                            alt={`${SPECIES_LABELS[entry.species]} (${STAGE_LABELS[entry.stage]})`}
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: "contain",
                            }}
                          />

                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color:
                                "var(--ink-muted)",
                              marginTop: 4,
                            }}
                          >
                            {entry.name ||
                              SPECIES_LABELS[
                                entry.species
                              ]}
                          </div>

                          <div
                            style={{
                              fontSize: 9,
                              color:
                                "var(--ink-muted)",
                            }}
                          >
                            {
                              STAGE_LABELS[
                                entry.stage
                              ]
                            }
                          </div>

                          {isConfirming ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection:
                                  "column",
                                gap: 4,
                                marginTop: 6,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleSell(
                                    entry.id
                                  )
                                }
                                disabled={
                                  isThisSelling
                                }
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "white",
                                  background:
                                    "var(--pink-dark)",
                                  border: "none",
                                  borderRadius: 99,
                                  padding:
                                    "4px 8px",
                                  cursor:
                                    isThisSelling
                                      ? "default"
                                      : "pointer",
                                }}
                              >
                                {isThisSelling
                                  ? "..."
                                  : `Confirm (${price} pts)`}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmSellId(
                                    null
                                  )
                                }
                                disabled={
                                  isThisSelling
                                }
                                style={{
                                  fontSize: 10,
                                  color:
                                    "var(--ink-muted)",
                                  background:
                                    "none",
                                  border: "none",
                                  cursor:
                                    "pointer",
                                  textDecoration:
                                    "underline",
                                }}
                              >
                                cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmSellId(
                                  entry.id
                                )
                              }
                              style={{
                                marginTop: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                color:
                                  "var(--pink-dark)",
                                background:
                                  "var(--cream)",
                                border:
                                  "1px solid var(--pink-light)",
                                borderRadius: 99,
                                padding:
                                  "4px 8px",
                                width: "100%",
                                cursor:
                                  "pointer",
                              }}
                            >
                              Sell — {price} pts
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {sellError && (
                    <div
                      style={{
                        fontSize: 11,
                        color:
                          "var(--pink-dark)",
                        marginTop: 10,
                        textAlign: "center",
                      }}
                    >
                      {sellError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* RECENT POINTS                                               */}
            {/* ------------------------------------------------------------ */}

            {recentPoints.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  marginTop: 14,
                  paddingBottom: 2,
                }}
              >
                {recentPoints.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--pink-dark)",
                      background:
                        "var(--blush)",
                      border:
                        "1px solid var(--pink-light)",
                      borderRadius: 99,
                      padding: "4px 10px",
                    }}
                  >
                    {SOURCE_LABELS[
                      entry.source
                    ] ? (
                      <>
                        <Icon
                          name={
                            SOURCE_LABELS[
                              entry.source
                            ].icon
                          }
                          size={13}
                        />{" "}
                        {
                          SOURCE_LABELS[
                            entry.source
                          ].text
                        }
                      </>
                    ) : (
                      entry.source
                    )}{" "}
                    {entry.amount >= 0
                      ? "+"
                      : ""}
                    {entry.amount}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <style>{`
          @keyframes adoptPop {
            0% {
              transform: scale(0.3);
              opacity: 0;
            }

            60% {
              transform: scale(1.15);
              opacity: 1;
            }

            100% {
              transform: scale(1);
            }
          }

          @keyframes firstCreatureFloat {
            0% {
              transform: translateY(0);
            }

            50% {
              transform: translateY(-5px);
            }

            100% {
              transform: translateY(0);
            }
          }

          @keyframes breederRefreshSpin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}