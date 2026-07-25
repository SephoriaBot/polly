// DailyAlmanac.tsx
// Self-contained Dashboard card. One row per calendar date is cached in
// Supabase (daily_almanac) so the Groq call only ever happens once per day,
// no matter how many times the app is opened.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import Icon from "../components/Icon";
import {
  getMoonPhase,
  getMoonSign,
  getHerbOfDay,
  fetchTodaysHolidayUS,
  buildAlmanacPrompt,
  generateAlmanacNote,
} from "../lib/almanac";

interface AlmanacRow {
  almanac_date: string;
  moon_phase: string;
  moon_illumination: number;
  moon_sign: string;
  garden_day_type: string;
  herb_name: string;
  herb_lore: string;
  holiday: string | null;
  almanac_note: string;
}

// Maps the phase names produced by getMoonPhase() to the filenames uploaded
// into public/icons/ (moon-new.png, moon-waxing-crescent.png, etc).
const MOON_ICON_BY_PHASE: Record<string, string> = {
  "New Moon": "moon-new",
  "Waxing Crescent": "moon-waxing-crescent",
  "First Quarter": "moon-first-quarter",
  "Waxing Gibbous": "moon-waxing-gibbous",
  "Full Moon": "moon-full",
  "Waning Gibbous": "moon-waning-gibbous",
  "Last Quarter": "moon-last-quarter",
  "Waning Crescent": "moon-waning-crescent",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyAlmanac() {
  const [entry, setEntry] = useState<AlmanacRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dateKey = todayISO();

      const { data: existing } = await supabase
        .from("daily_almanac")
        .select("*")
        .eq("almanac_date", dateKey)
        .maybeSingle();

      if (existing) {
        setEntry(existing as AlmanacRow);
        setLoading(false);
        return;
      }

      const now = new Date();
      const moon = getMoonPhase(now);
      const moonSign = getMoonSign(now);
      const herb = getHerbOfDay(now);
      const holiday = await fetchTodaysHolidayUS(now);

      const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      let note = "";
      try {
        note = await generateAlmanacNote(
          buildAlmanacPrompt({ dateLabel, moon, moonSign, herb, holiday })
        );
      } catch {
        note = `${moon.phaseName} tonight, ${moon.illuminationPct}% lit, moon in ${moonSign.sign} — a ${moonSign.gardenDayType.toLowerCase()}.`;
      }

      const row: AlmanacRow = {
        almanac_date: dateKey,
        moon_phase: moon.phaseName,
        moon_illumination: moon.illuminationPct,
        moon_sign: moonSign.sign,
        garden_day_type: moonSign.gardenDayType,
        herb_name: herb.name,
        herb_lore: herb.lore,
        holiday,
        almanac_note: note,
      };

      await supabase.from("daily_almanac").upsert(row);
      setEntry(row);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
          consulting the almanac...
        </div>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Icon name="moon-cloud" size={16} /> Today's Almanac
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon
              name={(MOON_ICON_BY_PHASE[entry.moon_phase] ?? "moon-cloud") as any}
              size={60}
              alt={entry.moon_phase}
            />
            <div>
              <div style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Moon
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-dark)" }}>
                {entry.moon_phase} · {entry.moon_illumination}%
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Moon in
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-dark)" }}>
              {entry.moon_sign} — {entry.garden_day_type}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)", fontStyle: "italic", marginBottom: 10 }}>
          "{entry.almanac_note}"
        </div>

        <div
          style={{
            borderTop: "1px dashed var(--border)",
            paddingTop: 8,
            fontSize: 11.5,
            color: "var(--ink-muted)",
          }}
        >
          <strong style={{ color: "var(--pink-dark)" }}>{entry.herb_name}</strong> — {entry.herb_lore}
        </div>

        {entry.holiday && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-muted)" }}>
            <Icon name="sparkle-single" size={12} /> {entry.holiday}
          </div>
        )}
      </div>
    </div>
  );
}
