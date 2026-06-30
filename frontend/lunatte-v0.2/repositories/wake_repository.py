from __future__ import annotations

import json

from server_config import find_vault_root, wake_inbox_path
from server_storage import append_jsonl


def append_wake_record(record: dict) -> None:
    append_jsonl(wake_inbox_path(), record)


def read_wake_events() -> list[dict]:
    path = wake_inbox_path()
    entries: list[dict] = []
    if not path.is_file():
        return entries
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def wake_relative_path() -> str:
    return str(wake_inbox_path().relative_to(find_vault_root()))

