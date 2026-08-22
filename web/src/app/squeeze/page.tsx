"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSessions } from "@/components/SessionContext";
import { Chip, ErrorState, Panel, PanelHead, PanelSkeleton, Shimmer, StatusDot } from "@/components/Glass";
import { TradeoffCurve, type CurvePoint } from "@/components/charts/TradeoffCurve";
import { NoSessions } from "../page";
import { compact, fx, n, pct, shortTool } from "@/lib/format";

const FLOOR = 0.95;

export default function Squeeze() {
  const { current, loading: sLoading, error: sError, reload: sReload } = useSessions();
  const [useLlm, setUseLlm] = useState(true);
  const { data, error, loading, reload } = useAsync(
    () => (current ? api.squeeze(current.id, useLlm) : Promise.resolve(null)),
    [current?.id, useLlm],
  );

  // fidelity is null when a tool's output had no checkable facts — never plot
  // that as a fidelity of 0, so unmeasurable tools are dropped from the curve.
  const curve: CurvePoint[] = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r): r is typeof r & { fidelity: number } => typeof r.fidelity === "number")
        .map((r) => ({
          label: r.tool,
          savings: r.pct_saved_total,
          fidelity: r.fidelity,
          tokens: r.orig_tokens,
          note: `${n(r.n)} results · ${compact(r.orig_tokens)} → ${compact(r.llm_tokens)} tokens`,
        })),
    [data],
  );
  const omittedFidelity = (data?.rows.length ?? 0) - curve.length;

  if (sError) return <Panel><ErrorState message={sError} onRetry={sReload} /></Panel>;
  if (error) return <Panel><ErrorState message={error} onRetry={reload} /></Panel>;
  if (!sLoading && !current) return <Panel><NoSessions /></Panel>;
  if (loading || sLoading || !data) return <SqueezeSkeleton />;

  const t = data.totals;
  const savedTokens = t.orig_tokens - t.llm_tokens;

  return (
    <div className="space-y-5">
      <Panel className="rise">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="eyebrow mb-4">squeeze · {useLlm ? "prefilter + llm rewrite" : "prefilter only"}</p>
            <p className="display num">{pct(t.pct_saved_total)}</p>
            <p className="mt-4 text-[15px] leading-relaxed max-w-[44ch]" style={{ color: "var(--ink-2)" }}>
              of tool output can come out — <span className="num">{compact(savedTokens)}</span> tokens —
              at a measured fidelity of <span className="num" style={{ color: "var(--ink)", fontWeight: 560 }}>{fx(t.fidelity, 3)}</span>.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              <Chip
                tone={typeof t.fidelity !== "number" ? "warn" : t.fidelity >= FLOOR ? "ok" : "warn"}
                icon={<StatusDot tone={typeof t.fidelity !== "number" ? "warn" : t.fidelity >= FLOOR ? "ok" : "warn"} />}
              >
                {typeof t.fidelity !== "number" ? "Fidelity not measurable" : t.fidelity >= FLOOR ? "Above fidelity floor" : `Below ${FLOOR} floor`}
              </Chip>
              <Chip tone={t.failures ? "warn" : "ok"} icon={<StatusDot tone={t.failures ? "warn" : "ok"} />}>
                {t.failures} rewrites dropped a fact
              </Chip>
            </div>
          </div>

          <div className="flex flex-col gap-3 items-start">
            <div className="flex gap-1.5" role="group" aria-label="Compression strategy">
              <button className="btn" data-active={!useLlm} onClick={() => setUseLlm(false)}>Prefilter only</button>
              <button className="btn" data-active={useLlm} onClick={() => setUseLlm(true)}>Prefilter + LLM</button>
            </div>
            <dl className="grid grid-cols-3 gap-x-7 gap-y-1 mt-1">
              {[
                ["Original", compact(t.orig_tokens)],
                ["Prefiltered", compact(t.prefilter_tokens)],
                ["After rewrite", compact(t.llm_tokens)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dd className="num text-[22px] leading-none" style={{ fontWeight: 560, letterSpacing: "-0.03em" }}>{v}</dd>
                  <dt className="eyebrow mt-2">{k}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Panel>

      <Panel className="rise">
        <PanelHead
          engine="squeeze · frontier"
          title="What each tool costs you to compress"
          note="Up and to the right is free money. Down and to the right is savings paid for with dropped facts."
        />
        <div className="well p-3 sm:p-4">
          <TradeoffCurve points={curve} floor={FLOOR} />
          {omittedFidelity > 0 && (
            <p className="text-[11.5px] mt-2" style={{ color: "var(--ink-3)" }}>
              {omittedFidelity} tool{omittedFidelity === 1 ? "" : "s"} not plotted: fidelity not measurable.
            </p>
          )}
        </div>
      </Panel>

      <Panel className="rise" pad={false}>
        <div className="p-5 sm:p-6 pb-3">
          <PanelHead
            engine="squeeze · rows"
            title="Before and after, per tool"
            note="Fidelity is the fraction of checkable facts that survived the rewrite. Failures are results where at least one did not."
          />
        </div>
        <div className="px-5 sm:px-6 pb-6 overflow-x-auto">
          <table className="data" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th scope="col">Tool</th><th scope="col">n</th><th scope="col">Original</th>
                <th scope="col">Prefiltered</th><th scope="col">After rewrite</th>
                <th scope="col">Saved</th><th scope="col">Fidelity</th><th scope="col">Failures</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const tone = typeof r.fidelity !== "number" ? "warn" : r.fidelity >= FLOOR ? "ok" : r.fidelity >= 0.9 ? "warn" : "crit";
                return (
                  <tr key={r.tool}>
                    <td className="num text-[12px] break-all" style={{ maxWidth: 240 }}>{shortTool(r.tool)}</td>
                    <td className="num" style={{ color: "var(--ink-2)" }}>{n(r.n)}</td>
                    <td className="num">{n(r.orig_tokens)}</td>
                    <td className="num" style={{ color: "var(--ink-2)" }}>{n(r.prefilter_tokens)}</td>
                    <td className="num">{n(r.llm_tokens)}</td>
                    <td className="num" style={{ fontWeight: 560 }}>{pct(r.pct_saved_total)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5" style={{ color: `var(--${tone})` }}>
                        <StatusDot tone={tone} />
                        <span className="num" style={{ color: "var(--ink)" }}>{fx(r.fidelity, 3)}</span>
                      </span>
                    </td>
                    <td className="num" style={{ color: r.failures ? "var(--warn)" : "var(--ink-3)" }}>{r.failures}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--hairline-strong)" }}>
                <td className="num" style={{ fontWeight: 570, paddingTop: 14 }}>All tools</td>
                <td />
                <td className="num" style={{ fontWeight: 560 }}>{n(t.orig_tokens)}</td>
                <td className="num" style={{ color: "var(--ink-2)" }}>{n(t.prefilter_tokens)}</td>
                <td className="num" style={{ fontWeight: 560 }}>{n(t.llm_tokens)}</td>
                <td className="num" style={{ fontWeight: 570 }}>{pct(t.pct_saved_total)}</td>
                <td className="num" style={{ fontWeight: 560 }}>{fx(t.fidelity, 3)}</td>
                <td className="num" style={{ color: "var(--ink-2)" }}>{t.failures}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function SqueezeSkeleton() {
  return (
    <div className="space-y-5">
      <Panel>
        <Shimmer className="h-2.5 w-36 mb-5" />
        <Shimmer className="h-14 w-44 mb-5" />
        <Shimmer className="h-3.5 w-full max-w-md mb-2" />
        <Shimmer className="h-3.5 w-2/3 max-w-sm" />
      </Panel>
      <Panel><PanelSkeleton chart lines={1} /></Panel>
      <Panel><PanelSkeleton lines={6} /></Panel>
    </div>
  );
}
