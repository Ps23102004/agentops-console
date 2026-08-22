"use client";

import { useMemo, useState } from "react";
import { Tooltip, TipRow, type TipState } from "./Tooltip";
import { compact, n, pct, shortTool } from "@/lib/format";

export type Tile = { name: string; value: number; sub?: string; count?: number };
type Rect = Tile & { x: number; y: number; w: number; h: number };

/* --- squarified treemap (Bruls/Huizing/van Wijk) --- */
function squarify(items: Tile[], W: number, H: number): Rect[] {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const scaled = items.map((i) => ({ ...i, area: (i.value / total) * W * H }));
  const out: Rect[] = [];
  let x = 0, y = 0, w = W, h = H;
  let row: typeof scaled = [];

  const worst = (r: typeof scaled, side: number) => {
    const sum = r.reduce((s, i) => s + i.area, 0);
    const max = Math.max(...r.map((i) => i.area));
    const min = Math.min(...r.map((i) => i.area));
    const s2 = sum * sum, side2 = side * side;
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  };

  const layout = (r: typeof scaled) => {
    const sum = r.reduce((s, i) => s + i.area, 0);
    const vertical = w >= h;
    const thick = sum / (vertical ? h : w);
    let off = 0;
    for (const i of r) {
      const len = i.area / thick;
      out.push(vertical
        ? { ...i, x, y: y + off, w: thick, h: len }
        : { ...i, x: x + off, y, w: len, h: thick });
      off += len;
    }
    if (vertical) { x += thick; w -= thick; } else { y += thick; h -= thick; }
  };

  for (const it of scaled) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, it], side) <= worst(row, side)) row.push(it);
    else { layout(row); row = [it]; }
  }
  if (row.length) layout(row);
  return out;
}

/**
 * The signature view: every tool's context footprint as a physical pane of glass.
 * Tile area is the share; the pane's blur and fill depth ride the same magnitude,
 * so the worst offender is literally the thickest, heaviest slab on the screen.
 */
export function Treemap({
  tiles, height = 380, unit = "est. tokens", scaleMax, shareOf,
}: { tiles: Tile[]; height?: number; unit?: string; scaleMax?: number; shareOf?: number }) {
  const [tip, setTip] = useState<TipState>(null);
  const W = 1000, H = 1000 * (height / 900);
  const rects = useMemo(() => squarify([...tiles].sort((a, b) => b.value - a.value), W, H), [tiles, H]);
  // shares stay relative to the whole run even when a subset is drawn, and the
  // colour ramp keeps the global scale so a slice is never recoloured brighter
  const total = shareOf ?? (tiles.reduce((s, t) => s + t.value, 0) || 1);
  const max = scaleMax ?? (Math.max(...tiles.map((t) => t.value)) || 1);

  return (
    <div
      className="relative w-full"
      style={{ height, borderRadius: 18, overflow: "hidden" }}
      onMouseLeave={() => setTip(null)}
      role="img"
      aria-label={`Context footprint by tool. ${rects.map((r) => `${r.name} ${pct((r.value / total) * 100)}`).join(", ")}`}
    >
      {rects.map((r) => {
        const share = (r.value / total) * 100;
        const t = r.value / max;
        const big = r.w / W > 0.26 && r.h / H > 0.2;
        const mid = r.w / W > 0.085 && r.h / H > 0.085;
        return (
          <div
            key={r.name}
            className="absolute group"
            style={{
              left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%`,
              width: `calc(${(r.w / W) * 100}% - 3px)`, height: `calc(${(r.h / H) * 100}% - 3px)`,
              borderRadius: big ? 18 : mid ? 13 : 8,
              // glass, not paint: the fill stays a tint so the aurora still shows through
              background: `color-mix(in oklab, var(--tile-tint) ${8 + t * 26}%, transparent)`,
              WebkitBackdropFilter: `blur(${8 + t * 26}px) saturate(${140 + t * 90}%)`,
              backdropFilter: `blur(${8 + t * 26}px) saturate(${140 + t * 90}%)`,
              border: "1px solid color-mix(in oklab, var(--glass-raised-edge) 70%, transparent)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.18 + t * 0.3}), 0 ${2 + t * 10}px ${8 + t * 26}px -6px rgba(0,0,0,${0.18 + t * 0.28})`,
              transition: "transform 220ms var(--spring)",
            }}
            onMouseMove={(e) => {
              const box = e.currentTarget.parentElement!.getBoundingClientRect();
              setTip({
                x: Math.min(box.width - 130, Math.max(130, e.clientX - box.left)),
                y: Math.max(96, e.clientY - box.top),
                content: (
                  <>
                    <p className="num text-[11.5px] mb-1.5 break-all" style={{ fontWeight: 570 }}>{r.name}</p>
                    <TipRow label="Share of tool output" value={pct(share)} color="var(--tile-tint)" />
                    <TipRow label={unit} value={n(r.value)} />
                    {r.count !== undefined && <TipRow label="Calls" value={n(r.count)} />}
                    {r.sub && <TipRow label="Mean per call" value={r.sub} />}
                  </>
                ),
              });
            }}
          >
            {(big || mid) && (
              <div className={`absolute inset-0 ${big ? "p-4 sm:p-5" : "p-2.5"} flex flex-col justify-between gap-1 pointer-events-none`}>
                <p
                  className={`${big ? "text-[13px]" : "text-[11px]"} leading-tight`}
                  style={{ fontWeight: 570, color: "var(--ink)", textWrap: "balance" }}
                >
                  {shortTool(r.name)}
                </p>
                <p
                  className="num leading-none"
                  style={{
                    fontSize: big ? 46 : 14, fontWeight: 560, letterSpacing: "-0.03em", color: "var(--ink)",
                    // a short tile has room for the name or the number, not both
                    display: !big && r.h / H < 0.16 ? "none" : "block",
                  }}
                >
                  {pct(share, share >= 10 ? 1 : 2)}
                  {big && (
                    <span className="block num mt-2" style={{ fontSize: 12, fontWeight: 460, letterSpacing: 0, color: "var(--ink-2)" }}>
                      {compact(r.value)} {unit}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        );
      })}
      <Tooltip tip={tip} width={252} />
    </div>
  );
}
