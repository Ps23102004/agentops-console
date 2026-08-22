"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSessions } from "@/components/SessionContext";
import { ErrorState, Panel, PanelHead, PanelSkeleton, Shimmer } from "@/components/Glass";
import { Treemap, type Tile } from "@/components/charts/Treemap";
import { Timeline } from "@/components/charts/Timeline";
import { NoSessions } from "../page";
import { compact, n, pct, shortTool } from "@/lib/format";

const CAT_LABEL: Record<string, string> = {
  tool_result: "Tool results", assistant_text: "Assistant text", tool_use: "Tool calls",
  system_prompt: "System prompt", user_text: "Your messages", thinking: "Thinking",
};

export default function Lens() {
  const { current, loading: sLoading, error: sError, reload: sReload } = useSessions();
  const [mode, setMode] = useState<"tool" | "category">("tool");
  const { data, error, loading, reload } = useAsync(
    () => (current ? api.context(current.id) : Promise.resolve(null)),
    [current?.id],
  );

  if (sError) return <Panel><ErrorState message={sError} onRetry={sReload} /></Panel>;
  if (error) return <Panel><ErrorState message={error} onRetry={reload} /></Panel>;
  if (!sLoading && !current) return <Panel><NoSessions /></Panel>;
  if (loading || sLoading || !data) return <LensSkeleton />;

  const tiles: Tile[] = mode === "tool"
    ? data.tools.map((t) => ({ name: t.name, value: t.est_tokens, count: t.count, sub: `${compact(t.mean)} chars` }))
    : data.categories.map((c) => ({ name: CAT_LABEL[c.category] ?? c.category, value: c.est_tokens, count: c.count }));

  const ordered = [...tiles].sort((a, b) => b.value - a.value);
  const totalValue = ordered.reduce((s, t) => s + t.value, 0) || 1;
  const rest = ordered.slice(1);
  const restShare = (rest.reduce((s, t) => s + t.value, 0) / totalValue) * 100;

  const peak = data.timeline[data.timeline.length - 1];
  const cacheShare = peak && peak.cache_read != null ? (peak.cache_read / Math.max(peak.cum_est_tokens, 1)) * 100 : null;

  return (
    <div className="space-y-5">
      <Panel className="rise" pad={false}>
        <div className="p-5 sm:p-6 pb-4">
          <PanelHead
            engine={`ctxlens · ${mode === "tool" ? "per tool" : "per category"}`}
            title="Where the context went"
            note="Area is share of the total, and the pane thickens with it — the heaviest glass is the one to fix first."
            right={
              <div className="flex gap-1.5" role="group" aria-label="Group treemap by">
                <button className="btn" data-active={mode === "tool"} onClick={() => setMode("tool")}>By tool</button>
                <button className="btn" data-active={mode === "category"} onClick={() => setMode("category")}>By category</button>
              </div>
            }
          />
        </div>
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <Treemap tiles={tiles} height={400} />
        </div>
        {rest.length > 1 && (
          <div className="px-3 pb-4 sm:px-4 sm:pb-5">
            <p className="eyebrow mb-2.5 px-1">
              the other {pct(restShare)}, rescaled · same scale, nothing promoted
            </p>
            <Treemap tiles={rest} height={128} scaleMax={tiles[0].value} shareOf={totalValue} />
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-3 rise">
          <PanelHead
            engine="ctxlens · timeline"
            title="How it accumulated"
            note={`Context reached ${compact(peak?.cum_est_tokens ?? 0)} tokens over ${n(data.n_messages)} messages.${cacheShare != null ? ` The cache absorbed ${pct(cacheShare, 0)} of it.` : ""}`}
          />
          <div className="well p-3">
            <Timeline points={data.timeline} height={230} />
          </div>
        </Panel>

        <Panel className="lg:col-span-2 rise">
          <PanelHead engine="ctxlens · top10" title="Heaviest single results" />
          <ol className="space-y-3">
            {data.top10.slice(0, 6).map((t, i) => (
              <li key={i} className="grid gap-1" style={{ gridTemplateColumns: "1fr auto" }}>
                <p className="num text-[11.5px] truncate" style={{ color: "var(--ink-2)" }}>{shortTool(t.tool)}</p>
                <p className="num text-[12px] text-right" style={{ fontWeight: 560 }}>{compact(t.chars)}</p>
                <p className="text-[11.5px] leading-snug col-span-2 truncate" style={{ color: "var(--ink-3)" }}>{t.preview}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel className="rise" pad={false}>
        <div className="p-5 sm:p-6 pb-3">
          <PanelHead engine="ctxlens · table" title="Every tool, exactly" note="The same numbers the treemap draws, for reading and copying." />
        </div>
        <div className="px-5 sm:px-6 pb-6 overflow-x-auto">
          <table className="data" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Tool</th><th scope="col">Calls</th><th scope="col">Chars</th>
                <th scope="col">Est. tokens</th><th scope="col">Mean</th><th scope="col">p95</th><th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.tools.map((t) => (
                <tr key={t.name}>
                  <td className="num text-[12px] break-all" style={{ maxWidth: 260 }}>{t.name}</td>
                  <td className="num">{n(t.count)}</td>
                  <td className="num">{n(t.chars)}</td>
                  <td className="num">{n(t.est_tokens)}</td>
                  <td className="num" style={{ color: "var(--ink-2)" }}>{n(t.mean)}</td>
                  <td className="num" style={{ color: "var(--ink-2)" }}>{n(t.p95)}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 justify-end">
                      <span aria-hidden style={{ width: 44, height: 6, borderRadius: 3, background: "color-mix(in oklab, var(--ink) 8%, transparent)", display: "inline-block", position: "relative" }}>
                        <span style={{ position: "absolute", inset: 0, width: `${t.pct_of_tool_result_chars}%`, background: "var(--cat-1)", borderRadius: 3 }} />
                      </span>
                      <span className="num" style={{ minWidth: 46, display: "inline-block" }}>{pct(t.pct_of_tool_result_chars, t.pct_of_tool_result_chars < 1 ? 2 : 1)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function LensSkeleton() {
  return (
    <div className="space-y-5">
      <Panel>
        <Shimmer className="h-2.5 w-24 mb-3" />
        <Shimmer className="h-4 w-52 mb-6" />
        <Shimmer className="w-full" style={{ height: 440, borderRadius: 18 }} />
      </Panel>
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-3"><PanelSkeleton chart lines={2} /></Panel>
        <Panel className="lg:col-span-2"><PanelSkeleton lines={6} /></Panel>
      </div>
    </div>
  );
}
