import { useMemo, useState } from "react";

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


// -----------------------------------------------------------------------------
// BREEDER COPY
// -----------------------------------------------------------------------------

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


// -----------------------------------------------------------------------------
// NORMAL DAILY LITTER
// -----------------------------------------------------------------------------

function todaysLitter(): Creature[] {
  const fullPool: Creature[] = SPECIES.flatMap((s) => allBabiesFor(s));

  return pickDaily(`${todayKey()}:breeder`, fullPool, 3);
}


// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

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

    // First-time breeder event
    firstCreatureCandidates,
    firstCreatureEventActive,
    claimingFirstCreature,
    claimFirstCreature,
  } = useCreatureGrowth();


  // ---------------------------------------------------------------------------
  // LOCAL UI STATE
  // ---------------------------------------------------------------------------

  const [buyingId, setBuyingId] = useState<string | null>(null);

  const [sellingId, setSellingId] = useState<number | null>(null);

  const [confirmSellId, setConfirmSellId] = useState<number | null>(null);

  const [sellError, setSellError] = useState<string | null>(null);

  const [buyError, setBuyError] = useState<string | null>(null);

  const [firstCreatureError, setFirstCreatureError] =
    useState<string | null>(null);

  /*
   * This state belongs specifically to the first-creature event.
   *
   * It is intentionally separate from `justAdopted`.
   * The normal breeder adoption flow can update `justAdopted`, but that
   * should never determine whether this first-time event is complete.
   */
  const [firstCreatureClaimedHere, setFirstCreatureClaimedHere] =
    useState(false);

  /*
   * Local saving state gives the first-creature button its own stable
   * loading state while the database operation and collection refresh
   * are occurring.
   */
  const [firstCreatureSaving, setFirstCreatureSaving] =
    useState(false);


  // ---------------------------------------------------------------------------
  // DAILY LITTER / GREETING
  // ---------------------------------------------------------------------------

  const litter = useMemo(() => todaysLitter(), []);

  const greeting = useMemo(
    () =>
      pickDaily(
        `${todayKey()}:breeder-greeting`,
        BREEDER_GREETINGS,
        1
      )[0],
    []
  );


  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

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


  // ---------------------------------------------------------------------------
  // DAILY ADOPTION HELPERS
  // ---------------------------------------------------------------------------

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
    litter.every((c) => alreadyAdoptedToday(c.id));


  // ---------------------------------------------------------------------------
  // NORMAL BREEDER BUY
  // ---------------------------------------------------------------------------

  async function handleBuy(
    species: Species,
    creature: Creature
  ) {
    if (buyingId || firstCreatureSaving) return;

    setBuyError(null);

    setBuyingId(creature.id);

    const result = await buyFromBreeder(
      species,
      creature.id
    );

    if (!result.ok) {
      setBuyError(
        result.reason || "Couldn't adopt that one"
      );
    }

    setBuyingId(null);
  }


  // ---------------------------------------------------------------------------
  // FIRST-CREATURE CLAIM
  // ---------------------------------------------------------------------------

  async function handleFirstCreatureClaim(
    creature: Creature
  ) {
    /*
     * Do not allow another click once the first creature is being saved.
     *
     * We check both states because the hook has its own loading state while
     * this component also maintains a local UI lock.
     */
    if (
      firstCreatureSaving ||
      claimingFirstCreature ||
      firstCreatureClaimedHere
    ) {
      return;
    }

    setFirstCreatureError(null);

    /*
     * Immediately lock the entire first-creature UI before awaiting
     * anything. This prevents the user from triggering multiple inserts
     * or causing the candidate list to bounce between states.
     */
    setFirstCreatureSaving(true);

    try {
      const result = await claimFirstCreature(
        creature.species,
        creature.id
      );

      if (!result.ok) {
        setFirstCreatureError(
          result.reason ||
            "Couldn't bring this little one home."
        );

        setFirstCreatureSaving(false);
        return;
      }

      /*
       * The local success state is the source of truth for THIS screen.
       *
       * We intentionally do not call clearJustAdopted() here.
       * We also do not navigate anywhere.
       *
       * The breeder should remain mounted and display the success state
       * until the user explicitly chooses to continue.
       */
      setFirstCreatureClaimedHere(true);

      setFirstCreatureError(null);

      setFirstCreatureSaving(false);
    } catch (error) {
      console.error(
        "Failed to claim first creature:",
        error
      );

      setFirstCreatureError(
        "Something went wrong while bringing your new baby home. Please try again."
      );

      setFirstCreatureSaving(false);
    }
  }


  // ---------------------------------------------------------------------------
  // SELL
  // ---------------------------------------------------------------------------

  async function handleSell(entryId: number) {
    if (sellingId || firstCreatureSaving) return;

    setSellError(null);

    setSellingId(entryId);

    const result = await sellToBreeder(entryId);

    if (!result.ok) {
      setSellError(
        result.reason || "Couldn't sell that one"
      );
    }

    setSellingId(null);

    setConfirmSellId(null);
  }


  // ---------------------------------------------------------------------------
  // SHOPKEEPER DIALOGUE
  // ---------------------------------------------------------------------------

  let expression: ShopkeeperExpression = "welcome";

  let keeperMessage = greeting;


  /*
   * The first-creature states are deliberately checked before the normal
   * justAdopted state.
   *
   * This prevents the normal breeder adoption UI from taking over after
   * the first creature is inserted into the collection.
   */
  if (firstCreatureClaimedHere) {
    expression = "showing";

    keeperMessage =
      "There you go! I think the two of you are going to get along just fine.";
  } else if (firstCreatureSaving || claimingFirstCreature) {
    expression = "thinking";

    keeperMessage =
      "Just a moment — let me get the little one ready...";
  } else if (firstCreatureEventActive) {
    expression = "showing";

    keeperMessage =
      "Well, this is unexpected! I just got a little litter in, and I don't have room for all of them. Do you think you have room for one baby?";
  } else if (justAdopted) {
    expression = "showing";

    keeperMessage =
      "Welcome home, little one! Take good care of them.";
  } else if (firstCreatureError) {
    expression = "neutral";

    keeperMessage = firstCreatureError;
  } else if (buyError) {
    expression = "neutral";

    keeperMessage = buyError;
  } else if (sellError) {
    expression = "neutral";

    keeperMessage = sellError;
  } else if (buyingId) {
    expression = "thinking";

    keeperMessage =
      "Hold on now, let me wrap that up...";
  } else if (allAdoptedToday) {
    expression = "neutral";

    keeperMessage =
      "That's everyone for today — new litter at midnight.";
  }


  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="card">
      <div className="card-body">

        {/* --------------------------------------------------------------- */}
        {/* HEADER                                                          */}
        {/* --------------------------------------------------------------- */}

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
              disabled={
                refreshing ||
                firstCreatureSaving
              }
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
                cursor:
                  refreshing ||
                  firstCreatureSaving
                    ? "default"
                    : "pointer",
                opacity:
                  refreshing ||
                  firstCreatureSaving
                    ? 0.6
                    : 1,
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


        {/* --------------------------------------------------------------- */}
        {/* SHOPKEEPER                                                      */}
        {/* --------------------------------------------------------------- */}

        <ShopkeeperBubble
          expression={expression}
          message={keeperMessage}
        />


        {/* =============================================================== */}
        {/* FIRST-CREATURE SAVING                                          */}
        {/* =============================================================== */}

        {firstCreatureSaving ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px 10px 18px",
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                margin: "0 auto 12px",
                borderRadius: "50%",
                background: "var(--blush)",
                border:
                  "1px solid var(--pink-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name="sparkles-cluster"
                size={30}
                color="var(--pink-dark)"
                style={{
                  animation:
                    "breederSavingPulse 1s ease-in-out infinite",
                }}
              />
            </div>

            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "var(--pink-dark)",
              }}
            >
              Bringing your baby home...
            </div>

            <div
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Just getting everything ready for
              your new creature.
            </div>

            <div
              style={{
                marginTop: 14,
                fontSize: 10,
                color: "var(--ink-muted)",
              }}
            >
              Please wait a moment...
            </div>
          </div>

        ) : firstCreatureClaimedHere ? (

          /* ============================================================= */
          /* FIRST-CREATURE ADOPTION COMPLETE                              */
          /* ============================================================= */

          <div
            style={{
              textAlign: "center",
              padding: "10px 0",
            }}
          >
            {justAdopted ? (
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
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name="sparkles-cluster"
                  size={40}
                  color="var(--pink-dark)"
                />
              </div>
            )}

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

            <div
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                marginTop: 5,
                lineHeight: 1.5,
              }}
            >
              Your new baby is now part of your
              creature collection.
            </div>

            <div
              style={{
                fontSize: 10,
                color: "var(--ink-muted)",
                marginTop: 6,
              }}
            >
              You can train, evolve, and battle
              with your new creature.
            </div>

            <button
              type="button"
              onClick={() => {
                /*
                 * Clear the normal adoption notification only when the
                 * user explicitly leaves the success screen.
                 *
                 * We do NOT navigate here. This component simply returns
                 * to its normal breeder UI.
                 */
                clearJustAdopted();

                setFirstCreatureClaimedHere(false);
                setFirstCreatureError(null);
                setBuyError(null);
                setSellError(null);
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

        ) : firstCreatureEventActive ? (

          /* ============================================================= */
          /* FIRST-CREATURE EVENT                                          */
          /* ============================================================= */

          <div
            style={{
              padding: "6px 0 4px",
            }}
          >

            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--pink-dark)",
                marginBottom: 4,
              }}
            >
              A little surprise litter
            </div>

            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "var(--ink-muted)",
                marginBottom: 12,
                lineHeight: 1.45,
              }}
            >
              He needs to find a home for one of these
              babies. Pick the one you want to bring
              home — this first one is on the house.
            </div>


            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {firstCreatureCandidates.map(
                (creature) => (
                  <div
                    key={`${creature.species}-${creature.id}`}
                    style={{
                      width: 102,
                      textAlign: "center",
                      border:
                        "1px solid var(--pink-light)",
                      borderRadius: 14,
                      padding: 9,
                      background: "var(--blush)",
                      opacity:
                        firstCreatureSaving
                          ? 0.6
                          : 1,
                    }}
                  >

                    <img
                      src={creature.image}
                      alt={`${SPECIES_LABELS[creature.species]} baby`}
                      style={{
                        width: 72,
                        height: 72,
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
                      {SPECIES_LABELS[
                        creature.species
                      ]}
                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        handleFirstCreatureClaim(
                          creature
                        )
                      }
                      disabled={
                        firstCreatureSaving ||
                        claimingFirstCreature
                      }
                      style={{
                        marginTop: 7,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--pink-dark)",
                        background:
                          "var(--cream)",
                        border:
                          "1px solid var(--pink-light)",
                        borderRadius: 99,
                        padding: "5px 8px",
                        width: "100%",
                        cursor:
                          firstCreatureSaving ||
                          claimingFirstCreature
                            ? "default"
                            : "pointer",
                        opacity:
                          firstCreatureSaving ||
                          claimingFirstCreature
                            ? 0.55
                            : 1,
                      }}
                    >
                      {firstCreatureSaving ||
                      claimingFirstCreature
                        ? "..."
                        : "Take me home"}
                    </button>

                  </div>
                )
              )}
            </div>


            {firstCreatureError && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pink-dark)",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                {firstCreatureError}
              </div>
            )}


            <div
              style={{
                textAlign: "center",
                marginTop: 12,
                fontSize: 10,
                color: "var(--ink-muted)",
              }}
            >
              <Icon
                name="sparkles-cluster"
                size={13}
              />{" "}
              Your first creature is free
            </div>

          </div>

        ) : justAdopted ? (

          /* ============================================================= */
          /* NORMAL ADOPTION COMPLETE                                      */
          /* ============================================================= */

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

            <div
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                marginTop: 5,
              }}
            >
              Your new baby is now part of your
              creature collection.
            </div>

            <button
              type="button"
              onClick={() => {
                clearJustAdopted();
                setFirstCreatureClaimedHere(false);
                setFirstCreatureError(null);
                setBuyError(null);
              }}
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

          /* ============================================================= */
          /* NORMAL BREEDER                                                */
          /* ============================================================= */

          <>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              Today's litter — {BREEDER_COST} pts
              each, new babies at midnight
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


            {buyError && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pink-dark)",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                {buyError}
              </div>
            )}


            {/* ----------------------------------------------------------- */}
            {/* SELL TO BREEDER                                             */}
            {/* ----------------------------------------------------------- */}

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
                          (c) =>
                            c.id ===
                            entry.hamsterId
                        )?.image || "";


                      const image =
                        imageForForm(
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
                              objectFit:
                                "contain",
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


            {/* ----------------------------------------------------------- */}
            {/* RECENT POINTS                                               */}
            {/* ----------------------------------------------------------- */}

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


        {/* ----------------------------------------------------------------- */}
        {/* ANIMATIONS                                                        */}
        {/* ----------------------------------------------------------------- */}

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

          @keyframes breederRefreshSpin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @keyframes breederSavingPulse {
            0% {
              transform: scale(0.9);
              opacity: 0.55;
            }

            50% {
              transform: scale(1.1);
              opacity: 1;
            }

            100% {
              transform: scale(0.9);
              opacity: 0.55;
            }
          }
        `}</style>

      </div>
    </div>
  );
}