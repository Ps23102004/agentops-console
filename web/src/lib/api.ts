"use client";

import * as fx from "./mock";
import type { BenchReport, ContextReport, Health, MemoryReport, Session, SqueezeReport } from "./types";

export const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
// Mock is the default: .env* is gitignored, so a fresh checkout would otherwise
// boot pointed at a backend that isn't running. Set NEXT_PUBLIC_MOCK=0 to go live.
export const MOCK = process.env.NEXT_PUBLIC_MOCK !== "0";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

const latency = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Can't reach the analysis server at ${BASE}. Start it, or run the console with NEXT_PUBLIC_MOCK=1.`);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(detail?.error ?? `${path} failed with ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  mock: MOCK,

  async health(): Promise<Health> {
    if (MOCK) { await latency(180); return fx.mockHealth; }
    return call<Health>("/api/health");
  },

  async sessions(): Promise<Session[]> {
    if (MOCK) { await latency(420); return fx.mockSessions; }
    const r = await call<{ sessions: Session[] }>("/api/sessions");
    return r.sessions;
  },

  async context(session_id: string): Promise<ContextReport> {
    if (MOCK) { await latency(700); return fx.mockContext; }
    return call<ContextReport>("/api/analyze/context", { session_id });
  },

  async squeeze(session_id: string, use_llm: boolean): Promise<SqueezeReport> {
    if (MOCK) {
      await latency(use_llm ? 1100 : 600);
      if (use_llm) return fx.mockSqueeze;
      // prefilter-only run: no LLM pass, so llm_tokens collapse to the prefilter figure
      return {
        rows: fx.mockSqueeze.rows.map((r) => ({
          ...r, llm_tokens: r.prefilter_tokens, pct_saved_total: r.pct_saved_prefilter, fidelity: 1, failures: 0,
        })),
        totals: {
          ...fx.mockSqueeze.totals,
          llm_tokens: fx.mockSqueeze.totals.prefilter_tokens,
          pct_saved_total: fx.mockSqueeze.totals.pct_saved_prefilter,
          fidelity: 1, failures: 0,
        },
      };
    }
    return call<SqueezeReport>("/api/analyze/squeeze", { session_id, use_llm });
  },

  async memory(memory_dir?: string): Promise<MemoryReport> {
    if (MOCK) { await latency(560); return fx.mockMemory; }
    return call<MemoryReport>("/api/analyze/memory", memory_dir ? { memory_dir } : {});
  },

  async bench(): Promise<BenchReport> {
    if (MOCK) { await latency(820); return fx.mockBench; }
    return call<BenchReport>("/api/bench/memory", {});
  },
};
