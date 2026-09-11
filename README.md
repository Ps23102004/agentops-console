# AgentOps Console

One console over five agent-analysis engines: see what an agent did to your context and your memory, and what it would cost to fix. FastAPI backend + Liquid Glass web UI, running entirely on your own local session data. Everything is read-only -- nothing here edits a transcript or a memory file.

## The five engines

| Engine | What it answers |
|---|---|
| ctxlens | Flamegraph for your context window -- which calls filled it |
| squeeze | Compress tool output before your expensive model ever sees it |
| memgc | Garbage collector for agent memory -- what can be forgotten |
| membench | Does your agent's memory actually work? Recall vs. staleness, honestly measured |
| agentvcr | VCR cassettes for agent runs -- record once, replay deterministically (health-checked) |

## Run it

Backend:

```bash
cd api
uv run uvicorn app.main:app --port 8000   # interactive docs at http://127.0.0.1:8000/docs
```

Frontend:

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

The web UI runs in **mock mode** by default -- no backend needed, every screen populated with fixtures built on real measured numbers from a live agent session. To point it at the real API: `cp web/.env.example web/.env.local`, then set `NEXT_PUBLIC_MOCK=0` and `NEXT_PUBLIC_API_BASE=http://localhost:8000`.

See [api/README.md](api/README.md) and [web/README.md](web/README.md) for full details.
