"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Chip, EmptyState, ErrorState, Panel, PanelHead, PanelSkeleton, Shimmer, StatusDot } from "@/components/Glass";
import { compact, fx, n } from "@/lib/format";
import type { Memory } from "@/lib/types";

type Filter = "all" | "evict" | "review" | "keep";

const VERDICT: Record<string, { tone: "ok" | "warn" | "crit"; label: string }> = {
  keep: { tone: "ok", label: "Keep" },
  review: { tone: "warn", label: "Review" },
  evict: { tone: "crit", label: "Propose evicting" },
};

export default function MemoryScreen() {
  const [filter, setFilter] = useState<Filter>("evict");
  const { data, error, loading, reload } = useAsync(() => api.memory(), []);

  if (error) return <Panel><ErrorState message={error} onRetry={reload} /></Panel>;
  if (loading || !data) return <MemorySkeleton />;
  if (!data.memories.length) {
    return (
      <Panel>
        <EmptyState
          glyph={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5a4 4 0 0 0-4 4v1a3.5 3.5 0 0 0 0 7v1a4 4 0 0 0 8 0v-1a3.5 3.5 0 0 0 0-7v-1a4 4 0 0 0-4-4Z" /></svg>}
          title="Nothing in the memory store"
          body="Once an agent starts writing memories, this screen shows which of them ever get read back — and which are quietly costing you tokens in every session."
        />
      </Panel>
    );
  }

  const t = data.totals;
  const shown = data.memories.filter((m) => filter === "all" || m.verdict === filter);
  const evictTokens = Math.round((t.est_tokens / t.n_memories) * t.proposed_evict);
  const counts: Record<Filter, number> = {
    all: data.memories.length,
    evict: data.memories.filter((m) => m.verdict === "evict").length,
    review: data.memories.filter((m) => m.verdict === "review").length,
    keep: data.memories.filter((m) => m.verdict === "keep").length,
  };

  return (
    <div className="space-y-5">
      <Panel className="rise">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="eyebrow mb-4">memlint · dry run</p>
            <p className="display num">{n(t.proposed_evict)}</p>
            <p className="mt-4 text-[15px] leading-relaxed max-w-[44ch]" style={{ color: "var(--ink-2)" }}>
              memories have never been recalled and reference paths that no longer exist.
              Dropping them frees about <span className="num" style={{ color: "var(--ink)", fontWeight: 560 }}>{compact(evictTokens)}</span> tokens
              from every session that loads this store.
            </p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            {[
              ["Memories", n(t.n_memories)],
              ["Est. tokens", compact(t.est_tokens)],
              ["Needs review", n(t.proposed_review)],
            ].map(([k, v]) => (
              <div key={k}>
                <dd className="num text-[24px] leading-none" style={{ fontWeight: 560, letterSpacing: "-0.03em" }}>{v}</dd>
                <dt className="eyebrow mt-2">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* the non-destructive promise, stated where the destructive-looking number is */}
        <div
          className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: "var(--ok-wash)", border: "1px solid color-mix(in oklab, var(--ok) 26%, transparent)" }}
        >
          <span style={{ color: "var(--ok)" }}><StatusDot tone="ok" /></span>
          <p className="text-[13px]" style={{ color: "var(--ink)" }}>
            <strong style={{ fontWeight: 570 }}>Dry run.</strong>{" "}
            <span style={{ color: "var(--ink-2)" }}>
              Nothing on this screen writes to disk. Evictions are proposals with reasons — you apply them yourself, or not.
            </span>
          </p>
          <code
            className="num text-[11.5px] px-2.5 py-1.5 rounded-lg ml-auto"
            style={{ background: "var(--inset-well)", border: "1px solid var(--inset-well-edge)", color: "var(--ink-2)" }}
          >
            agentops memlint --apply
          </code>
        </div>
      </Panel>

      <Panel className="rise" pad={false}>
        <div className="p-5 sm:p-6 pb-4">
          <PanelHead
            engine="memlint · verdicts"
            title="Every memory, and whether anything reads it"
            note="Index mentions are links from the index file. Body recalls are times the memory's own content was actually pulled into a session."
            right={
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by verdict">
                {(["evict", "review", "keep", "all"] as Filter[]).map((f) => (
                  <button key={f} className="btn" data-active={filter === f} onClick={() => setFilter(f)}>
                    {f === "all" ? "All" : VERDICT[f].label} <span className="num" style={{ opacity: 0.6 }}>{counts[f]}</span>
                  </button>
                ))}
              </div>
            }
          />
        </div>
        <div className="px-3 pb-4 sm:px-4 sm:pb-5 space-y-2">
          {shown.length === 0
            ? <div className="py-10"><EmptyState
                glyph={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 6.5" /></svg>}
                title={`Nothing to ${filter === "keep" ? "keep" : filter}`}
                body="No memory in this store landed in that bucket on the last run. Try another filter."
              /></div>
            : shown.map((m) => <MemoryRow key={m.name} m={m} />)}
        </div>
      </Panel>

      <Panel className="rise">
        <PanelHead
          engine="memcheck · contradictions"
          title="Pairs that disagree"
          note="Two memories that say near-identical things with different facts. Cosine is over their embeddings — the higher it is, the more certainly one of them is wrong."
        />
        <ul className="space-y-2.5">
          {data.contradictions.map((c, i) => (
            <li key={i} className="well p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <code className="num text-[12px]">{c.a}</code>
                <span
                  className="num text-[10.5px] px-2 py-0.5 rounded-full"
                  style={{ background: "var(--warn-wash)", color: "var(--warn)" }}
                >
                  cos {fx(c.cosine, 2)}
                </span>
                <code className="num text-[12px]">{c.b}</code>
              </div>
              <p className="text-[13px] mt-2.5" style={{ color: "var(--ink-2)" }}>{c.verdict}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function MemoryRow({ m }: { m: Memory }) {
  const v = VERDICT[m.verdict] ?? { tone: "warn" as const, label: m.verdict };
  const recalled = m.body_recalls > 0;
  return (
    <article
      className="rounded-2xl px-4 py-3.5 transition-colors"
      style={{ background: "var(--inset-well)", border: "1px solid var(--inset-well-edge)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <code className="num text-[12.5px]" style={{ color: "var(--ink)", fontWeight: 550 }}>{m.name}</code>
            <span className="eyebrow" style={{ letterSpacing: "0.1em" }}>{m.type}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {m.reasons.map((r, i) => (
              <li key={i} className="text-[12.5px] leading-snug flex gap-2" style={{ color: "var(--ink-2)" }}>
                <span aria-hidden style={{ color: "var(--ink-3)" }}>—</span>{r}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <dl className="flex gap-4 text-right">
            {[
              ["recalls", m.body_recalls, recalled ? "var(--ink)" : "var(--crit)"],
              ["dead paths", m.dead_paths, m.dead_paths ? "var(--crit)" : "var(--ink-3)"],
              ["age", m.age_days != null ? `${m.age_days}d` : "—", "var(--ink-2)"],
            ].map(([k, val, color]) => (
              <div key={k as string}>
                <dd className="num text-[15px]" style={{ color: color as string, fontWeight: 560 }}>{val as string}</dd>
                <dt className="eyebrow mt-1">{k as string}</dt>
              </div>
            ))}
          </dl>
          <Chip tone={v.tone} icon={<StatusDot tone={v.tone} />}>{v.label}</Chip>
        </div>
      </div>
    </article>
  );
}

function MemorySkeleton() {
  return (
    <div className="space-y-5">
      <Panel>
        <Shimmer className="h-2.5 w-28 mb-5" />
        <Shimmer className="h-14 w-24 mb-5" />
        <Shimmer className="h-3.5 w-full max-w-md mb-2" />
        <Shimmer className="h-3.5 w-2/3 max-w-sm" />
        <Shimmer className="w-full mt-7" style={{ height: 50, borderRadius: 16 }} />
      </Panel>
      <Panel><PanelSkeleton lines={7} /></Panel>
    </div>
  );
}
