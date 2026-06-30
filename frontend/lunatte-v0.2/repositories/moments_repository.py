from __future__ import annotations

from pathlib import Path

from server_config import find_vault_root, moments_path
from server_storage import append_jsonl, read_jsonl_events
from repositories.assets_repository import save_prototype_image_asset


def relative_path(path: Path) -> str:
    return str(path.relative_to(find_vault_root()))


def read_moment_events(limit: int = 80) -> list[dict]:
    return read_jsonl_events(moments_path(), limit)


def append_moment_event(event: dict) -> None:
    append_jsonl(moments_path(), event)


def save_moment_image(author: str, image_data: str) -> dict:
    return save_prototype_image_asset("moments", f"{author}-moment", image_data)


def moments_relative_path() -> str:
    return relative_path(moments_path())

