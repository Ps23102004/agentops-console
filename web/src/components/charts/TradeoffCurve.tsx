"use client";

import { useState } from "react";
import { Tooltip, TipRow, type TipState } from "./Tooltip";
import { compact, n, pct, shortTool } from "@/lib/format";

export type CurvePoint = { label: string; savings: number; fidelity: number; tokens: number; note: string };

const PAD = { l: 50, r: 24, t: 22, b: 42 };
const W = 760, H = 320;
const LABEL_INSET = 9; // % — keeps long tool names off both plot edges

/**
 * Savings against fidelity, one bubble per tool, area proportional to the tokens
 * at stake. The frontier traces the tools nothing else beats on both axes — the
 * curve you are actually choosing a point on. Everything under the dashed line
 * buys its savings by dropping facts.
 */
export function TradeoffCurve({ points, floor = 0.95 }: { points: CurvePoint[]; floor?: number }) {
  const [tip, setTip] = useState<TipState>(null);
  const [hover, setHover] = useState<string | null>(null);
  if (!points.length) return null;

  const yLo = Math.min(floor - 0.03, ...points.map((p) => p.fidelity)) - 0.008;
  const px = (s: number) => PAD.l + (s / 100) * (W - PAD.l - PAD.r);
  const py = (f: number) => H - PAD.b - ((f - yLo) / (1.004 - yLo)) * (H - PAD.t - PAD.b);
  const maxTok = Math.max(...points.map((p) => p.tokens));
  const r = (t: number) => 7 + Math.sqrt(t / maxTok) * 30;

  // pareto frontier: keep a point only if nothing saves more AND keeps more
  const frontier = [...points]
    .sort((a, b) => a.savings - b.savings)
    .filter((p) => !points.some((q) => q !== p && q.savings >= p.savings && q.fidelity >= p.fidelity));
  const best = points.reduce((a, b) => (b.tokens > a.tokens ? b : a));

  return (
    <div className="relative" style={{ overflowX: "clip" }} onMouseLeave={() => { setTip(null); setHover(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
        aria-label={`Savings against fidelity for ${points.length} tools. ${points.map((p) => `${p.label}: ${pct(p.savings)} saved at fidelity ${p.fidelity.toFixed(3)}`).join("; ")}`}>

        <rect x={PAD.l} y={py(floor)} width={W - PAD.l - PAD.r} height={H - PAD.b - py(floor)} fill="var(--crit-wash)" rx="6" />
        <line x1={PAD.l} x2={W - PAD.r} y1={py(floor)} y2={py(floor)} stroke="var(--crit)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.85" />
        <text x={PAD.l + 8} y={py(floor) + 15} fontSize="10.5" fill="var(--crit)" style={{ fontFamily: "var(--font-mono)" }}>
          below the {floor.toFixed(2)} fidelity floor
        </text>

        {[0, 25, 50, 75, 100].map((s) => (
          <g key={s}>
            <line x1={px(s)} x2={px(s)} y1={PAD.t} y2={H - PAD.b} stroke="var(--grid)" strokeWidth="1" />
            <text x={px(s)} y={H - PAD.b + 17} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)" }}>{s}%</text>
          </g>
        ))}
        {[yLo + (1 - yLo) * 0.02, floor, 1].map((f, i) => (
          <text key={i} x={PAD.l - 9} y={py(f) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)" }}>
            {f.toFixed(2)}
          </text>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>TOKENS REMOVED →</text>
        <text transform={`rotate(-90 13 ${PAD.t + 66})`} x="13" y={PAD.t + 66} fontSize="10" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>FIDELITY →</text>

        <path
          d={frontier.map((p, i) => `${i ? "L" : "M"}${px(p.savings).toFixed(1)} ${py(p.fidelity).toFixed(1)}`).join(" ")}
          fill="none" stroke="var(--cat-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
        />

        {points.map((p) => {
          const on = hover === p.label;
          const safe = p.fidelity >= floor;
          return (
            <g key={p.label}>
              <circle
                cx={px(p.savings)} cy={py(p.fidelity)} r={r(p.tokens)}
                fill={`color-mix(in oklab, ${safe ? "var(--cat-1)" : "var(--cat-5)"} ${on ? 46 : 28}%, transparent)`}
                stroke={safe ? "var(--cat-1)" : "var(--cat-5)"} strokeWidth="1.75"
                style={{ transition: "fill 180ms var(--ease)" }}
              />
              <circle cx={px(p.savings)} cy={py(p.fidelity)} r="2.5" fill={safe ? "var(--cat-1)" : "var(--cat-5)"} />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0">
        {points.map((p) => (
          <span key={`l-${p.label}`}>
            <button
              aria-label={`${p.label}: ${pct(p.savings)} of its tokens removed, fidelity ${p.fidelity.toFixed(3)}, ${n(p.tokens)} original tokens`}
              className="absolute rounded-full"
              style={{
                left: `${(px(p.savings) / W) * 100}%`, top: `${(py(p.fidelity) / H) * 100}%`,
                width: Math.max(38, r(p.tokens) * 2), height: Math.max(38, r(p.tokens) * 2),
                transform: "translate(-50%,-50%)", background: "transparent", border: 0, cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                setHover(p.label);
                const b = e.currentTarget.parentElement!.getBoundingClientRect();
                setTip({
                  x: Math.min(b.width - 130, Math.max(130, (px(p.savings) / W) * b.width)),
                  y: Math.max(96, (py(p.fidelity) / H) * b.height - r(p.tokens)),
                  content: (
                    <>
                      <p className="num text-[11.5px] mb-1.5 break-all" style={{ fontWeight: 570 }}>{p.label}</p>
                      <TipRow label="Tokens removed" value={pct(p.savings)} color="var(--cat-1)" />
                      <TipRow label="Fidelity" value={p.fidelity.toFixed(3)} />
                      <TipRow label="At stake" value={`${compact(p.tokens)} tok`} />
                      <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: "var(--ink-2)" }}>{p.note}</p>
                    </>
                  ),
                });
              }}
              onFocus={() => setHover(p.label)}
              onBlur={() => setHover(null)}
            />
            <span
              className="absolute num text-[10.5px] pointer-events-none whitespace-nowrap"
              style={{
                // clamp inside the plot so a wide label near an edge never clips
                left: `clamp(${LABEL_INSET}%, ${(px(p.savings) / W) * 100}%, ${100 - LABEL_INSET}%)`,
                // offset in viewBox units, not CSS px — the svg scales with the container
                top: `calc(${((py(p.fidelity) - r(p.tokens)) / H) * 100}% - 7px)`,
                transform: "translate(-50%, -100%)",
                color: hover === p.label ? "var(--ink)" : "var(--ink-2)",
                fontWeight: 530,
              }}
            >
              {shortTool(p.label)}
            </span>
          </span>
        ))}
      </div>

      <Tooltip tip={tip} width={252} />
      <p className="text-[12.5px] mt-3 leading-relaxed" style={{ color: "var(--ink-2)" }}>
        Bubble area is the tokens at stake.{" "}
        <strong style={{ fontWeight: 560, color: "var(--ink)" }}>{shortTool(best.label)}</strong> holds{" "}
        {compact(best.tokens)} of them — which is why the whole session&apos;s fidelity follows that one bubble, wherever it lands.
      </p>
    </div>
  );
}
