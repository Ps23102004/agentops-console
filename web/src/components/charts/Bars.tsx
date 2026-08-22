"use client";

import { useState } from "react";
import { Tooltip, TipRow, type TipState } from "./Tooltip";

export type Bar = { label: string; value: number; display: string; color?: string; note?: string };

/** Horizontal magnitude bars: 4px rounded data end, anchored to a shared baseline. */
export function Bars({ bars, max, unit }: { bars: Bar[]; max?: number; unit?: string }) {
  const [tip, setTip] = useState<TipState>(null);
  const top = max ?? Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="relative space-y-2.5" onMouseLeave={() => setTip(null)}>
      {bars.map((b) => (
        <div
          key={b.label}
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: "minmax(0,10rem) 1fr auto" }}
          onMouseMove={(e) => {
            const box = e.currentTarget.parentElement!.getBoundingClientRect();
            setTip({
              x: Math.min(box.width - 110, Math.max(110, e.clientX - box.left)),
              y: e.clientY - box.top,
              content: (
                <>
                  <p className="num text-[11.5px] mb-1.5 break-all" style={{ fontWeight: 560 }}>{b.label}</p>
                  <TipRow label={unit ?? "value"} value={b.display} color={b.color ?? "var(--cat-1)"} />
                  {b.note && <p className="text-[11.5px] mt-1 leading-snug" style={{ color: "var(--ink-2)" }}>{b.note}</p>}
                </>
              ),
            });
          }}
        >
          <span className="text-[12.5px] truncate" style={{ color: "var(--ink-2)" }}>{b.label}</span>
          <div style={{ height: 10, background: "color-mix(in oklab, var(--ink) 7%, transparent)", borderRadius: 5 }}>
            <div
              style={{
                width: `${Math.max(1.5, (b.value / top) * 100)}%`, height: "100%",
                background: b.color ?? "var(--cat-1)",
                borderRadius: "5px 4px 4px 5px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
                transition: "width 420ms var(--spring)",
              }}
            />
          </div>
          <span className="num text-[12px] tabular-nums" style={{ color: "var(--ink)" }}>{b.display}</span>
        </div>
      ))}
      <Tooltip tip={tip} width={230} />
    </div>
  );
}
