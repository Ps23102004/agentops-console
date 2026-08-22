"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocal } from "@/lib/useLocal";
import { Aurora } from "./Aurora";
import { SessionProvider, useSessions } from "./SessionContext";
import { api } from "@/lib/api";
import { ago, bytes, n } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { Chip, StatusDot } from "./Glass";

const NAV = [
  { href: "/", label: "Overview", engine: "ctxlens", d: "M4 13h5v7H4zM10.5 4h3v16h-3zM15.5 9h4.5v11h-4.5z" },
  { href: "/lens", label: "Context Lens", engine: "ctxlens", d: "M3.5 4.5h8v7h-8zM13 4.5h7.5v11H13zM3.5 13h8v6.5h-8zM13 17h7.5v2.5H13z" },
  { href: "/squeeze", label: "Squeeze", engine: "squeeze", d: "M4 6h16M7 11h10M10 16h4M11 20h2" },
  { href: "/memory", label: "Memory", engine: "memlint", d: "M12 3.5a4 4 0 0 0-4 4v1a3.5 3.5 0 0 0 0 7v1a4 4 0 0 0 8 0v-1a3.5 3.5 0 0 0 0-7v-1a4 4 0 0 0-4-4Z" },
  { href: "/bench", label: "Benchmark", engine: "membench", d: "M5 20V9m7 11V4m7 16v-7" },
];

const FILL_ICONS = new Set(["/", "/lens"]);
const SESSION_ROUTES = new Set(["/", "/lens", "/squeeze"]);
const SCOPE: Record<string, string> = { "/memory": "~/.claude/…/memory", "/bench": "fixed query set · 3 backends" };

/* ---------- theme ---------- */

