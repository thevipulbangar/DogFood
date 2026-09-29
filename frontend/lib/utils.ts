export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Deterministic PRNG so seeded data is identical on server and client. */
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pad = (n: number, width = 3) => String(n).padStart(width, "0");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** All times are rendered in UTC — the event runs on one global clock. */
export function fmtUTC(iso: string, mode: "datetime" | "date" | "time" | "clock" = "datetime") {
  const d = new Date(iso);
  const hh = pad(d.getUTCHours(), 2);
  const mm = pad(d.getUTCMinutes(), 2);
  const ss = pad(d.getUTCSeconds(), 2);
  const date = `${pad(d.getUTCDate(), 2)} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (mode === "date") return date;
  if (mode === "time") return `${hh}:${mm} UTC`;
  if (mode === "clock") return `${hh}:${mm}:${ss}`;
  return `${date} · ${hh}:${mm} UTC`;
}

export function relativeTime(fromMs: number, toMs: number) {
  const s = Math.max(0, Math.round((toMs - fromMs) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

export function splitDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(t / 86400),
    hours: Math.floor((t % 86400) / 3600),
    minutes: Math.floor((t % 3600) / 60),
    seconds: t % 60,
  };
}

export function hms(ms: number) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  return `${pad(days * 24 + hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`;
}

/** Client-side CSV export — works fully offline. */
export function downloadCSV(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
