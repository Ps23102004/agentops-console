# AgentOps Console API

FastAPI backend that wraps five read-only analysis engines (ctxlens, squeeze,
memgc, membench; agentvcr is health-checked only, per the contract) as a JSON
API for the AgentOps Console frontend. Binds `127.0.0.1` only.

## Run

```bash
cd /Users/parthsingh/Developer/agentops-console/api
uv run uvicorn app.main:app --port 8000
# or: uv run python -m app.main
```

Interactive docs (marks sync vs job-based endpoints): http://127.0.0.1:8000/docs

## Test

```bash
uv run pytest test_api.py -v
```

No network is used in tests: the FastAPI `TestClient` drives the app
in-process, and the job-store tests exercise `app/jobs.py` directly.

## Endpoints

| Endpoint | Mode | Notes |
|---|---|---|
| `GET /api/health` | sync | probes each engine's importability |
| `GET /api/sessions` | sync | stats `~/.claude/projects/**/*.jsonl`; `n_messages` is a capped-read estimate, not a full parse |
| `POST /api/analyze/context` | sync | ctxlens; body `{"session_id"}` |
| `POST /api/analyze/squeeze` | **sync if `use_llm=false`, job if `use_llm=true`** | squeeze; body `{"session_id","use_llm"}` |
| `POST /api/analyze/memory` | job | memgc `plan` (never `apply`); body `{"memory_dir"?}`, defaults to `~/.claude/projects/-Users-parthsingh/memory` |
| `POST /api/bench/memory` | job | membench leaderboard; body `{}` |
| `GET /api/jobs/{id}` | sync | `{"status":"running"\|"done"\|"error","result":...}` |

Job-based endpoints return `{"job_id"}` immediately; poll `/api/jobs/{id}`
for the result. All model-dependent work (squeeze `--llm`, memgc's
contradiction embeddings, membench's embed backend) is funneled through a
single-worker thread pool (`app/jobs.py`), so Ollama only ever sees one
request at a time from this process — concurrent calls otherwise make every
caller look hung.

Errors are always `{"error": "message"}` with a non-2xx status.

## Security

- `session_id` is an opaque hash, resolved server-side against files this
  process itself discovered under `~/.claude/projects` — a client can never
  hand the API a filesystem path directly (`app/sessions.py`).
- `memory_dir` is `realpath`-resolved and must still land under
  `~/.claude/projects`; anything else (traversal, absolute paths elsewhere)
  is rejected as 400/404.
- memgc is only ever invoked as `plan`, never `apply`. Nothing in the five
  engine repos is imported for mutation or written to.

## What was cut

- **In-flight dedup**: two concurrent requests for the same uncached
  (engine, params) key each start their own job rather than sharing one —
  fine at console-sized concurrency; add a per-key in-flight lock if that
  ever double-runs a slow job.
- **Job persistence**: jobs live in memory and vanish on restart, per the
  "no Celery, no Redis" instruction.
- **Line-count budget**: total app code (`app/*.py`) is 499 lines, under the
  600-line target; `test_api.py` (109 lines) is additional, since the task
  separately specified concrete test coverage.
