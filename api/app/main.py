"""AgentOps Console API.

Sync endpoints (fast, no model calls): /api/health, /api/sessions,
/api/analyze/context, /api/analyze/squeeze when use_llm=false.

Job-based endpoints (return {"job_id": ...}; poll GET /api/jobs/{id} for
{"status": "running"|"done"|"error", "result": ...}): /api/analyze/squeeze
when use_llm=true, /api/analyze/memory, /api/bench/memory. These all touch
Ollama and are serialized behind a single worker (see app/jobs.py) because
concurrent Ollama requests make every caller look hung.

Binds 127.0.0.1 only -- see `uv run uvicorn app.main:app` in the README,
and the __main__ block below for `uv run python -m app.main`.
"""
import threading

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import engines, sessions
from .jobs import JobStore

app = FastAPI(
    title="AgentOps Console API",
    description=(
        "Wraps ctxlens/squeeze/memgc/membench (read-only) for the AgentOps Console UI.\n\n"
        "**Sync** (respond immediately with the result): `/api/health`, `/api/sessions`, "
        "`/api/analyze/context`, `/api/analyze/squeeze` with `use_llm=false`.\n\n"
        "**Job-based** (respond with `{\"job_id\"}`, poll `GET /api/jobs/{id}`): "
        "`/api/analyze/squeeze` with `use_llm=true`, `/api/analyze/memory`, `/api/bench/memory`. "
        "These call Ollama and are serialized one-at-a-time behind a single worker thread."
    ),
)
app.add_middleware(
    CORSMiddleware,
    # Any loopback port: the frontend may run on 3000/3010/etc. Still localhost-only.
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs = JobStore()
_cache: dict = {}
_cache_lock = threading.Lock()


def _cache_get(key):
    with _cache_lock:
        return _cache.get(key)


def _cache_set(key, value):
    with _cache_lock:
        _cache[key] = value


# ---------------------------------------------------------------------------
# Error shape: contract requires {"error": "message"} on every non-2xx, not
# FastAPI's default {"detail": ...}.

@app.exception_handler(HTTPException)
async def _http_exc_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def _validation_exc_handler(request, exc):
    return JSONResponse(status_code=422, content={"error": "invalid request body"})


@app.exception_handler(Exception)
async def _unhandled_exc_handler(request, exc):
    return JSONResponse(status_code=500, content={"error": "internal error"})


# ---------------------------------------------------------------------------
# Request bodies

class SessionIdBody(BaseModel):
    session_id: str


class SqueezeBody(BaseModel):
    session_id: str
    use_llm: bool = False


class MemoryBody(BaseModel):
    memory_dir: str | None = None


def _resolve_session_or_404(session_id: str) -> str:
    path = sessions.resolve_session_id(session_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id!r}")
    return path


# ---------------------------------------------------------------------------
# Routes

@app.get("/api/health")
def health():
    return {"ok": True, "engines": engines.probe_all()}


@app.get("/api/sessions")
def list_sessions():
    return {"sessions": sessions.list_sessions()}


@app.post("/api/analyze/context")
def analyze_context(body: SessionIdBody):
    path = _resolve_session_or_404(body.session_id)
    key = ("context", body.session_id)
    cached = _cache_get(key)
    if cached is not None:
        return cached
    try:
        result = engines.analyze_context(path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ctxlens failed: {e}")
    _cache_set(key, result)
    return result


@app.post("/api/analyze/squeeze")
def analyze_squeeze(body: SqueezeBody):
    path = _resolve_session_or_404(body.session_id)
    key = ("squeeze", body.session_id, body.use_llm)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    if not body.use_llm:
        try:
            result = engines.analyze_squeeze(path, use_llm=False)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"squeeze failed: {e}")
        _cache_set(key, result)
        return result

    def _job():
        result = engines.analyze_squeeze(path, use_llm=True)
        _cache_set(key, result)
        return result

    return {"job_id": jobs.submit(_job)}


@app.post("/api/analyze/memory")
def analyze_memory(body: MemoryBody):
    memory_dir = body.memory_dir or sessions.DEFAULT_MEMORY_DIR
    real = sessions.validate_memory_dir(memory_dir)
    if real is None:
        raise HTTPException(status_code=400,
                             detail=f"memory_dir not allowed or not found: {memory_dir!r}")

    key = ("memory", real)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    def _job():
        result = engines.analyze_memory(real)
        _cache_set(key, result)
        return result

    return {"job_id": jobs.submit(_job)}


@app.post("/api/bench/memory")
def bench_memory():
    key = ("bench",)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    def _job():
        result = engines.bench_memory()
        _cache_set(key, result)
        return result

    return {"job_id": jobs.submit(_job)}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"unknown job_id: {job_id!r}")
    return job


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
