import type {
  BenchReport, ContextReport, Health, MemoryReport, Session, SqueezeReport, TimelinePoint,
} from "./types";

/* Fixtures built on real measured numbers from a live Claude Code session so
   screenshots are honest:
     tool results = 69.6% of context
     mcp__claude-in-chrome__computer  284 calls / 12,526,635 chars / 92.6% of tool output
     Bash                             462 calls /    475,386 chars /  3.5%
     Read                              37 calls /    121,076 chars                        */

const CHARS_PER_TOKEN = 3.7;
const tok = (chars: number) => Math.round(chars / CHARS_PER_TOKEN);

export const mockHealth: Health = {
  ok: true,
  engines: { ctxlens: true, squeeze: true, memlint: true, membench: true, memcheck: true },
};

const now = Date.now() / 1000;

export const mockSessions: Session[] = [
  { id: "6ab80357-bb82-4b28-9a72-59ebf9cf0315", path: "~/.claude/projects/-Users-parthsingh/6ab80357.jsonl", mtime: now - 640, size_bytes: 18_940_112, n_messages: 1284, label: "agentops-console — browser QA loop" },
  { id: "c1f4a90e-2d77-4b18-9a02-7714ce0b1a55", path: "~/.claude/projects/-Users-parthsingh/c1f4a90e.jsonl", mtime: now - 7_920, size_bytes: 4_210_880, n_messages: 612, label: "dynamo — alert-inhibition-retune" },
  { id: "0b2d55c7-8e31-4a6f-b0d9-31ab55f0c9e2", path: "~/.claude/projects/-Users-parthsingh/0b2d55c7.jsonl", mtime: now - 86_400 * 2, size_bytes: 1_046_512, n_messages: 188, label: "vault — weekly digest sweep" },
  { id: "9d7e1a44-51c2-4fb8-8a63-0cc9d1e77bf1", path: "~/.claude/projects/-Users-parthsingh/9d7e1a44.jsonl", mtime: now - 86_400 * 5, size_bytes: 302_884, n_messages: 74, label: "oss-stack — n8n bring-up" },
];

const TOOLS = [
  { name: "mcp__claude-in-chrome__computer", count: 284, chars: 12_526_635, pct_of_tool_result_chars: 92.6 },
  { name: "Bash", count: 462, chars: 475_386, pct_of_tool_result_chars: 3.5 },
  { name: "Read", count: 37, chars: 121_076, pct_of_tool_result_chars: 0.9 },
  { name: "mcp__claude-in-chrome__read_page", count: 96, chars: 214_803, pct_of_tool_result_chars: 1.6 },
  { name: "Grep", count: 128, chars: 88_412, pct_of_tool_result_chars: 0.7 },
  { name: "Edit", count: 154, chars: 42_990, pct_of_tool_result_chars: 0.3 },
  { name: "Glob", count: 61, chars: 30_118, pct_of_tool_result_chars: 0.2 },
  { name: "Write", count: 39, chars: 27_640, pct_of_tool_result_chars: 0.2 },
];

const TOOL_TOTAL = TOOLS.reduce((s, t) => s + t.chars, 0);
const TOTAL_CHARS = Math.round(TOOL_TOTAL / 0.696);

function timeline(n: number): TimelinePoint[] {
  // heavy screenshot bursts -> visible step-ladder growth, not a smooth curve
  const pts: TimelinePoint[] = [];
  let cum = 0;
  let cache = 0;
  for (let i = 0; i <= n; i += 8) {
    const burst = i > n * 0.18 && i % 56 < 24 ? 41_000 : 2_400;
    cum += burst * (0.55 + ((i * 2654435761) % 1000) / 1400);
    if (i > n * 0.3) cache += burst * 0.42;
    pts.push({ i, cum_est_tokens: Math.round(cum), cache_read: Math.round(cache) });
  }
  return pts;
}

