// MoonWidget.tsx
// Trimmed-down replacement for the old DailyAlmanac card. Per the Tier 1
// "Today" rework, the herb-of-the-day / holiday / Groq note pieces were cut,
// and the zodiac sign was later dropped too — only the moon phase remains.
// It's pure date math (see almanac.ts), so this widget renders synchronously
// with no Supabase call and no caching.

import Icon from "./Icon";
import { getMoonPhase, MOON_ICON_BY_PHASE } from "../lib/almanac";

export default function MoonWidget({ compact = false }: { compact?: boolean }) {
  const now = new Date();
  const moon = getMoonPhase(now);
  const iconName = (MOON_ICON_BY_PHASE[moon.phaseName] ?? "moon-cloud") as import("./Icon").IconName;

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Icon name={iconName} size={32} alt={moon.phaseName} />
        <div>
          <div style={{ fontSize: 9, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Moon
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-dark)", whiteSpace: "nowrap" }}>
            {moon.phaseName} · {moon.illuminationPct}%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Icon name="moon-cloud" size={16} /> Tonight's Sky
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={iconName} size={60} alt={moon.phaseName} />
          <div>
            <div style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Moon
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-dark)" }}>
              {moon.phaseName} · {moon.illuminationPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
