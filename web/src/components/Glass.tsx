"use client";

import { type ReactNode } from "react";

/* --- depth tiers -------------------------------------------------- */

export function Panel({
  tier = "raised", children, className = "", pad = true, id,
}: {
  tier?: "base" | "raised" | "float";
  children: ReactNode; className?: string; pad?: boolean; id?: string;
}) {
  return (
    <section id={id} className={`g-${tier} ${pad ? "p-5 sm:p-6" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function PanelHead({
  engine, title, note, right,
}: { engine: string; title: string; note?: string; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        {/* the eyebrow names the engine that produced the panel — real provenance, not decoration */}
        <p className="eyebrow mb-1.5">{engine}</p>
        <h2 className="h2">{title}</h2>
        {note && <p className="text-[13px] leading-snug mt-1.5 max-w-prose" style={{ color: "var(--ink-2)" }}>{note}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

/* --- states ------------------------------------------------------- */

export function Shimmer({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`shimmer ${className}`} style={style} aria-hidden />;
}

export function PanelSkeleton({ lines = 4, chart = false }: { lines?: number; chart?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Shimmer className="h-2.5 w-24 mb-3" />
      <Shimmer className="h-4 w-56 mb-6" />
      {chart && <Shimmer className="w-full mb-5" style={{ height: 190, borderRadius: 14 }} />}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Shimmer key={i} className="h-3" style={{ width: `${92 - i * 11}%` }} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  glyph, title, body, action,
}: { glyph: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div
        className="mb-5 grid place-items-center"
        style={{
          width: 76, height: 76, borderRadius: 26,
          background: "var(--glass-base-fill)",
          border: "1px solid var(--hairline)",
          boxShadow: "inset 0 1px 0 var(--glass-raised-edge)",
          color: "var(--ink-3)",
        }}
        aria-hidden
      >
        {glyph}
      </div>
      <h3 className="h2 mb-1.5">{title}</h3>
      <p className="text-[13.5px] leading-relaxed max-w-[42ch]" style={{ color: "var(--ink-2)" }}>{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6" role="alert">
      <div
        className="mb-4 grid place-items-center"
        style={{ width: 46, height: 46, borderRadius: 16, background: "var(--crit-wash)", color: "var(--crit)" }}
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v5" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
          <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h3 className="h2 mb-1.5">Analysis didn&apos;t run</h3>
      <p className="text-[13.5px] leading-relaxed max-w-[46ch]" style={{ color: "var(--ink-2)" }}>{message}</p>
      {onRetry && <button className="btn mt-5" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* --- small parts -------------------------------------------------- */

export function Chip({
  tone = "neutral", children, icon,
}: { tone?: "ok" | "warn" | "crit" | "neutral"; children: ReactNode; icon?: ReactNode }) {
  const map = {
    ok: { bg: "var(--ok-wash)", fg: "var(--ok)" },
    warn: { bg: "var(--warn-wash)", fg: "var(--warn)" },
    crit: { bg: "var(--crit-wash)", fg: "var(--crit)" },
    neutral: { bg: "color-mix(in oklab, var(--ink) 8%, transparent)", fg: "var(--ink-2)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap"
      style={{ background: map.bg, color: map.fg }}
    >
      {icon}
      {children}
    </span>
  );
}

/** Status is never color-alone: every tone ships its own glyph. */
export function StatusDot({ tone }: { tone: "ok" | "warn" | "crit" }) {
  const d = {
    ok: <path d="M3.5 7.2 6 9.6l4.6-5" />,
    warn: <><path d="M7 3.6v4.1" /><circle cx="7" cy="10.3" r="0.62" fill="currentColor" /></>,
    crit: <><path d="M4.3 4.3 9.7 9.7" /><path d="M9.7 4.3 4.3 9.7" /></>,
  }[tone];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
          <span
            aria-hidden
            style={{ width: 9, height: 9, borderRadius: 3, background: it.color, boxShadow: "0 0 0 2px var(--viz-surface)" }}
          />
          <span>{it.label}</span>
          {it.value && <span className="num" style={{ color: "var(--ink-3)" }}>{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