export const mockContext: ContextReport = {
  n_messages: 1284,
  total_chars: TOTAL_CHARS,
  total_est_tokens: tok(TOTAL_CHARS),
  categories: [
    { category: "tool_result", chars: TOOL_TOTAL, est_tokens: tok(TOOL_TOTAL), pct_of_transcript_chars: 69.6, count: 1261 },
    { category: "assistant_text", chars: Math.round(TOTAL_CHARS * 0.121), est_tokens: tok(TOTAL_CHARS * 0.121), pct_of_transcript_chars: 12.1, count: 1284 },
    { category: "tool_use", chars: Math.round(TOTAL_CHARS * 0.083), est_tokens: tok(TOTAL_CHARS * 0.083), pct_of_transcript_chars: 8.3, count: 1261 },
    { category: "system_prompt", chars: Math.round(TOTAL_CHARS * 0.056), est_tokens: tok(TOTAL_CHARS * 0.056), pct_of_transcript_chars: 5.6, count: 1 },
    { category: "user_text", chars: Math.round(TOTAL_CHARS * 0.028), est_tokens: tok(TOTAL_CHARS * 0.028), pct_of_transcript_chars: 2.8, count: 46 },
    { category: "thinking", chars: Math.round(TOTAL_CHARS * 0.016), est_tokens: tok(TOTAL_CHARS * 0.016), pct_of_transcript_chars: 1.6, count: 312 },
  ],
  tools: TOOLS.map((t) => ({
    ...t,
    est_tokens: tok(t.chars),
    mean: Math.round(t.chars / t.count),
    p95: Math.round((t.chars / t.count) * (t.name.includes("computer") ? 1.32 : 3.6)),
  })),
  top10: [
    { tool: "mcp__claude-in-chrome__computer", preview: "[screenshot] 1512x982 viewport, base64 PNG, tab 'AgentOps Console — Context Lens'", chars: 62_884 },
    { tool: "mcp__claude-in-chrome__computer", preview: "[screenshot] 1512x982 viewport, base64 PNG, tab 'AgentOps Console — Squeeze'", chars: 61_402 },
    { tool: "mcp__claude-in-chrome__computer", preview: "[screenshot] 1512x982 viewport after scroll_to ref_41", chars: 60_115 },
    { tool: "mcp__claude-in-chrome__computer", preview: "[screenshot] 1512x982 viewport, dark theme repaint", chars: 59_774 },
    { tool: "mcp__claude-in-chrome__read_page", preview: "accessibility tree, 412 nodes, root main[ref_0] > section[ref_3] > table[ref_18]…", chars: 21_339 },
    { tool: "Bash", preview: "npm run build — ▲ Next.js 16.3.2 · Creating an optimized production build …", chars: 9_884 },
    { tool: "Read", preview: "src/app/globals.css — 1..420 (design tokens, glass tiers, motion)", chars: 8_612 },
    { tool: "Bash", preview: "node scripts/validate_palette.js '#04a3be,#c38406,…' --mode dark", chars: 4_118 },
    { tool: "Grep", preview: "backdrop-filter — 22 matches across 6 files", chars: 3_402 },
    { tool: "Edit", preview: "src/components/charts/Treemap.tsx — squarify() slice direction", chars: 2_884 },
  ],
  timeline: timeline(1284),
};

export const mockSqueeze: SqueezeReport = {
  rows: [
    { tool: "mcp__claude-in-chrome__computer", n: 284, orig_tokens: 3_385_577, prefilter_tokens: 402_884, llm_tokens: 118_442, pct_saved_prefilter: 88.1, pct_saved_total: 96.5, fidelity: 0.918, failures: 3 },
    { tool: "mcp__claude-in-chrome__read_page", n: 96, orig_tokens: 58_055, prefilter_tokens: 24_118, llm_tokens: 11_902, pct_saved_prefilter: 58.5, pct_saved_total: 79.5, fidelity: 0.944, failures: 1 },
    { tool: "Bash", n: 462, orig_tokens: 128_483, prefilter_tokens: 61_204, llm_tokens: 38_770, pct_saved_prefilter: 52.4, pct_saved_total: 69.8, fidelity: 0.971, failures: 2 },
    { tool: "Read", n: 37, orig_tokens: 32_723, prefilter_tokens: 27_015, llm_tokens: 24_882, pct_saved_prefilter: 17.4, pct_saved_total: 24.0, fidelity: 0.996, failures: 0 },
    { tool: "Grep", n: 128, orig_tokens: 23_895, prefilter_tokens: 12_440, llm_tokens: 9_118, pct_saved_prefilter: 47.9, pct_saved_total: 61.8, fidelity: 0.982, failures: 0 },
    { tool: "Glob", n: 61, orig_tokens: 8_140, prefilter_tokens: 5_002, llm_tokens: 4_411, pct_saved_prefilter: 38.6, pct_saved_total: 45.8, fidelity: 0.999, failures: 0 },
  ],
  totals: {
    orig_tokens: 3_636_873, prefilter_tokens: 532_663, llm_tokens: 207_525,
    pct_saved_prefilter: 85.4, pct_saved_total: 94.3, fidelity: 0.926, failures: 6,
  },
};

