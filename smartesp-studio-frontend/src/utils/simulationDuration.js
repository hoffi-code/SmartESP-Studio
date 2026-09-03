// ESPHome-Dauerangaben ("500ms", "5s", "2min", "1h") in Millisekunden. Von
// simulationFilters.js (P4) und simulationConditions.js (P5, "for"-Bedingung) genutzt.
const DURATION_UNIT_MS = { ms: 1, s: 1000, sec: 1000, min: 60000, h: 3600000, hr: 3600000, d: 86400000 };

export const parseDuration = (raw, fallbackMs = 0) => {
  if (typeof raw === "number") return raw;
  const text = String(raw || "").trim();
  if (!text) return fallbackMs;
  const match = /^(-?[\d.]+)\s*([a-zA-Z]*)$/.exec(text);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return fallbackMs;
  const unit = match[2].toLowerCase() || "ms";
  const factor = DURATION_UNIT_MS[unit];
  return factor ? amount * factor : fallbackMs;
};
