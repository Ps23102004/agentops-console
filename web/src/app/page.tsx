"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSessions } from "@/components/SessionContext";
import { Chip, EmptyState, ErrorState, Panel, PanelHead, PanelSkeleton, Shimmer, StatusDot } from "@/components/Glass";
import { Ribbon, type Seg } from "@/components/charts/Ribbon";
import { Bars } from "@/components/charts/Bars";
import { CAT, compact, n, pct, shortTool } from "@/lib/format";

const CAT_LABEL: Record<string, string> = {
  tool_result: "Tool results",
  assistant_text: "Assistant text",
  tool_use: "Tool calls",
  system_prompt: "System prompt",
  user_text: "Your messages",
  thinking: "Thinking",
};

export default function Overview() {
  const { current, loading: sLoading, error: sError, reload: sReload } = useSessions();
  const { data, error, loading, reload } = useAsync(
    () => (current ? api.context(current.id) : Promise.resolve(null)),
    [current?.id],
  );

  // error first: a failed request leaves data null, and checking !data ahead of
  // it would render the skeleton forever instead of telling the user what broke
  if (sError) return <Panel><ErrorState message={sError} onRetry={sReload} /></Panel>;
  if (error) return <Panel><ErrorState message={error} onRetry={reload} /></Panel>;
  if (!sLoading && !current) return <Panel><NoSessions /></Panel>;
  if (loading || sLoading || !data) return <OverviewSkeleton />;

  const toolCat = data.categories.find((c) => c.category === "tool_result");
  const segs: Seg[] = data.categories.map((c, i) => ({
    label: CAT_LABEL[c.category] ?? c.category,
    value: c.est_tokens, pct: c.pct_of_transcript_chars, color: CAT[i % CAT.length], count: c.count,
  }));
  const worst = data.tools[0];
  const biggest = data.top10[0];

  return (
    <div className="space-y-5">
      {/* ---- hero: the thesis, not a KPI row ---- */}
      <Panel tier="raised" className="rise overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <p className="eyebrow mb-4">ctxlens · {current!.id.slice(0, 8)}</p>
            <p className="display num" style={{ color: "var(--ink)" }}>
              {pct(toolCat?.pct_of_transcript_chars ?? 0)}
            </p>
            <p className="mt-4 text-[15px] leading-relaxed max-w-[46ch]" style={{ color: "var(--ink-2)" }}>
              of this session&apos;s context was <strong style={{ color: "var(--ink)", fontWeight: 560 }}>tool output</strong> —{" "}
              <span className="num">{compact(data.total_chars)}</span> characters the model paid for, mostly to read a screenshot once.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-x-8 gap-y-1 shrink-0">
            {[
              ["Est. tokens", compact(data.total_est_tokens)],
              ["Messages", n(data.n_messages)],
              ["Tools used", n(data.tools.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <dd className="num text-[26px] leading-none" style={{ fontWeight: 560, letterSpacing: "-0.03em" }}>{v}</dd>
                <dt className="eyebrow mt-2">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8">
          <Ribbon segments={segs} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ---- offenders ---- */}
        <Panel className="lg:col-span-3 rise" >
          <PanelHead
            engine="ctxlens · tools"
            title="Top offenders"
            note="Share of all tool output. One tool usually accounts for most of it."
            right={<Link href="/lens" className="btn">Open Context Lens</Link>}
          />
          <div className="well p-4">
            <Bars
              unit="est. tokens"
              bars={[...data.tools].sort((a, b) => b.pct_of_tool_result_chars - a.pct_of_tool_result_chars).slice(0, 6).map((t, i) => ({
                label: shortTool(t.name),
                value: t.pct_of_tool_result_chars,
                display: pct(t.pct_of_tool_result_chars, t.pct_of_tool_result_chars < 1 ? 2 : 1),
                color: i === 0 ? "var(--cat-1)" : "color-mix(in oklab, var(--cat-1) 55%, transparent)",
                note: `${n(t.count)} calls · ${compact(t.chars)} chars · mean ${compact(t.mean)}`,
              }))}
              max={100}
            />
          </div>
          {worst ? (
            <>
              <p className="text-[12.5px] mt-4 leading-relaxed" style={{ color: "var(--ink-2)" }}>
                <strong style={{ color: "var(--ink)", fontWeight: 560 }}>{shortTool(worst.name)}</strong> ran {n(worst.count)} times
                and returned {compact(worst.chars)} characters — {pct(worst.pct_of_tool_result_chars)} of everything the tools sent back.
              </p>
              <dl className="grid grid-cols-3 gap-x-6 mt-5 pt-5" style={{ borderTop: "1px solid var(--hairline)" }}>
                {[
                  ["Mean result", `${compact(worst.mean)} ch`],
                  ["p95 result", `${compact(worst.p95)} ch`],
                  ["Calls", n(worst.count)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dd className="num text-[18px] leading-none" style={{ fontWeight: 550, letterSpacing: "-0.02em" }}>{v}</dd>
                    <dt className="eyebrow mt-1.5">{k}</dt>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-[12.5px] mt-4" style={{ color: "var(--ink-3)" }}>No tool calls in this session.</p>
          )}
        </Panel>

        {/* ---- single largest payload ---- */}
        <Panel className="lg:col-span-2 rise">
          <PanelHead engine="ctxlens · top10" title="Largest single result" />
          {biggest ? (
            <>
              <div className="well p-4">
                <p className="num text-[34px] leading-none" style={{ fontWeight: 560, letterSpacing: "-0.03em" }}>
                  {compact(biggest.chars)}
                </p>
                <p className="eyebrow mt-2">characters, one message</p>
                <p className="num text-[11.5px] mt-4 break-all" style={{ color: "var(--ink-2)" }}>{biggest.tool}</p>
                <p className="text-[12.5px] mt-2 leading-snug" style={{ color: "var(--ink-3)" }}>{biggest.preview}</p>
              </div>
              <ol className="mt-4 space-y-2">
                {data.top10.slice(1, 5).map((t, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                    <span className="truncate" style={{ color: "var(--ink-2)" }}>{shortTool(t.tool)}</span>
                    <span className="num shrink-0" style={{ color: "var(--ink-3)" }}>{compact(t.chars)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="well p-4 text-[12.5px]" style={{ color: "var(--ink-3)" }}>No tool results in this session.</p>
          )}
          <Link href="/squeeze" className="btn mt-5 inline-block">See what compresses</Link>
        </Panel>
      </div>

      <Panel tier="base" className="rise" pad>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Reading {current!.path}
          </p>
          <div className="flex gap-2">
            <Chip icon={<StatusDot tone="ok" />} tone="ok">Read-only</Chip>
            <Chip>{n(current!.n_messages)} messages</Chip>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function NoSessions() {
  return (
    <EmptyState
      glyph={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5h16M4 12h16M4 17.5h9" /></svg>}
      title="No transcripts to read yet"
      body="AgentOps reads session .jsonl files that agents already write to disk. Point the server at a directory of them and this screen fills itself in."
      action={<code className="num text-[12px] px-3 py-2 rounded-xl" style={{ background: "var(--inset-well)", border: "1px solid var(--inset-well-edge)", color: "var(--ink-2)" }}>agentops serve --sessions ~/.claude/projects</code>}
    />
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <Panel>
        <Shimmer className="h-2.5 w-28 mb-5" />
        <Shimmer className="h-14 w-52 mb-5" />
        <Shimmer className="h-3.5 w-full max-w-md mb-2" />
        <Shimmer className="h-3.5 w-2/3 max-w-sm" />
        <Shimmer className="w-full mt-8" style={{ height: 46, borderRadius: 14 }} />
      </Panel>
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-3"><PanelSkeleton lines={6} /></Panel>
        <Panel className="lg:col-span-2"><PanelSkeleton lines={4} chart /></Panel>
      </div>
    </div>
  );
}
