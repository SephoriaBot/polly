import { useMemo, useState } from "react";
import { useCreatureGrowth } from "./CreatureGrowthContext";
import { SPECIES, SPECIES_LABELS, allBabiesFor, imageForForm } from "./creatures";
import type { Creature, Species, EvolutionStage } from "./creatures";
import { todayKey, pickDaily } from "../lib/dailyRandom";
import Icon from "../components/Icon";
import ShopkeeperBubble, { type ShopkeeperExpression } from "./ShopkeeperBubble";
import { BREEDER_COST, SOURCE_LABELS, computeSellPrice } from "./useCreatureGrowth";

// A handful of stock greetings, one drawn per day (same pattern as the
// litter itself) so the breeder isn't saying the exact same line on every
// visit but still feels stable within a given day.
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


// Today's litter: every baby across every species, pooled together and
// deterministically shuffled by the calendar date — same pattern as the
// habitat's rotating decor market (see dailyRandom.ts), just seeded with
// a distinct suffix so the two daily draws aren't correlated with each
// other. Resets at local midnight when todayKey() rolls over.
function todaysLitter(): Creature[] {
  const fullPool: Creature[] = SPECIES.flatMap((s) => allBabiesFor(s));
  return pickDaily(`${todayKey()}:breeder`, fullPool, 3);
}

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
  } = useCreatureGrowth();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [confirmSellId, setConfirmSellId] = useState<number | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);

  // Stable for the lifetime of this mount — recomputing on every render
  // would be harmless (same date = same result) but there's no reason to.
  const litter = useMemo(() => todaysLitter(), []);
  const greeting = useMemo(
    () => pickDaily(`${todayKey()}:breeder-greeting`, BREEDER_GREETINGS, 1)[0],
    []
  );

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <ShopkeeperBubble expression="thinking" message="Just checking my ledger..." />
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

  const allAdoptedToday = litter.length > 0 && litter.every((c) => alreadyAdoptedToday(c.id));

  let expression: ShopkeeperExpression = "welcome";
  let keeperMessage = greeting;
  if (justAdopted) {
    expression = "showing";
    keeperMessage = "Welcome home, little one! Take good care of them.";
  } else if (error) {
    expression = "neutral";
    keeperMessage = error;
  } else if (buyingId) {
    expression = "thinking";
    keeperMessage = "Hold on now, let me wrap that up...";
  } else if (allAdoptedToday) {
    expression = "neutral";
    keeperMessage = "That's everyone for today — new litter at midnight.";
  }

  async function handleSell(entryId: number) {
    if (sellingId) return;
    setSellError(null);
    setSellingId(entryId);
    const result = await sellToBreeder(entryId);
    if (!result.ok) {
      setSellError(result.reason || "Couldn't sell that one");
    }
    setSellingId(null);
    setConfirmSellId(null);
  }


  async function handleBuy(species: Species, creature: Creature) {
    if (buyingId) return;
    setError(null);
    setBuyingId(creature.id);
    const result = await buyFromBreeder(species, creature.id);
    if (!result.ok) {
      setError(result.reason || "Couldn't adopt that one");
    }
    setBuyingId(null);
  }

  return (
    <div className="card">
      <div className="card-body">
        <div
          className="section-label"
          style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span>
            <Icon name="shopping-cart" size={16} /> The Breeder
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ink-muted)" }}>{bankPoints} pts</div>
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
                border: "1px solid var(--pink-light)",
                borderRadius: 99,
                background: "var(--blush)",
                cursor: refreshing ? "default" : "pointer",
                opacity: refreshing ? 0.6 : 1,
              }}
            >
              <Icon
                name="icon-recur"
                size={24}
                color="var(--pink-dark)"
                style={refreshing ? { animation: "breederRefreshSpin 0.8s linear infinite" } : undefined}
              />
            </button>
          </div>
        </div>

        <ShopkeeperBubble expression={expression} message={keeperMessage} />

        {justAdopted ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <img
              src={justAdopted.image}
              alt="a new creature you adopted from the breeder"
              style={{ width: 96, height: 96, objectFit: "contain", animation: "adoptPop 0.7s ease" }}
            />
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pink-dark)", marginTop: 6 }}>
              Welcome home! <Icon name="sparkles-cluster" size={16} />
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
            <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 10, textAlign: "center" }}>
              Today's litter — {BREEDER_COST} pts each, new babies at midnight
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {litter.map((creature) => {
                const adopted = alreadyAdoptedToday(creature.id);
                const canAfford = bankPoints >= BREEDER_COST;
                const disabled = adopted || !canAfford || buyingId === creature.id;
                return (
                  <div
                    key={creature.id}
                    style={{
                      width: 96,
                      textAlign: "center",
                      border: "1px solid var(--pink-light)",
                      borderRadius: 14,
                      padding: 8,
                      background: "var(--blush)",
                    }}
                  >
                    <img
                      src={creature.image}
                      alt={`${SPECIES_LABELS[creature.species]} baby`}
                      style={{ width: 64, height: 64, objectFit: "contain" }}
                    />
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-muted)", marginTop: 4 }}>
                      {SPECIES_LABELS[creature.species]}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBuy(creature.species, creature)}
                      disabled={disabled}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: adopted ? "var(--ink-muted)" : "var(--pink-dark)",
                        background: "var(--cream)",
                        border: "1px solid var(--pink-light)",
                        borderRadius: 99,
                        padding: "4px 8px",
                        width: "100%",
                        cursor: disabled ? "default" : "pointer",
                        opacity: buyingId === creature.id ? 0.6 : 1,
                      }}
                    >
                      {adopted ? "Adopted" : buyingId === creature.id ? "..." : `${BREEDER_COST} pts`}
                    </button>
                  </div>
                );
              })}
            </div>

            {error && (
              <div style={{ fontSize: 11, color: "var(--pink-dark)", marginTop: 10, textAlign: "center" }}>
                {error}
              </div>
            )}

            {collection.length > 0 && (
              <div className="card" style={{ marginTop: 14, border: "1px solid var(--pink-light)" }}>
                <div className="card-body">
                  <div className="section-label" style={{ marginBottom: 8 }}>
                    Sell to the Breeder
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 10, textAlign: "center" }}>
                    Price scales with stage and trained stats. Unused training points are lost on sale.
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
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
                        <div
                          key={entry.id}
                          style={{
                            width: 96,
                            textAlign: "center",
                            border: "1px solid var(--pink-light)",
                            borderRadius: 14,
                            padding: 8,
                            background: "var(--blush)",
                          }}
                        >
                          <img
                            src={image}
                            alt={`${SPECIES_LABELS[entry.species]} (${STAGE_LABELS[entry.stage]})`}
                            style={{ width: 64, height: 64, objectFit: "contain" }}
                          />
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-muted)", marginTop: 4 }}>
                            {entry.name || SPECIES_LABELS[entry.species]}
                          </div>
                          <div style={{ fontSize: 9, color: "var(--ink-muted)" }}>{STAGE_LABELS[entry.stage]}</div>

                          {isConfirming ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleSell(entry.id)}
                                disabled={isThisSelling}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "white",
                                  background: "var(--pink-dark)",
                                  border: "none",
                                  borderRadius: 99,
                                  padding: "4px 8px",
                                  cursor: isThisSelling ? "default" : "pointer",
                                }}
                              >
                                {isThisSelling ? "..." : `Confirm (${price} pts)`}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmSellId(null)}
                                disabled={isThisSelling}
                                style={{
                                  fontSize: 10,
                                  color: "var(--ink-muted)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                              >
                                cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmSellId(entry.id)}
                              style={{
                                marginTop: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--pink-dark)",
                                background: "var(--cream)",
                                border: "1px solid var(--pink-light)",
                                borderRadius: 99,
                                padding: "4px 8px",
                                width: "100%",
                                cursor: "pointer",
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
                    <div style={{ fontSize: 11, color: "var(--pink-dark)", marginTop: 10, textAlign: "center" }}>
                      {sellError}
                    </div>
                  )}
                </div>
              </div>
            )}


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
                      background: "var(--blush)",
                      border: "1px solid var(--pink-light)",
                      borderRadius: 99,
                      padding: "4px 10px",
                    }}
                  >
                    {SOURCE_LABELS[entry.source] ? (
                      <>
                        <Icon name={SOURCE_LABELS[entry.source].icon} size={13} /> {SOURCE_LABELS[entry.source].text}
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

        <style>{`
          @keyframes adoptPop {
            0% { transform: scale(0.3); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); }
          }
          @keyframes breederRefreshSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
