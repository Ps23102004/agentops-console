"""Dead-simple in-memory job store. No Celery, no Redis, no persistence.

The single worker thread is doing double duty: it's the job runner AND the
required Ollama-serialization lock. Every model-dependent analysis (squeeze
--llm, memgc's contradiction embeddings, membench's embed backend) is
submitted here, so at most one request ever reaches Ollama at a time from
this process -- concurrent model calls are a measured way to make every
caller look hung, not a hypothetical.

# ponytail: jobs live only in RAM and vanish on restart. Fine for a local
# dev console; swap in sqlite if this ever needs to survive a restart mid-job.
"""
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor


class JobStore:
    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)  # the serialization point

    def submit(self, fn) -> str:
        job_id = uuid.uuid4().hex
        with self._lock:
            self._jobs[job_id] = {"status": "running", "result": None}

        def _run():
            try:
                result = fn()
                status = "done"
            except Exception as e:
                result = str(e)
                status = "error"
            with self._lock:
                self._jobs[job_id] = {"status": status, "result": result}

        self._executor.submit(_run)
        return job_id

    def get(self, job_id: str):
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job is not None else None
