"""Wrappers around the five engine repos: subprocess `python3 -m <pkg>` calls
plus a thin adapter layer that reshapes each engine's own JSON into the exact
API contract shape. Nothing in these five repos is imported for mutation and
nothing is ever invoked in a writing mode -- memgc is called in `plan` mode
only, never `apply`.
"""
import json
import subprocess
import sys
from datetime import datetime, timezone

CTXLENS_DIR = "/Users/parthsingh/Developer/ctxlens"
SQUEEZE_DIR = "/Users/parthsingh/Developer/squeeze"
MEMGC_DIR = "/Users/parthsingh/Developer/memgc"
MEMBENCH_DIR = "/Users/parthsingh/Developer/membench"
AGENTVCR_DIR = "/Users/parthsingh/Developer/agentvcr"

# memgc.parse.load_records is pure, read-only .md parsing (no Ollama, no
# writes) -- imported in-process just to recover each record's `modified`
# date for age_days, since memgc's own `plan` JSON doesn't carry it.
sys.path.insert(0, MEMGC_DIR)
from memgc.parse import load_records  # noqa: E402


def _probe_import(repo_dir: str, module: str, timeout: float = 5) -> bool:
    try:
        r = subprocess.run([sys.executable, "-c", f"import {module}"],
                            cwd=repo_dir, capture_output=True, timeout=timeout)
        return r.returncode == 0
    except Exception:
        return False


def probe_all() -> dict:
    return {
        "ctxlens": _probe_import(CTXLENS_DIR, "ctxlens"),
        "squeeze": _probe_import(SQUEEZE_DIR, "squeeze"),
        "memgc": _probe_import(MEMGC_DIR, "memgc"),
        "membench": _probe_import(MEMBENCH_DIR, "membench"),
        "agentvcr": _probe_import(AGENTVCR_DIR, "agentvcr"),
    }


def run_json_cli(repo_dir: str, module: str, args: list[str], timeout: float) -> dict:
    proc = subprocess.run([sys.executable, "-m", module, *args],
                           cwd=repo_dir, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"{module} exited {proc.returncode}: {proc.stderr[-2000:]}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"{module} produced invalid JSON: {e}")


# ---------------------------------------------------------------------------
# ctxlens -> /api/analyze/context

def adapt_ctxlens(report: dict) -> dict:
    top10 = [{"tool": t["tool"], "preview": t["preview"], "chars": t["chars"]}
              for t in report["top10"]]
    timeline = [{"i": i, "cum_est_tokens": cum, "cache_read": cache}
                for i, cum, cache in report["timeline"]]
    return {
        "n_messages": report["n_messages"],
        "total_chars": report["total_chars"],
        "total_est_tokens": report["total_est_tokens"],
        "categories": report["categories"],
        "tools": report["tools"],
        "top10": top10,
        "timeline": timeline,
    }


def analyze_context(session_path: str) -> dict:
    report = run_json_cli(CTXLENS_DIR, "ctxlens", [session_path, "--json"], timeout=60)
    return adapt_ctxlens(report)


# ---------------------------------------------------------------------------
# squeeze -> /api/analyze/squeeze

def _squeeze_row(name: str, d: dict, use_llm: bool) -> dict:
    return {
        "tool": name,
        "n": d["n"],
        "orig_tokens": d["orig_tokens"],
        "prefilter_tokens": d["prefilter_tokens"],
        "llm_tokens": d.get("final_tokens") if use_llm else None,
        "pct_saved_prefilter": d["pct_saved_prefilter"],
        "pct_saved_total": d.get("pct_saved_final", d["pct_saved_prefilter"]),
        "fidelity": d.get("final_fidelity_floor_enforced", d["prefilter_fidelity"]),
        "failures": (d.get("llm_empty_fail", 0) + d.get("llm_floor_fail", 0)) if use_llm else 0,
    }


def adapt_squeeze(report: dict, use_llm: bool) -> dict:
    rows = [_squeeze_row(name, d, use_llm) for name, d in report["tools"].items()]
    totals = _squeeze_row("TOTAL", report["total"], use_llm)
    return {"rows": rows, "totals": totals}


def analyze_squeeze(session_path: str, use_llm: bool) -> dict:
    args = ["eval", session_path, "--json"]
    if not use_llm:
        args.append("--no-llm")
    report = run_json_cli(SQUEEZE_DIR, "squeeze", args, timeout=600 if use_llm else 60)
    return adapt_squeeze(report, use_llm)


# ---------------------------------------------------------------------------
# memgc -> /api/analyze/memory

def _age_days(memory_dir: str) -> dict:
    now = datetime.now(timezone.utc)
    out = {}
    for r in load_records(memory_dir):
        if not r.modified:
            out[r.name] = None
            continue
        try:
            dt = datetime.fromisoformat(r.modified.replace("Z", "+00:00"))
            out[r.name] = (now - dt).days
        except ValueError:
            out[r.name] = None
    return out


def adapt_memgc(plan: dict, memory_dir: str) -> dict:
    ages = _age_days(memory_dir)
    rows = plan["rows"]
    memories = [{
        "name": r["name"], "type": r["type"],
        "index_mentions": r["index_mentions"], "body_recalls": r["body_recalls"],
        "dead_paths": r["dead_paths"], "age_days": ages.get(r["name"]),
        "verdict": r["verdict"], "reasons": [r["reason"]] if r["reason"] else [],
    } for r in rows]
    totals = {
        "n_memories": plan["memory_count"],
        "est_tokens": sum(r["tokens"] for r in rows),
        "proposed_evict": sum(1 for r in rows if r["verdict"] == "evict"),
        "proposed_review": sum(1 for r in rows if r["verdict"] == "review"),
    }
    contradictions = [{"a": p["a"], "b": p["b"], "cosine": p["similarity"], "verdict": "contradiction"}
                       for p in plan["contradiction_pairs"]]
    return {"totals": totals, "memories": memories, "contradictions": contradictions}


def analyze_memory(memory_dir: str) -> dict:
    plan = run_json_cli(MEMGC_DIR, "memgc", ["plan", memory_dir, "--json"], timeout=300)
    return adapt_memgc(plan, memory_dir)


# ---------------------------------------------------------------------------
# membench -> /api/bench/memory

_BENCH_COLS = ["recall@k", "precision@k", "staleness@1", "leak_rate@k",
               "contradiction_resolution", "tokens_per_query"]


def adapt_membench(leaderboard: dict) -> dict:
    rows = [{"backend": name, **{k: d.get(k) for k in _BENCH_COLS}}
             for name, d in leaderboard.items()]
    return {"rows": rows}


def bench_memory() -> dict:
    leaderboard = run_json_cli(MEMBENCH_DIR, "membench", ["leaderboard", "--json"], timeout=180)
    return adapt_membench(leaderboard)
