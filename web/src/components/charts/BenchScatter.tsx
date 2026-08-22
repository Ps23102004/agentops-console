"use client";

import { useState } from "react";
import { Tooltip, TipRow, type TipState } from "./Tooltip";
import type { BenchRow } from "@/lib/types";
import { fx, n } from "@/lib/format";

const PAD = { l: 52, r: 26, t: 22, b: 44 };
const W = 720, H = 340;

/* Three backends -> the first three categorical slots, which validate all-pairs
   in both modes (scatter needs every pair separable, not just neighbours). */
const COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)"];

/**
 * Recall against freshness. Up-and-right is the corner nothing reaches — which
 * IS the finding: every backend trades one for the other.
 */
export function BenchScatter({ rows }: { rows: BenchRow[] }) {
  const [tip, setTip] = useState<TipState>(null);
  const [hover, setHover] = useState<string | null>(null);

  // staleness@1 null means the backend abstained — plotting that as freshness=1
  // would show it landing in the "nothing here yet" corner as if perfectly fresh.
  const plottable = rows.filter((r): r is BenchRow & { "staleness@1": number } => typeof r["staleness@1"] === "number");
  const omitted = rows.length - plottable.length;

  const px = (v: number) => PAD.l + ((v - 0.6) / 0.42) * (W - PAD.l - PAD.r);
  const py = (v: number) => H - PAD.b - (v / 1.02) * (H - PAD.t - PAD.b);

  return (
    <div className="relative" style={{ overflowX: "clip" }} onMouseLeave={() => { setTip(null); setHover(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
        aria-label={`Recall against freshness for ${plottable.length} memory backends. ${plottable.map((r) => `${r.backend}: recall ${r["recall@k"]}, freshness ${(1 - r["staleness@1"]).toFixed(3)}`).join("; ")}`}>
        {/* the corner nobody occupies */}
        <rect x={px(0.95)} y={py(1.0)} width={W - PAD.r - px(0.95)} height={py(0.9) - py(1.0)}
          fill="var(--ok-wash)" rx="8" />
        <text x={W - PAD.r - 8} y={py(0.955)} textAnchor="end" fontSize="10.5" fill="var(--ok)" style={{ fontFamily: "var(--font-mono)" }}>
          nothing here yet
        </text>

        {[0.6, 0.7, 0.8, 0.9, 1.0].map((v) => (
          <g key={`x${v}`}>
            <line x1={px(v)} x2={px(v)} y1={PAD.t} y2={H - PAD.b} stroke="var(--grid)" strokeWidth="1" />
            <text x={px(v)} y={H - PAD.b + 17} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)" }}>{v.toFixed(1)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
          <g key={`y${v}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} stroke="var(--grid)" strokeWidth="1" />
            <text x={PAD.l - 10} y={py(v) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)" }}>{v.toFixed(2)}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>RECALL@K →</text>
        <text transform={`rotate(-90 14 ${PAD.t + 96})`} x="14" y={PAD.t + 96} fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>FRESHNESS (1 − STALENESS@1) →</text>

        {plottable.map((r, i) => {
          const x = px(r["recall@k"]), y = py(1 - r["staleness@1"]);
          const on = hover === r.backend;
          return (
            <g key={r.backend}>
              {/* drop to each axis so the pair of coordinates is readable, not guessed */}
              <line x1={x} x2={x} y1={y} y2={H - PAD.b} stroke={COLORS[i]} strokeWidth="1" strokeDasharray="2 4" opacity={on ? 0.7 : 0.28} />
              <line x1={PAD.l} x2={x} y1={y} y2={y} stroke={COLORS[i]} strokeWidth="1" strokeDasharray="2 4" opacity={on ? 0.7 : 0.28} />
              <circle cx={x} cy={y} r={on ? 12 : 9} fill={COLORS[i]} stroke="var(--viz-surface)" strokeWidth="2.5"
                style={{ transition: "r 200ms var(--spring)" }} />
              <text x={x + 16} y={y + 4} fontSize="12.5" fill="var(--ink)" style={{ fontWeight: 560 }}>{r.backend}</text>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0">
        {plottable.map((r) => (
          <button
            key={r.backend}
            aria-label={`${r.backend}: recall ${r["recall@k"]}, staleness ${r["staleness@1"]}, leak rate ${r["leak_rate@k"] ?? "not measurable"}`}
            className="absolute rounded-full"
            style={{
              left: `${(px(r["recall@k"]) / W) * 100}%`, top: `${(py(1 - r["staleness@1"]) / H) * 100}%`,
              width: 40, height: 40, transform: "translate(-50%,-50%)", background: "transparent", border: 0, cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              setHover(r.backend);
              const b = e.currentTarget.parentElement!.getBoundingClientRect();
              setTip({
                x: Math.min(b.width - 130, Math.max(130, (px(r["recall@k"]) / W) * b.width)),
                y: (py(1 - r["staleness@1"]) / H) * b.height,
                content: (
                  <>
                    <p className="text-[12.5px] mb-1.5" style={{ fontWeight: 570 }}>{r.backend}</p>
                    <TipRow label="recall@k" value={r["recall@k"].toFixed(3)} />
                    <TipRow label="precision@k" value={r["precision@k"].toFixed(3)} />
                    <TipRow label="staleness@1" value={r["staleness@1"].toFixed(3)} />
                    <TipRow label="leak_rate@k" value={fx(r["leak_rate@k"], 3)} />
                    <TipRow label="tokens/query" value={n(r.tokens_per_query)} />
                  </>
                ),
              });
            }}
            onFocus={() => setHover(r.backend)}
            onBlur={() => setHover(null)}
          />
        ))}
      </div>
      <Tooltip tip={tip} width={244} />
      {omitted > 0 && (
        <p className="text-[11.5px] mt-2" style={{ color: "var(--ink-3)" }}>
          {omitted} backend{omitted === 1 ? "" : "s"} not plotted: staleness not measurable.
        </p>
      )}
    </div>
  );
}