function ThemeToggle() {
  const [theme, setTheme] = useLocal("agentops.theme", "system");
  const apply = (t: "system" | "light" | "dark") => {
    setTheme(t);
    const el = document.documentElement;
    if (t === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", t);
  };
  const opts = [
    { k: "light" as const, label: "Light", d: <><circle cx="8" cy="8" r="3.1" /><path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3 3l1.3 1.3M11.7 11.7 13 13M13 3l-1.3 1.3M4.3 11.7 3 13" /></> },
    { k: "system" as const, label: "System", d: <><rect x="1.6" y="2.6" width="12.8" height="9" rx="1.6" /><path d="M5.5 13.4h5" /></> },
    { k: "dark" as const, label: "Dark", d: <path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.9 5.9 0 1 0 7 7Z" /> },
  ];
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-full"
      style={{ background: "color-mix(in oklab, var(--ink) 7%, transparent)", border: "1px solid var(--hairline)" }}
      role="radiogroup"
      aria-label="Color theme"
    >
      {opts.map((o) => (
        <button
          key={o.k}
          role="radio"
          aria-checked={theme === o.k}
          aria-label={o.label}
          title={o.label}
          onClick={() => apply(o.k)}
          className="grid place-items-center rounded-full transition-transform active:scale-90"
          style={{
            width: 28, height: 28,
            background: theme === o.k ? "var(--glass-float-fill)" : "transparent",
            boxShadow: theme === o.k ? "0 1px 4px rgba(0,0,0,.14)" : "none",
            color: theme === o.k ? "var(--ink)" : "var(--ink-3)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{o.d}</svg>
        </button>
      ))}
    </div>
  );
}

/* ---------- backend health ---------- */

function HealthPill() {
  const { data, error, loading } = useAsync(() => api.health(), []);
  if (loading) return <div className="shimmer" style={{ width: 92, height: 26, borderRadius: 999 }} />;
  if (error || !data?.ok) {
    return <Chip tone="crit" icon={<StatusDot tone="crit" />}>Engines offline</Chip>;
  }
  const live = Object.values(data.engines).filter(Boolean).length;
  const total = Object.keys(data.engines).length;
  return (
    <Chip tone="ok" icon={<StatusDot tone="ok" />}>
      {api.mock ? "Mock data" : `${live}/${total} engines`}
    </Chip>
  );
}

/* ---------- session picker ---------- */

function SessionPicker() {
  const { sessions, current, setCurrentId, loading, error } = useSessions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (loading) return <div className="shimmer" style={{ width: 240, height: 34, borderRadius: 999 }} />;
  if (error) return <Chip tone="crit" icon={<StatusDot tone="crit" />}>Sessions unavailable</Chip>;
  if (!current) return <Chip tone="warn" icon={<StatusDot tone="warn" />}>No sessions found</Chip>;

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn flex items-center gap-2 max-w-[min(58vw,20rem)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="eyebrow" style={{ color: "var(--ink-3)" }}>Session</span>
        <span className="truncate" style={{ fontWeight: 540 }}>{current.label}</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ opacity: 0.55, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms var(--spring)" }}>
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div
          className="g-float absolute right-0 z-50 rise"
          style={{ top: "calc(100% + 8px)", width: "min(92vw, 30rem)", padding: 6 }}
          role="listbox"
        >
          {sessions?.map((s) => {
            const active = s.id === current.id;
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={active}
                onClick={() => { setCurrentId(s.id); setOpen(false); }}
                className="w-full text-left rounded-2xl px-3.5 py-3 transition-colors"
                style={{ background: active ? "color-mix(in oklab, var(--cat-1) 16%, transparent)" : "transparent" }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 6%, transparent)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] truncate" style={{ fontWeight: 540 }}>{s.label}</span>
                  <span className="num text-[11px] shrink-0" style={{ color: "var(--ink-3)" }}>{ago(s.mtime)}</span>
                </div>
                <div className="num text-[11px] mt-1 flex gap-3" style={{ color: "var(--ink-3)" }}>
                  <span>{n(s.n_messages)} msgs</span>
                  <span>{bytes(s.size_bytes)}</span>
                  <span className="truncate">{s.id.slice(0, 8)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- shell ---------- */

function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Screens" className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
      {NAV.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="group relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13.5px] whitespace-nowrap transition-all"
            style={{
              color: active ? "var(--ink)" : "var(--ink-2)",
              fontWeight: active ? 570 : 480,
              background: active ? "var(--glass-float-fill)" : "transparent",
              boxShadow: active ? "0 1px 0 var(--glass-float-edge) inset, 0 6px 18px -8px rgba(0,0,0,.4)" : "none",
              border: `1px solid ${active ? "var(--hairline)" : "transparent"}`,
            }}
          >
            <svg
              width="17" height="17" viewBox="0 0 24 24"
              fill={FILL_ICONS.has(item.href) ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: active ? 1 : 0.62, color: active ? "var(--cat-1)" : "currentColor" }}
              aria-hidden
            >
              <path d={item.d} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <SessionProvider>
      <Aurora />
      <div className="relative z-10 min-h-dvh lg:grid" style={{ gridTemplateColumns: "17rem 1fr" }}>
        {/* rail */}
        <aside className="lg:sticky lg:top-0 lg:h-dvh p-4 lg:p-5 flex flex-col gap-5">
          <Link href="/" className="flex items-center gap-3 px-1 pt-1">
            <Mark />
            <span>
              <span className="block text-[14.5px] leading-none" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>AgentOps</span>
              <span className="eyebrow block mt-1">Console</span>
            </span>
          </Link>
          <div className="g-base p-2 hidden lg:block" style={{ borderRadius: 22 }}>
            <Nav />
          </div>
          <div className="lg:hidden"><Nav /></div>
          <div className="mt-auto hidden lg:block px-1">
            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
              Everything here is read-only. Nothing on these screens edits a transcript or a memory file.
            </p>
          </div>
        </aside>

        {/* content */}
        <div className="min-w-0">
          <header
            className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 sm:px-8 py-3"
            style={{
              background: "color-mix(in oklab, var(--ground) 62%, transparent)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              backdropFilter: "blur(24px) saturate(180%)",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            {SESSION_ROUTES.has(path) ? (
              <SessionPicker />
            ) : (
              <p className="num text-[12px] truncate" style={{ color: "var(--ink-3)" }}>
                <span className="eyebrow mr-2">scope</span>{SCOPE[path] ?? ""}
              </p>
            )}
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:block"><HealthPill /></span>
              <ThemeToggle />
            </div>
          </header>
          <main className="px-4 sm:px-8 pb-24 pt-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}

function Mark() {
  return (
    <span
      className="grid place-items-center shrink-0"
      style={{
        width: 34, height: 34, borderRadius: 12,
        background: "linear-gradient(150deg, color-mix(in oklab, var(--cat-1) 85%, white), color-mix(in oklab, var(--cat-3) 80%, black))",
        boxShadow: "0 1px 0 rgba(255,255,255,.5) inset, 0 6px 16px -6px color-mix(in oklab, var(--cat-3) 70%, transparent)",
      }}
      aria-hidden
    >
      {/* three stacked panes, biggest on top — the product's whole thesis in 34px */}
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round">
        <rect x="2.5" y="2.5" width="15" height="6" rx="2" fill="rgba(255,255,255,.55)" />
        <rect x="4.5" y="10.5" width="11" height="3.4" rx="1.4" fill="rgba(255,255,255,.28)" />
        <rect x="6.5" y="15.6" width="7" height="2" rx="1" fill="rgba(255,255,255,.18)" />
      </svg>
    </span>
  );
}
