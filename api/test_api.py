"""Plain pytest, no network: TestClient drives the app in-process (ASGI, no
real sockets), and the job-store test only exercises app/jobs.py directly.

Covers the four required cases: path traversal rejected, an opaque
session_id resolves correctly, an unknown session_id 404s, and the job
model transitions states.
"""
import json
import os
import threading
import time

from fastapi.testclient import TestClient

from app import sessions
from app.jobs import JobStore
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# path traversal

def test_memory_dir_traversal_rejected():
    resp = client.post("/api/analyze/memory", json={"memory_dir": "/etc"})
    assert resp.status_code == 400
    assert "error" in resp.json()


def test_memory_dir_dotdot_traversal_rejected():
    resp = client.post("/api/analyze/memory",
                        json={"memory_dir": os.path.join(sessions.PROJECTS_DIR, "..", "..", "etc")})
    assert resp.status_code == 400
    assert "error" in resp.json()


# ---------------------------------------------------------------------------
# opaque session_id

def test_session_id_is_opaque_and_resolves(tmp_path, monkeypatch):
    monkeypatch.setattr(sessions, "PROJECTS_DIR", str(tmp_path))
    monkeypatch.setattr(sessions, "_id_to_path", {})
    proj_dir = tmp_path / "-Users-x-Developer-demo"
    proj_dir.mkdir()
    transcript = proj_dir / "abc.jsonl"
    transcript.write_text(json.dumps({"message": {"role": "user", "content": "hi"}}) + "\n")

    found = sessions.list_sessions()
    assert len(found) == 1
    entry = found[0]

    # opaque: never the raw path
    assert entry["id"] != str(transcript)
    assert str(transcript) not in entry["id"]
    assert entry["path"] == str(transcript.resolve())

    resolved = sessions.resolve_session_id(entry["id"])
    assert resolved == str(transcript.resolve())


def test_unknown_session_id_404s():
    resp = client.post("/api/analyze/context", json={"session_id": "not-a-real-id"})
    assert resp.status_code == 404
    assert "error" in resp.json()


def test_unknown_job_id_404s():
    resp = client.get("/api/jobs/not-a-real-job")
    assert resp.status_code == 404
    assert "error" in resp.json()


# ---------------------------------------------------------------------------
# job model state transitions

def test_job_store_transitions_running_to_done():
    store = JobStore()
    gate = threading.Event()

    job_id = store.submit(lambda: (gate.wait(timeout=5), "ok")[1])
    assert store.get(job_id)["status"] == "running"

    gate.set()
    for _ in range(50):
        if store.get(job_id)["status"] != "running":
            break
        time.sleep(0.05)

    job = store.get(job_id)
    assert job["status"] == "done"
    assert job["result"] == "ok"


def test_job_store_transitions_to_error():
    store = JobStore()

    def _boom():
        raise ValueError("kaboom")

    job_id = store.submit(_boom)
    for _ in range(50):
        if store.get(job_id)["status"] != "running":
            break
        time.sleep(0.05)

    job = store.get(job_id)
    assert job["status"] == "error"
    assert "kaboom" in job["result"]
