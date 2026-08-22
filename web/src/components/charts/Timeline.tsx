"use client";

import { useMemo, useRef, useState } from "react";
import { Tooltip, TipRow, type TipState } from "./Tooltip";
import { compact, n } from "@/lib/format";
import type { TimelinePoint } from "@/lib/types";

const PAD = { l: 52, r: 16, t: 16, b: 26 };

/**
 * Cumulative context growth against what the cache absorbed. Both series are
 * tokens, so they share one axis — never a second scale.
 */
export function Timeline({ points, height = 240 }: { points: TimelinePoint[]; height?: number }) {
  const [tip, setTip] = useState<TipState>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = 900, H = height;

  const { max, path, cachePath, area, ticks } = useMemo(() => {
    const max = Math.max(...points.map((p) => p.cum_est_tokens), 1);
    const iMax = Math.max(...points.map((p) => p.i), 1);
    const px = (i: number) => PAD.l + (i / iMax) * (W - PAD.l - PAD.r);
    const py = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
    const path = points.map((p, k) => `${k ? "L" : "M"}${px(p.i).toFixed(1)} ${py(p.cum_est_tokens).toFixed(1)}`).join(" ");
    // cache_read is null wherever the transcript event carried no cache-read figure —
    // break the line there instead of drawing through a fabricated zero.
    let cacheStarted = false;
    const cachePath = points
      .map((p) => {
        if (p.cache_read == null) { cacheStarted = false; return ""; }
        const seg = `${cacheStarted ? "L" : "M"}${px(p.i).toFixed(1)} ${py(p.cache_read).toFixed(1)}`;
        cacheStarted = true;
        return seg;
      })
      .filter(Boolean)
      .join(" ");
    const area = `${path} L${px(points[points.length - 1]?.i ?? 0).toFixed(1)} ${H - PAD.b} L${PAD.l} ${H - PAD.b} Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: py(max * f) }));
    return { max, path, cachePath, area, ticks, px, py };
  }, [points, H]);

  const iMax = Math.max(...points.map((p) => p.i), 1);

  const onMove = (e: React.MouseEvent) => {
    const b = box.current!.getBoundingClientRect();
    const rel = (e.clientX - b.left) / b.width;
    const svgX = rel * W;
    if (svgX < PAD.l) return;
    const i = ((svgX - PAD.l) / (W - PAD.l - PAD.r)) * iMax;
    let best = points[0];
    for (const p of points) if (Math.abs(p.i - i) < Math.abs(best.i - i)) best = p;
    setHoverX(PAD.l + (best.i / iMax) * (W - PAD.l - PAD.r));
    setTip({
      x: Math.min(b.width - 118, Math.max(118, rel * b.width)),
      y: 88,
      content: (
        <>
          <p className="eyebrow mb-1.5">message {best.i}</p>
          <TipRow label="Context so far" value={`${n(best.cum_est_tokens)} tok`} color="var(--cat-1)" />
          <TipRow label="Absorbed by cache" value={best.cache_read == null ? "—" : `${n(best.cache_read)} tok`} color="var(--cat-3)" />
        </>
      ),
    });
  };

  return (
    <div className="relative" ref={box} onMouseLeave={() => { setTip(null); setHoverX(null); }} onMouseMove={onMove}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
        aria-label={`Cumulative context growth over ${iMax} messages, peaking at ${n(max)} estimated tokens`}>
        <defs>
          <linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cat-1)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--cat-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--grid)" strokeWidth="1" />
            <text x={PAD.l - 10} y={t.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--ink-3)"
              style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              {compact(t.v)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#tl-fill)" />
        <path d={cachePath} fill="none" stroke="var(--cat-3)" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4" />
        <path d={path} fill="none" stroke="var(--cat-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hoverX !== null && (
          <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} stroke="var(--hairline-strong)" strokeWidth="1" />
        )}
        <text x={PAD.l} y={H - 8} fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)" }}>msg 0</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="10.5" fill="var(--ink-3)" style={{ fontFamily: "var(--font-mono)" }}>msg {iMax}</text>
      </svg>
      <Tooltip tip={tip} width={228} />
      <ul className="flex gap-5 mt-2 text-[12px]">
        <li className="flex items-center gap-2"><span aria-hidden style={{ width: 14, height: 2, borderRadius: 2, background: "var(--cat-1)" }} /><span style={{ color: "var(--ink-2)" }}>Cumulative context</span></li>
        <li className="flex items-center gap-2"><span aria-hidden style={{ width: 14, height: 2, borderRadius: 2, background: "var(--cat-3)", opacity: 0.9, backgroundImage: "repeating-linear-gradient(90deg,var(--cat-3) 0 4px,transparent 4px 7px)" }} /><span style={{ color: "var(--ink-2)" }}>Absorbed by cache</span></li>
      </ul>
    </div>
  );
}
