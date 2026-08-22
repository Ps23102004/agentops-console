"use client";
import { useState } from "react";
import { Tooltip, TipRow, type TipState } from "./Tooltip";
import { compact, n, pct } from "@/lib/format";

export type Seg = { label: string; value: number; pct: number; color: string; count?: number };

/**
 * One continuous composition bar. Segments carry a 2px surface gap so adjacent
 * fills never touch, and the leading segments are direct-labelled.
 */
export function Ribbon({ segments, height = 46 }: { segments: Seg[]; height?: number }) {
  const [tip, setTip] = useState<TipState>(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="relative">
      <div
        className="flex w-full overflow-hidden"
        style={{ height, borderRadius: 14, gap: 2, background: "transparent" }}
        role="img"
        aria-label={`Context composition: ${segments.map((s) => `${s.label} ${pct(s.pct)}`).join(", ")}`}
        onMouseLeave={() => setTip(null)}
      >
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="relative min-w-0 transition-transform"
            style={{
              flex: `${(s.value / total) * 100} 0 0`,
              background: s.color,
              borderRadius: i === 0 ? "14px 4px 4px 14px" : i === segments.length - 1 ? "4px 14px 14px 4px" : 4,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.28)",
            }}
            onMouseMove={(e) => {
              const box = e.currentTarget.parentElement!.getBoundingClientRect();
              setTip({
                x: e.clientX - box.left, y: 0,
                content: (
                  <>
                    <p className="text-[12px] mb-1.5" style={{ fontWeight: 570 }}>{s.label}</p>
                    <TipRow label="Share of context" value={pct(s.pct)} color={s.color} />
                    <TipRow label="Est. tokens" value={n(s.value)} />
                    {s.count !== undefined && <TipRow label="Messages" value={n(s.count)} />}
                  </>
                ),
              });
            }}
          >
          </div>
        ))}
      </div>
      <Tooltip tip={tip} width={230} />
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]">
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
            <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
            <span className="num" style={{ color: "var(--ink)", fontWeight: 550 }}>{pct(s.pct)}</span>
            <span className="num" style={{ color: "var(--ink-3)" }}>{compact(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
