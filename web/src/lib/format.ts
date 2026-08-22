const nf = new Intl.NumberFormat("en-US");

export const n = (v: number) => nf.format(Math.round(v));

/** 12,526,635 -> "12.5M" — for hero numbers and axis ticks only; tables show exact. */
export function compact(v: number, digits = 1): string {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(digits) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(digits) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e5 ? 0 : digits) + "k";
  return String(Math.round(v));
}

export const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;

/** Real backends legitimately report a metric as null when it wasn't measurable
 *  (an abstained probe, an empty aggregate). Render that as "—", never as 0. */
export const fx = (v: number | null | undefined, digits = 2): string =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";

export function bytes(v: number): string {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export function ago(epochSeconds: number): string {
  const s = Date.now() / 1000 - epochSeconds;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Long MCP tool names are unreadable in a legend; keep the distinguishing tail. */
export function shortTool(name: string): string {
  if (!name.startsWith("mcp__")) return name;
  const parts = name.split("__");
  return `${parts[1]?.replace(/-/g, " ") ?? ""} · ${parts[2] ?? ""}`;
}

export const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];
export const SEQ = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];

/** Sequential ramp step for a 0..1 magnitude. */
export const seqStep = (t: number) => SEQ[Math.min(SEQ.length - 1, Math.max(0, Math.floor(t * SEQ.length)))];
