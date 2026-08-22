"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Chip, EmptyState, ErrorState, Panel, PanelHead, PanelSkeleton, Shimmer, StatusDot } from "@/components/Glass";
import { BenchScatter } from "@/components/charts/BenchScatter";
import { Bars } from "@/components/charts/Bars";
import { fx, n } from "@/lib/format";

const COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)"];

/** Lower is better for these; the table marks winners per column, not per row. */
const LOWER_IS_BETTER = new Set(["staleness@1", "leak_rate@k", "tokens_per_query"]);

const COLS: { key: keyof BenchKeys; label: string; digits: number }[] = [
  { key: "recall@k", label: "recall@k", digits: 3 },
  { key: "precision@k", label: "precision@k", digits: 3 },
  { key: "staleness@1", label: "staleness@1", digits: 3 },
  { key: "leak_rate@k", label: "leak_rate@k", digits: 3 },
  { key: "contradiction_resolution", label: "contradiction res.", digits: 2 },
  { key: "tokens_per_query", label: "tokens/query", digits: 0 },
];
type BenchKeys = {
  "recall@k": number; "precision@k": number; "staleness@1": number;
  "leak_rate@k": number; contradiction_resolution: number; tokens_per_query: number;
};

export default function Bench() {
  const { data, error, loading, reload } = useAsync(() => api.bench(), []);

  if (error) return <Panel><ErrorState message={error} onRetry={reload} /></Panel>;
  if (loading || !data) return <BenchSkeleton />;
  if (!data.rows.length) {
    return (
      <Panel>
        <EmptyState
          glyph={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V9m7 11V4m7 16v-7" /></svg>}
          title="No benchmark run on record"
          body="The memory benchmark replays a fixed query set against each backend and scores what came back. Run it once and the leaderboard lands here."
          action={<code className="num text-[12px] px-3 py-2 rounded-xl" style={{ background: "var(--inset-well)", border: "1px solid var(--inset-well-edge)", color: "var(--ink-2)" }}>agentops bench memory</code>}
        />
      </Panel>
    );
  }

  const rows = data.rows;
  const bestRecall = rows.reduce((a, b) => (b["recall@k"] > a["recall@k"] ? b : a));
  // staleness@1 is null when a backend abstained — never let an unmeasured value
  // win the "freshest" pick just because null coerces to 0 in a numeric compare.
  const rated = rows.filter((r): r is typeof r & { "staleness@1": number } => typeof r["staleness@1"] === "number");
  const freshest = rated.length ? rated.reduce((a, b) => (b["staleness@1"] < a["staleness@1"] ? b : a)) : null;
  const best: Record<string, number | null> = {};
  for (const c of COLS) {
    const vals = rows.map((r) => r[c.key]).filter((v): v is number => typeof v === "number");
    best[c.key] = vals.length
      ? vals.reduce((acc, v) => (LOWER_IS_BETTER.has(c.key) ? Math.min(acc, v) : Math.max(acc, v)))
      : null;
  }

  return (
    <div className="space-y-5">
      <Panel className="rise">
        <div className="grid gap-8 lg:grid-cols-5 items-center">
          <div className="lg:col-span-2">
            <p className="eyebrow mb-4">membench · {rows.length} backends</p>
            <p className="display" style={{ maxWidth: "12ch" }}>No backend wins twice.</p>
            <p className="mt-5 text-[15px] leading-relaxed max-w-[40ch]" style={{ color: "var(--ink-2)" }}>
              <strong className="num" style={{ color: "var(--ink)", fontWeight: 560 }}>{bestRecall.backend}</strong> finds
              almost everything ({fx(bestRecall["recall@k"], 3)} recall){typeof bestRecall["staleness@1"] === "number"
                ? <> and hands back a stale top hit {Math.round(bestRecall["staleness@1"] * 100)}% of the time.</>
                : <>; staleness wasn&apos;t measurable for it.</>}{" "}
              {freshest && (
                <>
                  <strong className="num" style={{ color: "var(--ink)", fontWeight: 560 }}>{freshest.backend}</strong> is
                  almost never stale ({fx(freshest["staleness@1"], 3)}) and misses{" "}
                  {Math.round((1 - freshest["recall@k"]) * 100)}% of what you asked for.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              <Chip tone="warn" icon={<StatusDot tone="warn" />}>
                {rows.filter((r) => (r["leak_rate@k"] ?? 0) > 0.5).length} of {rows.length} leak on most queries
              </Chip>
            </div>
          </div>
          <div className="lg:col-span-3 well p-3 sm:p-4">
            <BenchScatter rows={rows} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="rise">
          <PanelHead
            engine="membench · leak_rate@k"
            title="How often the wrong memory comes back"
            note="Share of queries where at least one retrieved memory belonged to a different project or a superseded fact."
          />
          <div className="well p-4">
            <Bars
              unit="leak rate"
              max={1}
              bars={rows
                .map((r, i) => ({ r, i }))
                .filter((x): x is { r: typeof x.r & { "leak_rate@k": number }; i: number } => typeof x.r["leak_rate@k"] === "number")
                .map(({ r, i }) => ({
                  label: r.backend,
                  value: r["leak_rate@k"],
                  display: r["leak_rate@k"].toFixed(3),
                  color: COLORS[i],
                  note: `${n(r.tokens_per_query)} tokens per query`,
                }))}
            />
            {rows.some((r) => r["leak_rate@k"] == null) && (
              <p className="text-[11.5px] mt-3" style={{ color: "var(--ink-3)" }}>
                {rows.filter((r) => r["leak_rate@k"] == null).length} backend(s) not plotted: leak rate not measurable.
              </p>
            )}
          </div>
          <p className="text-[12.5px] mt-4 leading-relaxed" style={{ color: "var(--ink-2)" }}>
            A leak rate of 1.000 means every single query pulled in something that did not belong — the recall win is
            paid for in noise the model then has to ignore.
          </p>
        </Panel>

        <Panel className="rise">
          <PanelHead
            engine="membench · cost"
            title="Tokens spent per query"
            note="What each backend adds to the prompt before the model has answered anything."
          />
          <div className="well p-4">
            <Bars
              unit="tokens/query"
              bars={rows.map((r, i) => ({
                label: r.backend,
                value: r.tokens_per_query,
                display: n(r.tokens_per_query),
                color: COLORS[i],
                note: `recall ${r["recall@k"].toFixed(3)} · staleness ${fx(r["staleness@1"], 3)}`,
              }))}
            />
          </div>
          <p className="text-[12.5px] mt-4 leading-relaxed" style={{ color: "var(--ink-2)" }}>
            Cheapest and freshest is the same backend. It is also the one that misses the most.
          </p>
        </Panel>
      </div>

      <Panel className="rise" pad={false}>
        <div className="p-5 sm:p-6 pb-3">
          <PanelHead engine="membench · leaderboard" title="Full scores" note="Best value in each column is marked. There is no row that wins them all." />
        </div>
        <div className="px-5 sm:px-6 pb-6 overflow-x-auto">
          <table className="data" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col">Backend</th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                    <span className="block" style={{ fontSize: 9, letterSpacing: "0.08em", opacity: 0.7 }}>
                      {LOWER_IS_BETTER.has(c.key) ? "lower better" : "higher better"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.backend}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: COLORS[i] }} />
                      <span className="num" style={{ fontWeight: 560 }}>{r.backend}</span>
                    </span>
                  </td>
                  {COLS.map((c) => {
                    const v = r[c.key];
                    const win = typeof v === "number" && v === best[c.key];
                    return (
                      <td key={c.key} className="num" style={{ color: win ? "var(--ink)" : "var(--ink-2)", fontWeight: win ? 570 : 440 }}>
                        {typeof v !== "number" ? "—" : c.digits === 0 ? n(v) : v.toFixed(c.digits)}
                        {win && (
                          <span className="ml-1.5 inline-block align-middle" style={{ color: "var(--ok)" }} title="best in column">
                            <StatusDot tone="ok" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function BenchSkeleton() {
  return (
    <div className="space-y-5">
      <Panel>
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Shimmer className="h-2.5 w-28 mb-5" />
            <Shimmer className="h-11 w-full max-w-[16rem] mb-3" />
            <Shimmer className="h-11 w-40 mb-6" />
            <Shimmer className="h-3.5 w-full mb-2" />
            <Shimmer className="h-3.5 w-3/4" />
          </div>
          <div className="lg:col-span-3"><Shimmer className="w-full" style={{ height: 320, borderRadius: 16 }} /></div>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><PanelSkeleton lines={3} chart /></Panel>
        <Panel><PanelSkeleton lines={3} chart /></Panel>
      </div>
    </div>
  );
}
