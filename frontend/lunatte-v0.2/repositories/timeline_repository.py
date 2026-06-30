from __future__ import annotations

from server_config import SESSION_LABELS, confirmed_memory_path, find_vault_root, moments_path, session_log_path
from server_storage import read_jsonl_events


def read_timeline_session_events(room: str, limit: int) -> list[dict]:
    return read_jsonl_events(session_log_path(room), limit)


def read_timeline_moment_events(limit: int) -> list[dict]:
    return read_jsonl_events(moments_path(), limit)


def read_timeline_memory_events(limit: int) -> list[dict]:
    return read_jsonl_events(confirmed_memory_path(), limit)


def timeline_sources() -> dict:
    vault = find_vault_root()
    moments_file = moments_path()
    memory_file = confirmed_memory_path()
    return {
        "session": [str(session_log_path(room).relative_to(vault)) for room in SESSION_LABELS],
        "moments": str(moments_file.relative_to(vault)),
        "archive": str(memory_file.relative_to(vault)),
    }


def source_relative_path(path) -> str:
    return str(path.relative_to(find_vault_root()))

