"""Opaque session ids + path allowlisting.

`session_id` and `memory_dir` are the two trust boundaries in this service:
a client can never hand us a filesystem path directly. Session ids are an
opaque hash resolved server-side against files we ourselves discovered under
PROJECTS_DIR; memory_dir is realpath-resolved and must still land under the
same root. Both close path traversal by construction (a resolved path that
lands outside the root is simply treated as not found).
"""
import glob
import hashlib
import os

PROJECTS_DIR = os.path.realpath(os.path.expanduser("~/.claude/projects"))
DEFAULT_MEMORY_DIR = os.path.join(PROJECTS_DIR, "-Users-parthsingh", "memory")

_LINE_COUNT_CAP = 16384  # bytes -- "cheap line count with a cap", not a full parse

_id_to_path: dict[str, str] = {}  # refreshed on every list_sessions() call


def _hash_path(path: str) -> str:
    return hashlib.sha256(path.encode()).hexdigest()[:24]


def _is_under(path: str, root: str) -> bool:
    path = os.path.realpath(path)
    return path == root or path.startswith(root + os.sep)


def _cheap_line_count(path: str, size_bytes: int) -> int:
    """Newline count over a capped prefix read, extrapolated to the full
    file size. Never reads (let alone parses) the whole 1.5GB corpus."""
    try:
        with open(path, "rb") as f:
            chunk = f.read(_LINE_COUNT_CAP)
    except OSError:
        return 0
    if not chunk:
        return 0
    n = chunk.count(b"\n")
    if size_bytes <= len(chunk):
        return n
    return round(n * (size_bytes / len(chunk)))


def list_sessions() -> list[dict]:
    out = []
    for path in glob.glob(os.path.join(PROJECTS_DIR, "**", "*.jsonl"), recursive=True):
        real = os.path.realpath(path)
        if not _is_under(real, PROJECTS_DIR):
            continue
        try:
            st = os.stat(real)
        except OSError:
            continue
        sid = _hash_path(real)
        _id_to_path[sid] = real
        out.append({
            "id": sid,
            "path": real,
            "mtime": st.st_mtime,
            "size_bytes": st.st_size,
            "n_messages": _cheap_line_count(real, st.st_size),
            "label": os.path.basename(os.path.dirname(real)),
        })
    return out


def resolve_session_id(session_id: str) -> str | None:
    """Opaque id -> real path, or None if unknown / outside the allowlist."""
    path = _id_to_path.get(session_id)
    if path is None:
        list_sessions()  # refresh in case this session appeared since last listing
        path = _id_to_path.get(session_id)
    if path is None or not _is_under(path, PROJECTS_DIR) or not os.path.isfile(path):
        return None
    return path


def validate_memory_dir(memory_dir: str) -> str | None:
    """Resolve + confirm memory_dir sits under the allowlisted root.
    Returns the real path, or None (traversal / outside root / missing)."""
    real = os.path.realpath(memory_dir)
    if not _is_under(real, PROJECTS_DIR) or not os.path.isdir(real):
        return None
    return real
