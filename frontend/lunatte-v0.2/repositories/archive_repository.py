from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from server_config import (
    confirmed_memory_path,
    find_vault_root,
    memory_candidate_path,
    normalize_session_room,
    session_log_path,
)
from server_storage import append_jsonl, read_jsonl_events


def relative_path(path: Path) -> str:
    return str(path.relative_to(find_vault_root()))


def read_confirmed_events(limit: int = 40) -> list[dict]:
    return list(reversed(read_jsonl_events(confirmed_memory_path(), limit)))


def append_confirmed_memory(record: dict) -> None:
    append_jsonl(confirmed_memory_path(), record)


def append_memory_candidate(record: dict) -> None:
    append_jsonl(memory_candidate_path(), record)


def read_session_entries_for_day(room: str, day: str, limit: int = 80) -> list[dict]:
    path = session_log_path(normalize_session_room(room))
    entries: deque[dict] = deque(maxlen=max(1, min(limit, 300)))
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            timestamp = str(item.get("timestamp", ""))
            role = str(item.get("role", ""))
            if timestamp.startswith(day) and role in {"user", "assistant"}:
                entries.append(item)
    return list(entries)


def confirmed_memory_count() -> int:
    path = confirmed_memory_path()
    if not path.is_file():
        return 0
    count = 0
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if line.strip():
                count += 1
    return count


def confirmed_memory_relative_path() -> str:
    return relative_path(confirmed_memory_path())


def memory_candidate_relative_path() -> str:
    return relative_path(memory_candidate_path())

