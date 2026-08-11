// MoonWidget.tsx
// Trimmed-down replacement for the old DailyAlmanac card. Per the Tier 1
// "Today" rework, the herb-of-the-day / holiday / Groq note pieces were cut —
// only the moon phase and zodiac sign survive, since those are the parts
// worth keeping on the home screen. Both are pure date math (see almanac.ts),
// so this widget renders synchronously with no Supabase call and no caching.

import Icon from "./Icon";
import {
  getMoonPhase,
  getMoonSign,
  MOON_ICON_BY_PHASE,
  ZODIAC_ICON_BY_SIGN,
} from "../lib/almanac";

export default function MoonWidget() {
  const now = new Date();
  const moon = getMoonPhase(now);
  const moonSign = getMoonSign(now);

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Icon name="moon-cloud" size={16} /> Tonight's Sky
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon
              name={(MOON_ICON_BY_PHASE[moon.phaseName] ?? "moon-cloud") as import("./Icon").IconName}
              size={60}
              alt={moon.phaseName}
            />
            <div>
              <div style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Moon
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-dark)" }}>
                {moon.phaseName} · {moon.illuminationPct}%
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon
              name={(ZODIAC_ICON_BY_SIGN[moonSign.sign] ?? "sparkle-single") as import("./Icon").IconName}
              size={60}
              alt={moonSign.sign}
            />
            <div>
              <div style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Moon in
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-dark)" }}>
                {moonSign.sign}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                {moonSign.gardenDayType}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
