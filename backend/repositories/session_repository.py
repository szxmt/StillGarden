from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from server_config import find_vault_root, normalize_session_room, outbox_path, session_log_path
from server_storage import append_jsonl


def relative_path(path: Path) -> str:
    return str(path.relative_to(find_vault_root()))


def append_session_record(room: str, record: dict) -> Path:
    path = session_log_path(normalize_session_room(room))
    append_jsonl(path, record)
    return path


def append_outbox_record(room: str, record: dict) -> Path:
    path = outbox_path(normalize_session_room(room))
    append_jsonl(path, record)
    return path


def read_session_entries(room: str, limit: int = 12) -> list[dict]:
    safe_room = normalize_session_room(room)
    path = session_log_path(safe_room)
    entries: deque[dict] = deque(maxlen=max(1, min(limit, 500)))
    if path.is_file():
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                clean_line = line.lstrip("\ufeff").strip()
                if not clean_line:
                    continue
                try:
                    entries.append(json.loads(clean_line))
                except json.JSONDecodeError:
                    continue
    return list(entries)


def search_session_entries(room: str, query: str, limit: int = 60) -> list[dict]:
    safe_room = normalize_session_room(room)
    path = session_log_path(safe_room)
    needle = (query or "").strip().lower()
    matches: deque[dict] = deque(maxlen=max(1, min(limit, 200)))
    if path.is_file() and needle:
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                clean_line = line.lstrip("\ufeff").strip()
                if not clean_line:
                    continue
                try:
                    entry = json.loads(clean_line)
                except json.JSONDecodeError:
                    continue
                text = str(entry.get("text", ""))
                if needle in text.lower():
                    matches.append(entry)
    return list(reversed(matches))


def session_relative_path(room: str) -> str:
    return relative_path(session_log_path(normalize_session_room(room)))


def outbox_relative_path(room: str) -> str:
    return relative_path(outbox_path(normalize_session_room(room)))

