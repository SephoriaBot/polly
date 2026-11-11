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

import { useAuth } from "../context/AuthContext";
import { triggerActionEvent } from "../lib/questSystem";

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
  const { user } = useAuth();
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
    } else if (user) {
      triggerActionEvent(user.id, "creature_purchased");
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
    } else if (user) {
      triggerActionEvent(user.id, "creature_sold");
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

        {/* HEADER */}
        <div className="section-head">
          <div className="section-label">
            <Icon name="shopping-cart" size={16} /> The Breeder
          </div>

          <div className="add-row">
            <span className="bank-chip">{bankPoints} pts</span>
            <button
              type="button"
              className="icon-circle-btn"
              onClick={refresh}
              disabled={refreshing || firstCreatureSaving}
              aria-label="Refresh bank points"
              title="Refresh bank points"
            >
              <Icon
                name="icon-recur"
                size={22}
                color="var(--pink-dark)"
                style={refreshing ? { animation: "breederRefreshSpin 0.8s linear infinite" } : undefined}
              />
            </button>
          </div>
        </div>

        {/* SHOPKEEPER */}
        <ShopkeeperBubble expression={expression} message={keeperMessage} />

        {firstCreatureSaving ? (

          /* FIRST-CREATURE SAVING */
          <div className="breeder-state">
            <div className="state-orb">
              <Icon
                name="sparkles-cluster"
                size={32}
                color="var(--pink-dark)"
                style={{ animation: "breederSavingPulse 1s ease-in-out infinite" }}
              />
            </div>
            <div className="state-title">Bringing your baby home...</div>
            <div className="help-text">Just getting everything ready for your new creature.</div>
            <div className="help-text">Please wait a moment...</div>
          </div>

        ) : firstCreatureClaimedHere ? (

          /* FIRST-CREATURE ADOPTION COMPLETE */
          <div className="breeder-state">
            {justAdopted ? (
              <img
                className="adopt-img"
                src={justAdopted.image}
                alt="a new creature you adopted from the breeder"
              />
            ) : (
              <div className="state-orb is-plain">
                <Icon name="sparkles-cluster" size={40} color="var(--pink-dark)" />
              </div>
            )}

            <div className="state-title">
              Welcome home! <Icon name="sparkles-cluster" size={16} />
            </div>
            <div className="help-text">Your new baby is now part of your creature collection.</div>
            <div className="help-text">You can train, evolve, and battle with your new creature.</div>

            <button
              type="button"
              className="text-link"
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
            >
              back to the breeder
            </button>
          </div>

        ) : firstCreatureEventActive ? (

          /* FIRST-CREATURE EVENT */
          <div className="breeder-state">
            <div className="state-title">A little surprise litter</div>
            <div className="help-text">
              He needs to find a home for one of these babies. Pick the one you want to bring home — this first one is on the house.
            </div>

            <div className="litter-grid">
              {firstCreatureCandidates.map((creature) => {
                const busy = firstCreatureSaving || claimingFirstCreature;
                return (
                  <div
                    key={`${creature.species}-${creature.id}`}
                    className={`litter-card${firstCreatureSaving ? " is-busy" : ""}`}
                  >
                    <img
                      src={creature.image}
                      alt={`${SPECIES_LABELS[creature.species]} baby`}
                    />
                    <div className="litter-name">{SPECIES_LABELS[creature.species]}</div>
                    <button
                      type="button"
                      className="litter-btn"
                      onClick={() => handleFirstCreatureClaim(creature)}
                      disabled={busy}
                    >
                      {busy ? "..." : "Take me home"}
                    </button>
                  </div>
                );
              })}
            </div>

            {firstCreatureError && (
              <div className="help-text is-pink">{firstCreatureError}</div>
            )}

            <div className="help-text">
              <Icon name="sparkles-cluster" size={13} /> Your first creature is free
            </div>
          </div>

        ) : justAdopted ? (

          /* NORMAL ADOPTION COMPLETE */
          <div className="breeder-state">
            <img
              className="adopt-img"
              src={justAdopted.image}
              alt="a new creature you adopted from the breeder"
            />
            <div className="state-title">
              Welcome home! <Icon name="sparkles-cluster" size={16} />
            </div>
            <div className="help-text">Your new baby is now part of your creature collection.</div>

            <button
              type="button"
              className="text-link"
              onClick={() => {
                clearJustAdopted();
                setFirstCreatureClaimedHere(false);
                setFirstCreatureError(null);
                setBuyError(null);
              }}
            >
              back to the breeder
            </button>
          </div>

        ) : (

          /* NORMAL BREEDER */
          <>
            <p className="hint-text center-text">
              Today's litter — {BREEDER_COST} pts each, new babies at midnight
            </p>

            <div className="litter-grid">
              {litter.map((creature) => {
                const adopted = alreadyAdoptedToday(creature.id);
                const canAfford = bankPoints >= BREEDER_COST;
                const disabled = adopted || !canAfford || buyingId === creature.id;

                return (
                  <div key={creature.id} className="litter-card">
                    <img
                      src={creature.image}
                      alt={`${SPECIES_LABELS[creature.species]} baby`}
                    />
                    <div className="litter-name">{SPECIES_LABELS[creature.species]}</div>
                    <button
                      type="button"
                      className={`litter-btn${adopted ? " is-muted" : ""}`}
                      onClick={() => handleBuy(creature.species, creature)}
                      disabled={disabled}
                    >
                      {adopted ? "Adopted" : buyingId === creature.id ? "..." : `${BREEDER_COST} pts`}
                    </button>
                  </div>
                );
              })}
            </div>

            {buyError && <div className="help-text is-pink center-text">{buyError}</div>}

            {/* SELL TO BREEDER */}
            {collection.length > 0 && (
              <div className="card is-outlined">
                <div className="card-body">
                  <div className="section-label">Sell to the Breeder</div>
                  <p className="hint-text center-text">
                    Price scales with stage and trained stats. Unused training points are lost on sale.
                  </p>

                  <div className="litter-grid">
                    {collection.map((entry) => {
                      const baseImage =
                        allBabiesFor(entry.species).find((c) => c.id === entry.hamsterId)?.image || "";
                      const image = imageForForm(
                        entry.species,
                        entry.stage,
                        entry.teenFormId,
                        entry.finalFormId,
                        baseImage
                      );
                      const price = computeSellPrice(entry.stage, entry.trainedStats);
                      const isThisSelling = sellingId === entry.id;
                      const isConfirming = confirmSellId === entry.id;

                      return (
                        <div key={entry.id} className="litter-card">
                          <img
                            src={image}
                            alt={`${SPECIES_LABELS[entry.species]} (${STAGE_LABELS[entry.stage]})`}
                          />
                          <div className="litter-name">
                            {entry.name || SPECIES_LABELS[entry.species]}
                          </div>
                          <div className="litter-stage">{STAGE_LABELS[entry.stage]}</div>

                          {isConfirming ? (
                            <div className="litter-actions">
                              <button
                                type="button"
                                className="litter-btn is-solid"
                                onClick={() => handleSell(entry.id)}
                                disabled={isThisSelling}
                              >
                                {isThisSelling ? "..." : `Confirm (${price} pts)`}
                              </button>
                              <button
                                type="button"
                                className="text-link"
                                onClick={() => setConfirmSellId(null)}
                                disabled={isThisSelling}
                              >
                                cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="litter-btn"
                              onClick={() => setConfirmSellId(entry.id)}
                            >
                              Sell — {price} pts
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {sellError && <div className="help-text is-pink center-text">{sellError}</div>}
                </div>
              </div>
            )}

            {/* RECENT POINTS */}
            {recentPoints.length > 0 && (
              <div className="points-strip">
                {recentPoints.map((entry) => (
                  <div key={entry.id} className="points-chip">
                    {SOURCE_LABELS[entry.source] ? (
                      <>
                        <Icon name={SOURCE_LABELS[entry.source].icon} size={13} />{" "}
                        {SOURCE_LABELS[entry.source].text}
                      </>
                    ) : (
                      entry.source
                    )}{" "}
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
