"use client";
import { type ReactNode } from "react";

export type TipState = { x: number; y: number; content: ReactNode } | null;

/** Floating glass tooltip, positioned inside its chart's relative container. */
export function Tooltip({ tip, width = 240 }: { tip: TipState; width?: number }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="g-float pointer-events-none absolute z-30"
      style={{
        left: tip.x, top: tip.y, width,
        transform: "translate(-50%, calc(-100% - 14px))",
        padding: "10px 12px", borderRadius: 16,
      }}
    >
      {tip.content}
    </div>
  );
}

export function TipRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[12px] leading-5">
      <span className="flex items-center gap-1.5 min-w-0" style={{ color: "var(--ink-2)" }}>
        {color && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2.5, background: color, flexShrink: 0 }} />}
        <span className="truncate">{label}</span>
      </span>
      <span className="num shrink-0" style={{ color: "var(--ink)", fontWeight: 550 }}>{value}</span>
    </div>
  );
}