export const mockMemory: MemoryReport = {
  totals: { n_memories: 186, est_tokens: 41_882, proposed_evict: 23, proposed_review: 31 },
  memories: [
    { name: "dynamo-law-cold-probes-overestimate-gate-agents", type: "law", index_mentions: 4, body_recalls: 11, dead_paths: 0, age_days: 7, verdict: "keep", reasons: ["recalled 11x in the last 30 days", "no dead references"] },
    { name: "openclaw-hermes-integration", type: "env", index_mentions: 1, body_recalls: 0, dead_paths: 3, age_days: 214, verdict: "evict", reasons: ["never recalled since indexed", "3 paths no longer exist (~/Developer/openclaw, …)", "superseded by hermes-agent-local-model"] },
    { name: "heavy-models-mlx", type: "env", index_mentions: 1, body_recalls: 0, dead_paths: 2, age_days: 198, verdict: "evict", reasons: ["never recalled since indexed", "2 dead paths (~/models/colibri-70b)"] },
    { name: "local-model-proxy-port-collision", type: "gotcha", index_mentions: 2, body_recalls: 6, dead_paths: 0, age_days: 41, verdict: "keep", reasons: ["recalled 6x", "still reproducible on :8081"] },
    { name: "ollama-model-lineup", type: "env", index_mentions: 1, body_recalls: 2, dead_paths: 1, age_days: 63, verdict: "review", reasons: ["1 dead path (LM Studio removed 2026-08-17)", "contradicts hermes-agent-local-model on the runtime"] },
    { name: "machine-cleanup-2026-07", type: "session", index_mentions: 1, body_recalls: 0, dead_paths: 0, age_days: 40, verdict: "evict", reasons: ["session note, never recalled", "content folded into ai-setup-audit-2026-07"] },
    { name: "claude-code-brain-switchers", type: "gotcha", index_mentions: 1, body_recalls: 1, dead_paths: 0, age_days: 88, verdict: "review", reasons: ["single recall in 88 days", "narrow applicability"] },
    { name: "dynamo-master-ledger", type: "index", index_mentions: 9, body_recalls: 34, dead_paths: 0, age_days: 12, verdict: "keep", reasons: ["highest-traffic memory in the store"] },
    { name: "business-idea-research-2026-07", type: "research", index_mentions: 1, body_recalls: 0, dead_paths: 0, age_days: 47, verdict: "review", reasons: ["never recalled", "no dead references — may still be dormant, not dead"] },
    { name: "kronos-project-location", type: "env", index_mentions: 1, body_recalls: 3, dead_paths: 0, age_days: 120, verdict: "keep", reasons: ["recalled 3x", "path still resolves"] },
    { name: "ai-command-center-ollama-fix", type: "gotcha", index_mentions: 1, body_recalls: 0, dead_paths: 2, age_days: 156, verdict: "evict", reasons: ["never recalled", "2 dead paths", "Ollama config rewritten since"] },
    { name: "documents-project-vaults", type: "index", index_mentions: 2, body_recalls: 5, dead_paths: 0, age_days: 92, verdict: "keep", reasons: ["recalled 5x across 3 projects"] },
  ],
  contradictions: [
    { a: "hermes-agent-local-model", b: "ollama-model-lineup", cosine: 0.94, verdict: "same claim, different runtime — LM Studio vs Ollama :11434" },
    { a: "model-routing-bottom-up", b: "routing-is-continuous", cosine: 0.91, verdict: "overlapping routing rules; merge into one" },
    { a: "openclaw-hermes-integration", b: "hermes-agent-local-model", cosine: 0.88, verdict: "stale probe port :1234 vs current :11434" },
  ],
};

export const mockBench: BenchReport = {
  rows: [
    { backend: "embed", "recall@k": 0.983, "precision@k": 0.612, "staleness@1": 0.467, "leak_rate@k": 1.0, contradiction_resolution: 0.34, tokens_per_query: 1_842 },
    { backend: "grep", "recall@k": 0.933, "precision@k": 0.548, "staleness@1": 0.4, "leak_rate@k": 0.95, contradiction_resolution: 0.21, tokens_per_query: 2_410 },
    { backend: "recency", "recall@k": 0.75, "precision@k": 0.704, "staleness@1": 0.05, "leak_rate@k": 0.167, contradiction_resolution: 0.58, tokens_per_query: 906 },
  ],
};
