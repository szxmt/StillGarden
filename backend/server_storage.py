from __future__ import annotations

import base64
import json
import re
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from server_config import (
    find_vault_root,
    profile_assets_path,
    prototype_assets_root,
    secrets_path,
)


def read_json_dict(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_json_dict(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def append_jsonl(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_jsonl_events(path: Path, limit: int = 50) -> list[dict]:
    entries: deque[dict] = deque(maxlen=max(1, min(limit, 1000)))
    if path.is_file():
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                if not line.strip():
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return list(entries)


def read_secrets() -> dict:
    return read_json_dict(secrets_path())


def write_secrets(data: dict) -> None:
    write_json_dict(secrets_path(), data)


def read_profile_assets() -> dict:
    return read_json_dict(profile_assets_path())


def write_profile_assets(data: dict) -> None:
    write_json_dict(profile_assets_path(), data)


def flatten_profile_assets(data: dict) -> dict:
    result: dict[str, dict[str, str]] = {}
    for room, assets in data.items():
        if not isinstance(assets, dict):
            continue
        result[str(room)] = {
            str(kind): str(info.get("url", ""))
            for kind, info in assets.items()
            if isinstance(info, dict) and info.get("url")
        }
    return result


def decode_image_data_url(data_url: str, max_bytes: int = 8_000_000) -> tuple[str, bytes, str] | None:
    match = re.match(r"^data:(image/(png|jpeg|jpg|webp|gif));base64,(.+)$", str(data_url or ""), re.S)
    if not match:
        return None
    mime_type = match.group(1)
    try:
        raw = base64.b64decode(match.group(3), validate=True)
    except Exception:
        return None
    if len(raw) > max_bytes:
        limit_mb = max(1, max_bytes // 1_000_000)
        raise ValueError(f"图片太大，先选 {limit_mb}MB 以下的小图。")
    ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(mime_type, ".img")
    return mime_type, raw, ext


def write_prototype_image_asset(folder_name: str, prefix: str, data_url: str, max_bytes: int = 8_000_000) -> dict:
    decoded = decode_image_data_url(data_url, max_bytes=max_bytes)
    if not decoded:
        return {"ok": False, "message": "图片格式不正确。"}
    mime_type, raw, ext = decoded
    folder = prototype_assets_root() / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    safe_prefix = re.sub(r"[^a-zA-Z0-9_-]+", "-", prefix).strip("-") or "asset"
    filename = f"{safe_prefix}-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{uuid.uuid4().hex[:8]}{ext}"
    file_path = folder / filename
    file_path.write_bytes(raw)
    return {
        "ok": True,
        "url": f"/assets/prototype/{quote(folder_name)}/{quote(filename)}",
        "relative_path": str(file_path.relative_to(find_vault_root())),
        "mime_type": mime_type,
    }


def save_profile_asset(data: dict) -> dict:
    room = str(data.get("room", "linxu")).strip()
    if room not in {"me", "linxu", "dengdeng", "aimas", "living"}:
        room = "linxu"
    kind = str(data.get("kind", "")).strip()
    if kind not in {"avatar", "background", "chat_background", "moment_background"}:
        return {"ok": False, "message": "资产类型不支持。"}
    try:
        saved = write_prototype_image_asset("profile", f"{room}-{kind}", str(data.get("data_url", "")))
    except ValueError as error:
        return {"ok": False, "message": str(error)}
    if not saved.get("ok"):
        return saved
    manifest = read_profile_assets()
    room_assets = manifest.get(room)
    if not isinstance(room_assets, dict):
        room_assets = {}
    room_assets[kind] = {
        "url": saved["url"],
        "relative_path": saved["relative_path"],
        "mime_type": saved["mime_type"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest[room] = room_assets
    write_profile_assets(manifest)
    return {
        "ok": True,
        "url": room_assets[kind]["url"],
        "relative_path": room_assets[kind]["relative_path"],
        "assets": flatten_profile_assets(manifest),
        "manifest_path": str(profile_assets_path().relative_to(find_vault_root())),
    }


def clear_profile_assets(data: dict) -> dict:
    room = str(data.get("room", "linxu")).strip()
    if room not in {"me", "linxu", "dengdeng", "aimas", "living"}:
        room = "linxu"
    kinds = data.get("kinds")
    if not isinstance(kinds, list):
        kinds = ["avatar", "background"]
    clean_kinds = {str(kind) for kind in kinds if str(kind) in {"avatar", "background", "chat_background", "moment_background"}}
    manifest = read_profile_assets()
    if room in manifest and isinstance(manifest[room], dict):
        for kind in clean_kinds:
            manifest[room].pop(kind, None)
        if not manifest[room]:
            manifest.pop(room, None)
    write_profile_assets(manifest)
    return {
        "ok": True,
        "assets": flatten_profile_assets(manifest),
        "manifest_path": str(profile_assets_path().relative_to(find_vault_root())),
    }
