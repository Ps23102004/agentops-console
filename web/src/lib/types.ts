export type Health = { ok: boolean; engines: Record<string, boolean> };

export type Session = {
  id: string;
  path: string;
  mtime: number;
  size_bytes: number;
  n_messages: number;
  label: string;
};

export type Category = { category: string; chars: number; est_tokens: number; pct_of_transcript_chars: number; count: number };
export type ToolStat = {
  name: string; count: number; chars: number; est_tokens: number;
  pct_of_tool_result_chars: number; mean: number; p95: number;
};
export type TopItem = { tool: string; preview: string; chars: number };
/** cache_read is null when the transcript event carried no cache-read figure. */
export type TimelinePoint = { i: number; cum_est_tokens: number; cache_read: number | null };

export type ContextReport = {
  n_messages: number;
  total_chars: number;
  total_est_tokens: number;
  categories: Category[];
  tools: ToolStat[];
  top10: TopItem[];
  timeline: TimelinePoint[];
};

export type SqueezeRow = {
  tool: string; n: number;
  orig_tokens: number; prefilter_tokens: number; llm_tokens: number;
  pct_saved_prefilter: number; pct_saved_total: number;
  /** null when fidelity wasn't checkable for this tool (no verifiable facts in its output). */
  fidelity: number | null; failures: number;
};
export type SqueezeReport = {
  rows: SqueezeRow[];
  totals: {
    orig_tokens: number; prefilter_tokens: number; llm_tokens: number;
    pct_saved_prefilter: number; pct_saved_total: number; fidelity: number | null; failures: number;
  };
};

export type Memory = {
  name: string; type: string;
  index_mentions: number; body_recalls: number; dead_paths: number;
  /** null when the memory has no `modified` frontmatter to compute an age from. */
  age_days: number | null; verdict: "keep" | "review" | "evict" | string;
  reasons: string[];
};
export type Contradiction = { a: string; b: string; cosine: number | null; verdict: string };
export type MemoryReport = {
  totals: { n_memories: number; est_tokens: number; proposed_evict: number; proposed_review: number };
  memories: Memory[];
  contradictions: Contradiction[];
};

export type BenchRow = {
  backend: string;
  "recall@k": number;
  "precision@k": number;
  /** null when the backend abstained (returned no results) for that probe set. */
  "staleness@1": number | null;
  "leak_rate@k": number | null;
  contradiction_resolution: number | null;
  tokens_per_query: number;
};
export type BenchReport = { rows: BenchRow[] };
