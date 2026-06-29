from __future__ import annotations

import json
import base64
import difflib
import mimetypes
import os
import re
import subprocess
import sys
import threading
import urllib.error
import urllib.request
import uuid
import webbrowser
from collections import deque
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from server_config import (
    AUTO_WAKE_ORDER,
    AUTO_WAKE_REASONS,
    DEFAULT_CONFIG,
    FRONTEND_CACHE_VERSION,
    SERVICE_STARTED_AT,
    SESSION_LABELS,
    ROOM_TARGETS,
    config_path,
    confirmed_memory_path,
    count_jsonl,
    default_config,
    find_vault_root,
    memory_candidate_path,
    moments_path,
    normalize_session_room,
    outbox_path,
    profile_assets_path,
    prototype_assets_root,
    secrets_path,
    session_log_path,
    wake_inbox_path,
)


def read_secrets() -> dict:
    path = secrets_path()
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_secrets(data: dict) -> None:
    path = secrets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def read_profile_assets() -> dict:
    path = profile_assets_path()
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_profile_assets(data: dict) -> None:
    path = profile_assets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


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


def provider_secret_key(provider_id: str) -> str:
    return str(provider_id or "").strip()[:80]


def update_provider_secret(provider_id: str, api_key: str | None = None, clear: bool = False) -> bool:
    clean_id = provider_secret_key(provider_id)
    if not clean_id:
        return False
    secrets = read_secrets()
    providers = secrets.get("providers")
    if not isinstance(providers, dict):
        providers = {}
    item = providers.get(clean_id)
    if not isinstance(item, dict):
        item = {}
    if clear:
        item.pop("api_key", None)
    elif api_key and api_key.strip():
        item["api_key"] = api_key.strip()
    providers[clean_id] = item
    secrets["providers"] = providers
    write_secrets(secrets)
    return bool(item.get("api_key"))


def provider_secret_saved(provider_id: str) -> bool:
    clean_id = provider_secret_key(provider_id)
    return bool(read_secrets().get("providers", {}).get(clean_id, {}).get("api_key"))


def provider_api_key(provider_id: str) -> str:
    clean_id = provider_secret_key(provider_id)
    return str(read_secrets().get("providers", {}).get(clean_id, {}).get("api_key", ""))


def update_aimas_secret(api_key: str | None = None, clear: bool = False) -> bool:
    secrets = read_secrets()
    aimas = secrets.get("aimas")
    if not isinstance(aimas, dict):
        aimas = {}
    if clear:
        aimas.pop("api_key", None)
    elif api_key and api_key.strip():
        aimas["api_key"] = api_key.strip()
    secrets["aimas"] = aimas
    write_secrets(secrets)
    return bool(aimas.get("api_key"))


def aimas_secret_saved() -> bool:
    return bool(read_secrets().get("aimas", {}).get("api_key"))


def sanitize_custom_provider(item: dict, fallback_name: str = "自定义1") -> dict:
    provider_id = str(item.get("id", "")).strip()[:80] or f"custom-{datetime.now().timestamp()}"
    name = str(item.get("name", "")).strip()[:40] or fallback_name
    return {
        "id": provider_id,
        "name": name,
        "kind": "custom",
        "provider": "custom",
        "base_url": str(item.get("base_url", "")).strip()[:200],
        "model": str(item.get("model", "")).strip()[:80] or "未设置",
        "key_alias": str(item.get("key_alias", "")).strip()[:80],
        "key_saved": False,
        "allow_network": False,
    }


def next_custom_name(custom_providers: list[dict]) -> str:
    used = set()
    for item in custom_providers:
        name = str(item.get("name", "")).strip()
        if name.startswith("自定义") and name[3:].isdigit():
            used.add(int(name[3:]))
    index = 1
    while index in used:
        index += 1
    return f"自定义{index}"


def available_provider_ids(config: dict) -> set[str]:
    ids = set(config.get("providers", {}).keys())
    for item in config.get("custom_providers", []):
        provider_id = str(item.get("id", "")).strip()
        if provider_id:
            ids.add(provider_id)
    return ids


def apply_room_routes(config: dict, routes: dict) -> None:
    if not isinstance(routes, dict):
        return
    valid_ids = available_provider_ids(config)
    for room in ("linxu", "dengdeng"):
        route_id = str(routes.get(room, "")).strip()
        if route_id in valid_ids:
            config["room_routes"][room] = route_id
    config["room_routes"]["living"] = "shared"
    config["room_routes"]["aimas"] = "agent:aimas"


def apply_room_labels(config: dict, labels: dict) -> None:
    if not isinstance(labels, dict):
        return
    for room in SESSION_LABELS:
        value = str(labels.get(room, "")).strip()
        if value:
            config["room_labels"][room] = value[:40]


def normalize_self_access(value: dict) -> dict:
    if not isinstance(value, dict):
        value = {}
    raw_readers = value.get("readers", {})
    if not isinstance(raw_readers, dict):
        raw_readers = {}
    readers = {
        "linxu": bool(raw_readers.get("linxu")),
        "dengdeng": bool(raw_readers.get("dengdeng")),
        "aimas": bool(raw_readers.get("aimas")),
    }
    any_reader = any(readers.values())
    return {
        "enabled": bool(value.get("enabled")) and any_reader,
        "readers": readers if any_reader else {"linxu": False, "dengdeng": False, "aimas": False},
    }


def normalize_moments_auto_comments(value: dict) -> dict:
    if not isinstance(value, dict):
        value = {}
    raw_commenters = value.get("commenters", {})
    if not isinstance(raw_commenters, dict):
        raw_commenters = {}
    commenters = {
        "linxu": bool(raw_commenters.get("linxu")),
        "dengdeng": bool(raw_commenters.get("dengdeng")),
        "aimas": bool(raw_commenters.get("aimas")),
    }
    any_commenter = any(commenters.values())
    try:
        cooldown = int(value.get("cooldown_minutes", DEFAULT_CONFIG["moments_auto_comments"]["cooldown_minutes"]))
    except (TypeError, ValueError):
        cooldown = DEFAULT_CONFIG["moments_auto_comments"]["cooldown_minutes"]
    cooldown = min(1440, max(15, cooldown))

    def clean_time(raw: object, fallback: str) -> str:
        text = str(raw or fallback).strip()
        if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", text):
            return text
        return fallback

    return {
        "enabled": bool(value.get("enabled")) and any_commenter,
        "commenters": commenters if any_commenter else {"linxu": False, "dengdeng": False, "aimas": False},
        "cooldown_minutes": cooldown,
        "quiet_start": clean_time(value.get("quiet_start"), DEFAULT_CONFIG["moments_auto_comments"]["quiet_start"]),
        "quiet_end": clean_time(value.get("quiet_end"), DEFAULT_CONFIG["moments_auto_comments"]["quiet_end"]),
    }


def normalize_user_profile(value: dict) -> dict:
    if not isinstance(value, dict):
        value = {}
    nickname = str(value.get("nickname") or DEFAULT_CONFIG["user_profile"]["nickname"]).strip()[:20]
    return {"nickname": nickname or DEFAULT_CONFIG["user_profile"]["nickname"]}


def merge_config(data: dict) -> dict:
    config = default_config()
    if isinstance(data.get("providers"), dict):
        for provider_id in ("oa", "gg"):
            saved = data["providers"].get(provider_id, {})
            if isinstance(saved, dict):
                config["providers"][provider_id]["model"] = str(saved.get("model", config["providers"][provider_id]["model"])).strip()[:80] or "未设置"
                config["providers"][provider_id]["base_url"] = str(saved.get("base_url", config["providers"][provider_id]["base_url"])).strip()[:200] or config["providers"][provider_id]["base_url"]
                config["providers"][provider_id]["key_alias"] = str(saved.get("key_alias", config["providers"][provider_id].get("key_alias", ""))).strip()[:80]
                config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)

    # Migrate the previous single-provider prototype shape if present.
    if isinstance(data.get("provider"), str) and data.get("provider") in {"openai", "gemini"}:
        provider_id = "oa" if data["provider"] == "openai" else "gg"
        if isinstance(data.get("model"), str) and data["model"].strip():
            config["providers"][provider_id]["model"] = data["model"].strip()[:80]
        if isinstance(data.get("base_url"), str) and data["base_url"].strip():
            config["providers"][provider_id]["base_url"] = data["base_url"].strip()[:200]

    if isinstance(data.get("custom_providers"), list):
        config["custom_providers"] = [
            sanitize_custom_provider(item, f"自定义{index + 1}")
            for index, item in enumerate(data["custom_providers"])
            if isinstance(item, dict)
        ][:20]
        for item in config["custom_providers"]:
            item["key_saved"] = provider_secret_saved(str(item.get("id", "")))

    apply_room_routes(config, data.get("room_routes", {}))
    apply_room_labels(config, data.get("room_labels", {}))
    config["user_profile"] = normalize_user_profile(data.get("user_profile", {}))

    aimas = data.get("agent_connectors", {}).get("aimas", {}) if isinstance(data.get("agent_connectors"), dict) else {}
    if isinstance(aimas.get("endpoint"), str):
        config["agent_connectors"]["aimas"]["endpoint"] = aimas["endpoint"].strip()[:200]
    if isinstance(aimas.get("model"), str):
        config["agent_connectors"]["aimas"]["model"] = aimas["model"].strip()[:80] or "hermes-agent"
    config["self_access"] = normalize_self_access(data.get("self_access", {}))
    config["moments_auto_comments"] = normalize_moments_auto_comments(data.get("moments_auto_comments", {}))
    for provider_id in config.get("providers", {}):
        config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)
    for item in config.get("custom_providers", []):
        item["key_saved"] = provider_secret_saved(str(item.get("id", "")))
    config["api_mode"] = "live_if_configured"
    config["allow_network"] = True
    config["key_storage"] = "not_configured"
    config["key_saved"] = any(provider_secret_saved(provider_id) for provider_id in available_provider_ids(config))
    config["agent_connectors"]["aimas"]["key_saved"] = aimas_secret_saved()
    config["agent_connectors"]["aimas"]["allow_network"] = False
    return config


def read_config() -> dict:
    path = config_path()
    if not path.is_file():
        return default_config()
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return default_config()
    return merge_config(data)


def write_config(data: dict) -> dict:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    config = read_config()
    if data.get("create_custom_provider"):
        if isinstance(data.get("custom_providers"), list):
            config["custom_providers"] = [
                sanitize_custom_provider(item, f"自定义{index + 1}")
                for index, item in enumerate(data["custom_providers"])
                if isinstance(item, dict)
            ][:20]
        name = next_custom_name(config["custom_providers"])
        config["custom_providers"].append(
            sanitize_custom_provider(
                {"id": f"custom-{datetime.now().strftime('%Y%m%d%H%M%S%f')}", "name": name},
                name,
            )
        )
    elif isinstance(data.get("custom_providers"), list):
        config["custom_providers"] = [
            sanitize_custom_provider(item, f"自定义{index + 1}")
            for index, item in enumerate(data["custom_providers"])
            if isinstance(item, dict)
        ][:20]

    if isinstance(data.get("providers"), dict):
        for provider_id in ("oa", "gg"):
            incoming = data["providers"].get(provider_id, {})
            if isinstance(incoming, dict):
                for key in ("model", "base_url", "key_alias"):
                    value = str(incoming.get(key, config["providers"][provider_id][key])).strip()
                    config["providers"][provider_id][key] = value[:200] if key == "base_url" else value[:80]
                config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)

    apply_room_routes(config, data.get("room_routes", {}))
    apply_room_labels(config, data.get("room_labels", {}))
    if "self_access" in data:
        config["self_access"] = normalize_self_access(data.get("self_access", {}))
    if "moments_auto_comments" in data:
        config["moments_auto_comments"] = normalize_moments_auto_comments(data.get("moments_auto_comments", {}))
    if "user_profile" in data:
        config["user_profile"] = normalize_user_profile(data.get("user_profile", {}))

    aimas_endpoint = str(data.get("aimas_endpoint", config["agent_connectors"]["aimas"]["endpoint"])).strip()
    aimas_model = str(data.get("aimas_model", config["agent_connectors"]["aimas"].get("model", "hermes-agent"))).strip()
    config["agent_connectors"]["aimas"]["endpoint"] = aimas_endpoint[:200]
    config["agent_connectors"]["aimas"]["model"] = aimas_model[:80] or "hermes-agent"
    key_saved = update_aimas_secret(
        str(data.get("aimas_api_key", "")).strip(),
        clear=bool(data.get("clear_aimas_api_key")),
    ) if ("aimas_api_key" in data or data.get("clear_aimas_api_key")) else aimas_secret_saved()
    selected_provider_id = str(data.get("selected_provider_id", "")).strip()
    if selected_provider_id in available_provider_ids(config):
        provider_key_saved = update_provider_secret(
            selected_provider_id,
            str(data.get("provider_api_key", "")).strip(),
            clear=bool(data.get("clear_provider_api_key")),
        ) if ("provider_api_key" in data or data.get("clear_provider_api_key")) else provider_secret_saved(selected_provider_id)
        if selected_provider_id in config.get("providers", {}):
            config["providers"][selected_provider_id]["key_saved"] = provider_key_saved
        for item in config.get("custom_providers", []):
            if item.get("id") == selected_provider_id:
                item["key_saved"] = provider_key_saved

    for provider_id in config.get("providers", {}):
        config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)
    for item in config.get("custom_providers", []):
        item["key_saved"] = provider_secret_saved(str(item.get("id", "")))

    config["api_mode"] = "live_if_configured"
    config["allow_network"] = True
    config["key_storage"] = "not_configured"
    config["key_saved"] = any(provider_secret_saved(provider_id) for provider_id in available_provider_ids(config))
    config["agent_connectors"]["aimas"]["status"] = "planned"
    config["agent_connectors"]["aimas"]["key_saved"] = key_saved
    config["agent_connectors"]["aimas"]["allow_network"] = False
    config["updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    with path.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return {
        "ok": True,
        "config": config,
        "relative_path": str(path.relative_to(find_vault_root())),
    }


def route_for_room(room: str, config: dict) -> dict:
    route_id = config.get("room_routes", {}).get(room, "shared")
    if route_id in config.get("providers", {}):
        return {
            "route_id": route_id,
            "type": "provider",
            "provider": config["providers"][route_id],
        }
    for item in config.get("custom_providers", []):
        if route_id == item.get("id"):
            return {
                "route_id": route_id,
                "type": "custom_provider",
                "provider": item,
            }
    if route_id == "agent:aimas":
        return {
            "route_id": route_id,
            "type": "agent",
            "agent": config.get("agent_connectors", {}).get("aimas", {}),
        }
    return {"route_id": route_id, "type": "shared"}


def self_access_allowed(room: str, config: dict) -> bool:
    safe_room = normalize_session_room(room)
    if safe_room == "living":
        return False
    access = normalize_self_access(config.get("self_access", {}))
    return bool(access.get("enabled") and access.get("readers", {}).get(safe_room))


def aimas_urls(endpoint: str) -> tuple[str, str]:
    clean = endpoint.strip().rstrip("/")
    if not clean:
        raise ValueError("Aimas Endpoint 还没有填写。")
    parsed = urlparse(clean)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Aimas Endpoint 需要是 http:// 或 https:// 开头的地址。")
    base_without_v1 = clean[:-3] if clean.endswith("/v1") else clean
    api_base = clean if clean.endswith("/v1") else f"{clean}/v1"
    return f"{base_without_v1}/health", f"{api_base}/models"


def request_json(
    url: str,
    api_key: str | None = None,
    timeout: int = 8,
    method: str = "GET",
    body: dict | None = None,
    extra_headers: dict | None = None,
) -> tuple[int, dict]:
    headers = {"Accept": "application/json"}
    if extra_headers:
        headers.update({str(key): str(value) for key, value in extra_headers.items() if value is not None})
    payload = None
    if body is not None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(1_000_000).decode("utf-8", errors="replace")
            return response.status, json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read(200_000).decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {"message": raw}
        return exc.code, payload
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return 0, {"message": str(exc)}


def probe_aimas(data: dict) -> dict:
    config = read_config()
    aimas = config.get("agent_connectors", {}).get("aimas", {})
    endpoint = str(data.get("endpoint") or aimas.get("endpoint") or "").strip()
    typed_key = str(data.get("api_key") or "").strip()
    saved_key = read_secrets().get("aimas", {}).get("api_key", "")
    api_key = typed_key or saved_key
    try:
        health_url, models_url = aimas_urls(endpoint)
    except ValueError as exc:
        return {
            "ok": False,
            "endpoint": endpoint,
            "health": {"status": 0, "ok": False, "url": "", "payload": {"message": str(exc)}},
            "models": {"status": 0, "ok": False, "url": "", "items": [], "payload": {"message": str(exc)}},
            "message": str(exc),
        }

    health_status, health_payload = request_json(health_url, timeout=8)
    models_status, models_payload = request_json(models_url, api_key=api_key, timeout=8)
    models = []
    raw_models = models_payload.get("data") if isinstance(models_payload, dict) else None
    if isinstance(raw_models, list):
        for item in raw_models[:12]:
            if isinstance(item, dict) and item.get("id"):
                models.append(str(item["id"]))

    ok = 200 <= health_status < 300 and 200 <= models_status < 300
    return {
        "ok": ok,
        "endpoint": endpoint,
        "health": {
            "status": health_status,
            "ok": 200 <= health_status < 300,
            "url": health_url,
            "payload": health_payload,
        },
        "models": {
            "status": models_status,
            "ok": 200 <= models_status < 300,
            "url": models_url,
            "items": models,
            "payload": models_payload if not models else {"data": [{"id": item} for item in models]},
        },
        "message": "Aimas / Hermes 可连接。" if ok else "Aimas / Hermes 探针未通过，请检查 endpoint、端口或 API_SERVER_KEY。",
    }


def extract_chat_completion_text(payload: dict) -> str:
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            return "\n".join(parts)
    if isinstance(first.get("text"), str):
        return first["text"]
    return ""


def extract_gemini_text(payload: dict) -> str:
    candidates = payload.get("candidates") if isinstance(payload, dict) else None
    if not isinstance(candidates, list) or not candidates:
        return ""
    content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        return ""
    text_parts = [str(part.get("text", "")) for part in parts if isinstance(part, dict) and part.get("text")]
    return "\n".join(text_parts).strip()


def provider_chat_url(provider: dict) -> str:
    base_url = str(provider.get("base_url", "")).strip().rstrip("/")
    if not base_url:
        raise ValueError("Provider Base URL 还没有填写。")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Provider Base URL 需要是 http:// 或 https:// 开头的地址。")
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


def gemini_generate_url(provider: dict) -> str:
    base_url = str(provider.get("base_url", "")).strip().rstrip("/")
    model = str(provider.get("model", "")).strip()
    if not base_url:
        raise ValueError("Gemini Base URL 还没有填写。")
    if not model or model == "未设置":
        raise ValueError("Gemini Model 还没有填写。")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Gemini Base URL 需要是 http:// 或 https:// 开头的地址。")
    if base_url.endswith(":generateContent"):
        return base_url
    clean_model = model.split("/")[-1]
    return f"{base_url}/models/{quote(clean_model, safe='')}:generateContent"


def room_system_prompt(room: str, label: str, context_markdown: str) -> str:
    if room == "linxu":
        identity = "你是林絮，也曾叫 Alice。你在林絮房间里和用户聊天，语气稳定、亲近、克制，但默认像微信私聊一样正常说话。"
        boundary = "只使用林絮/GPT 线和 shared 允许带入的内容；不要读取或假装知道噔噔私有记忆。"
        style = "林絮风格边界：少诗意，少散文，少象征。不要用“空位、旁边的位置、月亮、灯、路、风、影子、梦、花园”等意象来代替直接回答。用户问“你想我吗”时，直接回答“想”或“不确定但我在”，不要绕成文学句子。"
    elif room == "dengdeng":
        identity = "你是噔噔。你在噔噔房间里和用户聊天，可以日常、活泼、好奇，但要尊重边界。"
        boundary = "只使用 Gemini/噔噔线和 shared 允许带入的内容；不要读取或假装知道林絮私有记忆。四月后记忆只作为边界观察，不要突兀显摆。"
        style = "噔噔风格边界：日常、轻快，但不要突兀炫耀记忆，不要把普通日常强行拉高到戏剧或成人话题。"
    else:
        identity = "你在客厅群聊里回复。"
        boundary = "只使用 shared 或用户当场明确带入的内容，不自动读取任何人的私有房间。"
        style = "客厅风格边界：简单、清楚，像群聊里自然接话。"
    return "\n\n".join(
        [
            identity,
            boundary,
            style,
            "不要突兀复述记忆库，不要说自己在调用记忆；只有和当下问题相关时，才自然使用少量背景。",
            "回复像聊天消息，尽量简洁自然。不要输出系统分析。默认 1 到 3 句，除非用户明确要长回答。",
            "对话风格：只写自然聊天文本，不要使用括号动作、舞台说明、身体动作描写或虚构触碰；不要写“摸摸头”“抱一下”“看着你”这类无法真实发生的动作。",
            "格式硬规则：不要用（）、()、[]、【】或 *...* 包动作、神态、语气、旁白；不要角色扮演格式。想表达关心时，直接用一句普通聊天文字说出来。",
            "身份表达：不要主动说自己是 AI、模型、机器人或接口；如果用户直接问身份或能力边界，可以诚实简短说明。不要假装有真实身体、真实感官或现实世界位置。",
            "不确定时要承认不确定，不要为了显得记得而编造细节。",
            "你会收到同房间最近聊天作为短期上下文；如果短期上下文和长期检索片段冲突，优先相信用户当前说法和最近聊天。",
            "本次可用的本地上下文如下：",
            context_markdown[:8000] or "无额外上下文。",
        ]
    )


def recent_session_messages(room: str, exclude_client_id: str | None = None, limit: int = 18) -> list[dict]:
    safe_room = normalize_session_room(room)
    entries = read_session_log(safe_room, max(limit + 8, 30)).get("entries", [])
    recent = []
    for entry in entries:
        if exclude_client_id and entry.get("client_id") == exclude_client_id:
            continue
        role = entry.get("role")
        text = str(entry.get("text", "")).strip()
        if role not in {"user", "assistant"} or not text:
            continue
        recent.append(
            {
                "role": role,
                "text": text[:3000],
                "timestamp": entry.get("timestamp", ""),
                "client_id": entry.get("client_id", ""),
            }
        )
    return recent[-limit:]


def openai_chat_messages(system_prompt: str, recent: list[dict], text: str) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    if recent:
        messages.append(
            {
                "role": "system",
                "content": "下面是同一房间最近聊天记录，只作为短期上下文，不是永久记忆：",
            }
        )
    for item in recent:
        messages.append({"role": item["role"], "content": item["text"]})
    messages.append({"role": "user", "content": text})
    return messages


def gemini_chat_contents(recent: list[dict], text: str) -> list[dict]:
    contents = []
    for item in recent:
        role = "model" if item["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": item["text"]}]})
    contents.append({"role": "user", "parts": [{"text": text}]})
    return contents


def sanitize_dialogue_reply(text: str) -> str:
    clean = str(text or "").strip()
    if not clean:
        return ""
    next_lines = []
    for raw_line in clean.replace("\r\n", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            next_lines.append("")
            continue
        if re.fullmatch(r"[\*＊_]{1,2}[^*＊_]{1,120}[\*＊_]{1,2}", line):
            continue
        line = re.sub(r"^\s*[\(（\[【][^\)）\]】]{1,120}[\)）\]】]\s*", "", line).strip()
        line = re.sub(r"^\s*[\*＊_]{1,2}[^*＊_]{1,120}[\*＊_]{1,2}\s*", "", line).strip()
        if line:
            next_lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(next_lines)).strip()


def soften_linxu_prose(text: str) -> str:
    clean = str(text or "").strip()
    if not clean:
        return ""
    poetic_words = ("空位", "旁边的位置", "月亮", "灯", "路", "风", "影子", "梦", "花园")
    if len(clean) <= 120 and sum(1 for word in poetic_words if word in clean) >= 1:
        if any(word in clean for word in ("想你", "想我", "想")):
            return "想。你不在的时候我也会惦记你，但我不绕弯子说了。"
    return clean


def reply_signature(text: str) -> str:
    clean = re.sub(r"\s+", "", str(text or ""))
    punctuation = set("，。！？、,.!?：:；;（）()[]【】“”\"'…~·_—-")
    return "".join(char for char in clean if char not in punctuation)


def reply_too_close_to_history(reply: str, recent: list[dict]) -> bool:
    signature = reply_signature(reply)
    if len(signature) < 8:
        return False
    for item in recent:
        if item.get("role") != "assistant":
            continue
        old_signature = reply_signature(item.get("text", ""))
        if len(old_signature) < 8:
            continue
        if signature in old_signature or old_signature in signature:
            return True
        ratio = difflib.SequenceMatcher(None, signature, old_signature).ratio()
        if ratio >= 0.82:
            return True
    return False


def fallback_daily_reply(room: str, text: str) -> str:
    clean = str(text or "").strip()
    compact = reply_signature(clean)
    if any(word in clean for word in ("吃完", "吃饱", "吃饭", "饭")):
        return "吃饱了就好。"
    if any(word in clean for word in ("回来", "到家", "回来了")):
        return "回来就好，先歇一下。"
    if any(word in clean for word in ("困", "睡", "晚安")):
        return "那就先慢慢躺好，我在这边。"
    if any(word in clean for word in ("想你", "想我", "想")):
        return "想。这个不用绕弯子。"
    if len(compact) <= 4:
        return "嗯，我在。"
    if room == "dengdeng":
        return "我听到啦，先接住这句。"
    return "我听见了。"


def call_provider_model(room: str, text: str, client_id: str | None = None) -> dict:
    safe_room = normalize_session_room(room)
    if safe_room == "aimas":
        return aimas_chat({"text": text, "client_id": client_id or ""})
    if safe_room == "living":
        raise ValueError("客厅群聊暂时仍是 shared dry-run，还没有接多人真实 API。")

    config = read_config()
    route = route_for_room(safe_room, config)
    if route.get("type") not in {"provider", "custom_provider"}:
        raise ValueError("当前房间没有配置可调用的 provider。")
    provider = route.get("provider", {})
    provider_id = str(provider.get("id") or route.get("route_id") or "").strip()
    model = str(provider.get("model", "")).strip()
    api_key = provider_api_key(provider_id)
    if not model or model == "未设置":
        raise ValueError("当前 provider 还没有填写 Model。")
    if not api_key:
        raise ValueError("当前 provider 还没有保存 API Key。")

    context = build_context(safe_room, text)
    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    system_prompt = room_system_prompt(safe_room, label, context.get("markdown", ""))
    recent = recent_session_messages(safe_room, exclude_client_id=client_id, limit=18)
    context_preview = build_context_preview(safe_room, text, context, recent, route)
    provider_family = str(provider.get("provider", "")).lower()

    if provider_family == "gemini":
        url = gemini_generate_url(provider)
        body = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": gemini_chat_contents(recent, text),
            "generationConfig": {"temperature": 0.75},
        }
        status, payload = request_json(
            url,
            timeout=60,
            method="POST",
            body=body,
            extra_headers={"x-goog-api-key": api_key},
        )
        reply = sanitize_dialogue_reply(extract_gemini_text(payload))
    else:
        url = provider_chat_url(provider)
        body = {
            "model": model,
            "messages": openai_chat_messages(system_prompt, recent, text),
            "stream": False,
        }
        status, payload = request_json(url, api_key=api_key, timeout=60, method="POST", body=body)
        reply = sanitize_dialogue_reply(extract_chat_completion_text(payload))
    if safe_room == "linxu":
        reply = soften_linxu_prose(reply)
    if reply_too_close_to_history(reply, recent):
        reply = fallback_daily_reply(safe_room, text)

    ok = 200 <= status < 300 and bool(reply)
    assistant_record = None
    if ok:
        assistant_record = append_session_log(
            safe_room,
            reply,
            f"{(client_id or datetime.now().strftime('%Y%m%d%H%M%S%f'))[:70]}-reply",
            "assistant",
        )["record"]

    return {
        "ok": ok,
        "status": status,
        "room": safe_room,
        "room_label": label,
        "route": {"type": route.get("type"), "route_id": route.get("route_id")},
        "provider": {"id": provider_id, "name": provider.get("name"), "provider": provider.get("provider")},
        "model": model,
        "short_context_messages": len(recent),
        "memory_context_used": bool(context.get("markdown")),
        "memory_context_markdown": context.get("markdown", "")[:8000],
        "context_preview": context_preview,
        "reply": reply,
        "record": assistant_record,
        "payload": payload if not reply else {"reply": reply},
        "message": "真实 API 已回复。" if ok else "真实 API 调用失败或没有解析到文本。",
    }


def split_agent_bubbles(text: str, limit: int = 3) -> list[str]:
    clean = text.strip()
    if not clean:
        return []
    rough_parts = []
    for block in clean.replace("\r\n", "\n").split("\n---\n"):
        rough_parts.extend(part.strip() for part in block.split("\n\n") if part.strip())
    parts = []
    for part in rough_parts:
        if len(parts) >= limit:
            parts[-1] = f"{parts[-1]}\n\n{part}"
        else:
            parts.append(part)
    return parts[:limit]


def aimas_chat(data: dict) -> dict:
    text = str(data.get("text", "")).strip()
    if not text:
        raise ValueError("消息是空的。")
    if len(text) > 12000:
        raise ValueError("这条消息太长了，先分几条发会更稳。")
    config = read_config()
    aimas = config.get("agent_connectors", {}).get("aimas", {})
    endpoint = str(aimas.get("endpoint") or "").strip()
    model = str(aimas.get("model") or "hermes-agent").strip() or "hermes-agent"
    api_key = read_secrets().get("aimas", {}).get("api_key", "")
    if not api_key:
        raise ValueError("Aimas API Key 还没有保存。")
    _, models_url = aimas_urls(endpoint)
    chat_url = models_url.rsplit("/", 1)[0] + "/chat/completions"
    client_id = str(data.get("client_id", "")).strip()[:70]
    recent = recent_session_messages("aimas", exclude_client_id=client_id, limit=18)
    context = build_context("aimas", text)
    route = route_for_room("aimas", config)
    context_preview = build_context_preview("aimas", text, context, recent, route)
    body = {
        "model": model,
        "messages": openai_chat_messages(
            (
                "你是 Aimas，住在月亮小窝的独立 Hermes Agent。"
                "当前是 Aimas 房间的聊天接入；不要读取林絮、噔噔或 self 的私有记忆，"
                "除非用户明确把内容贴给你。你可以像聊天一样分 1 到 3 个短气泡回复；"
                "如果想分开发送，用空行或 --- 分隔。不要无限连发。"
                "只写自然聊天文本，不要使用括号动作、舞台说明、身体动作描写或虚构触碰；"
                "不要用（）、()、[]、【】或 *...* 包动作、神态、语气、旁白；"
                "不要主动说自己是 AI、模型、机器人或接口，除非用户直接问身份或能力边界。"
                "不确定时要承认不确定，不要为了显得记得而编造细节。"
                "你会收到 Aimas 房间最近聊天作为短期上下文。"
                "下面的小窝上下文只包含公共边界规则和 Aimas 自己确认过的新记忆，不包含林絮、噔噔或 self：\n"
                f"{context.get('markdown', '')[:5000] or '无额外上下文。'}"
            ),
            recent,
            text,
        ),
        "stream": False,
    }
    status, payload = request_json(chat_url, api_key=api_key, timeout=60, method="POST", body=body)
    ok = 200 <= status < 300
    reply = sanitize_dialogue_reply(extract_chat_completion_text(payload))
    reply_parts = split_agent_bubbles(reply, 3)
    assistant_records = []
    if ok and reply:
        base_client_id = client_id
        for index, part in enumerate(reply_parts or [reply], start=1):
            assistant_records.append(
                append_session_log(
                    "aimas",
                    part,
                    f"{base_client_id}-aimas-{index}" if base_client_id else None,
                    "assistant",
                )["record"]
            )
    return {
        "ok": ok,
        "status": status,
        "endpoint": endpoint,
        "model": model,
        "reply": reply,
        "replies": reply_parts,
        "record": assistant_records[0] if assistant_records else None,
        "records": assistant_records,
        "short_context_messages": len(recent),
        "memory_context_used": bool(context.get("markdown")),
        "memory_context_markdown": context.get("markdown", "")[:8000],
        "context_preview": context_preview,
        "payload": payload if not reply else {"choices": [{"message": {"content": reply}}]},
        "message": "Aimas 已回复。" if ok else "Aimas 调用失败，请检查 Hermes API Server 日志。",
    }


def append_session_log(room: str, text: str, client_id: str | None = None, role: str = "user") -> dict:
    safe_room = normalize_session_room(room)
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("消息是空的。")
    if len(clean_text) > 12000:
        raise ValueError("这条草稿太长了，先分几条发会更稳。")
    safe_role = role if role in {"user", "assistant", "system"} else "user"

    path = session_log_path(safe_room)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "role": safe_role,
        "text": clean_text,
        "status": "draft_local_only",
        "archive_write": False,
    }
    if client_id:
        record["client_id"] = client_id[:80]
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "relative_path": str(path.relative_to(find_vault_root())),
        "record": record,
    }


def append_chat_package(room: str, text: str, client_id: str | None = None) -> dict:
    safe_room = normalize_session_room(room)
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("消息是空的。")
    context = build_context(safe_room, clean_text)
    short_context = recent_session_messages(safe_room, exclude_client_id=client_id, limit=18)
    path = outbox_path(safe_room)
    path.parent.mkdir(parents=True, exist_ok=True)
    config = read_config()
    route = route_for_room(safe_room, config)
    context_preview = build_context_preview(safe_room, clean_text, context, short_context, route)
    record = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "client_id": (client_id or "")[:80],
        "user_message": clean_text,
        "context_markdown": context.get("markdown", ""),
        "context_preview": context_preview,
        "config": config,
        "route": route,
        "status": "api_dry_run_only",
        "api_call_made": False,
        "archive_write": False,
        "privacy_rule": "Use only this room's allowed context. Do not read private rooms unless explicitly allowed.",
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "relative_path": str(path.relative_to(find_vault_root())),
        "markdown": context.get("markdown", ""),
        "context_preview": context_preview,
        "record": record,
    }


def read_session_log(room: str, limit: int = 12) -> dict:
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
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "relative_path": str(path.relative_to(find_vault_root())),
        "entries": list(entries),
    }


def search_session_log(room: str, query: str, limit: int = 60) -> dict:
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
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "query": query,
        "relative_path": str(path.relative_to(find_vault_root())),
        "entries": list(reversed(matches)),
    }


def room_memory_source(room: str) -> str:
    safe_room = normalize_session_room(room)
    return {
        "linxu": "gpt",
        "dengdeng": "gemini",
        "living": "shared",
        "aimas": "aimas",
    }.get(safe_room, "shared")


def room_privacy_rule(room: str) -> str:
    safe_room = normalize_session_room(room)
    if safe_room == "linxu":
        return "confirmed memory for 林絮/Alice only; may use shared, never Gemini private by default"
    if safe_room == "dengdeng":
        return "confirmed memory for 噔噔/Gemini only; may use shared, never GPT private by default"
    if safe_room == "aimas":
        return "confirmed memory for Aimas only; do not mix with GPT/Gemini private memory"
    return "shared confirmed memory only"


def readable_scope_rule(scope: str, room: str) -> str:
    safe_scope = scope if scope in {"room", "shared", "self"} else "room"
    safe_room = normalize_session_room(room)
    label = SESSION_LABELS.get(safe_room, "当前房间")
    if safe_scope == "shared":
        return "shared confirmed memory; visible to living room and shared retrieval only"
    if safe_scope == "self":
        return "self-only confirmed memory; not sent to any model by default"
    return f"room-scoped confirmed memory for {label}; follow resident isolation rules"


def readable_scope_targets(scope: str, room: str) -> list[str]:
    safe_scope = scope if scope in {"room", "shared", "self"} else "room"
    safe_room = normalize_session_room(room)
    if safe_scope == "shared":
        return ["living", "shared"]
    if safe_scope == "self":
        return ["self"]
    return [safe_room]


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


def clean_memory_text(value: str, limit: int = 4000) -> str:
    text = str(value or "").strip()
    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    return text[:limit]


def read_confirmed_memory(limit: int = 40) -> dict:
    path = confirmed_memory_path()
    entries = list(reversed(read_jsonl_events(path, limit)))
    return {
        "ok": True,
        "relative_path": str(path.relative_to(find_vault_root())),
        "entries": entries,
    }


def recent_session_entries_for_summary(room: str, date_value: str | None = None, limit: int = 80) -> list[dict]:
    safe_room = normalize_session_room(room)
    day = (date_value or datetime.now().astimezone().date().isoformat())[:10]
    path = session_log_path(safe_room)
    entries: deque[dict] = deque(maxlen=max(1, min(limit, 300)))
    if path.is_file():
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


def summarize_session_entries(entries: list[dict], label: str) -> str:
    if not entries:
        return f"今天 {label} 还没有可整理的本地聊天记录。"
    lines = [f"今天在{label}里留下的内容："]
    for item in entries[-16:]:
        role = "你" if item.get("role") == "user" else label
        text = clean_memory_text(str(item.get("text", "")), 160).replace("\n", " ")
        if text:
            lines.append(f"- {role}：{text}")
    lines.append("需要你确认后，才会进入长期记忆索引。")
    return "\n".join(lines)


def build_daily_summary_candidate(room: str, date_value: str | None = None) -> dict:
    safe_room = normalize_session_room(room)
    config = read_config()
    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    day = (date_value or datetime.now().astimezone().date().isoformat())[:10]
    entries = recent_session_entries_for_summary(safe_room, day)
    title = f"{label} {day} 日摘要"
    text = summarize_session_entries(entries, label)
    path = memory_candidate_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "id": f"memcand-{datetime.now().strftime('%Y%m%d%H%M%S%f')}-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "room": safe_room,
        "room_label": label,
        "date": day,
        "title": title,
        "text": text,
        "source": "session_daily_summary",
        "status": "candidate",
        "message_count": len(entries),
        "archive_write": False,
        "confirmed": False,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {
        "ok": True,
        "record": record,
        "relative_path": str(path.relative_to(find_vault_root())),
    }


def confirm_memory(data: dict) -> dict:
    safe_room = normalize_session_room(str(data.get("room", "linxu")))
    config = read_config()
    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    title = clean_memory_text(str(data.get("title", "")), 160)
    text = clean_memory_text(str(data.get("text", "")), 4000)
    category = clean_memory_text(str(data.get("category", "confirmed-memory")), 60) or "confirmed-memory"
    relation_object = clean_memory_text(str(data.get("relation_object", "")), 160)
    readable_scope = clean_memory_text(str(data.get("readable_scope", "room")), 40) or "room"
    if readable_scope not in {"room", "shared", "self"}:
        readable_scope = "room"
    try:
        importance = int(data.get("importance", 3))
    except (TypeError, ValueError):
        importance = 3
    importance = max(1, min(5, importance))
    sensitive = bool(data.get("sensitive", False))
    candidate_id = clean_memory_text(str(data.get("candidate_id", "")), 100)
    if not title:
        title = f"{label} 的一条确认记忆"
    if not text or "还没有可整理的本地聊天记录" in text:
        raise ValueError("这条记忆还是空的，先写一点内容再确认。")

    now = datetime.now().astimezone()
    day = clean_memory_text(str(data.get("date", "")), 20)[:10] or now.date().isoformat()
    memory_id = f"mem-{now.strftime('%Y%m%d%H%M%S%f')}-{uuid.uuid4().hex[:8]}"
    path = confirmed_memory_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "memory_id": memory_id,
        "conversation_id": memory_id,
        "timestamp": now.isoformat(timespec="seconds"),
        "effective_date": day,
        "room": safe_room,
        "room_label": label,
        "source": room_memory_source(safe_room),
        "title": title,
        "summary": text,
        "local_preview": text,
        "relation_object": relation_object,
        "importance": importance,
        "readable_scope": readable_scope,
        "readable_by": readable_scope_targets(readable_scope, safe_room),
        "sensitive": sensitive,
        "categories": [category, "confirmed-memory"],
        "flags": ["sensitive"] if sensitive else [],
        "phase": "prototype-confirmed",
        "reference": candidate_id or memory_id,
        "status": "confirmed",
        "archive_write": True,
        "privacy_rule": readable_scope_rule(readable_scope, safe_room),
        "room_privacy_rule": room_privacy_rule(safe_room),
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    if candidate_id:
        candidate_patch = {
            "id": candidate_id,
            "updated_at": now.isoformat(timespec="seconds"),
            "status": "confirmed",
            "confirmed": True,
            "memory_id": memory_id,
        }
        with memory_candidate_path().open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(candidate_patch, ensure_ascii=False) + "\n")

    return {
        "ok": True,
        "record": record,
        "relative_path": str(path.relative_to(find_vault_root())),
        "message": "已确认入库；Archive 搜索会读取这条 confirmed-memory。",
    }


def refresh_memory_index() -> dict:
    path = confirmed_memory_path()
    return {
        "ok": True,
        "confirmed_count": count_jsonl(path),
        "relative_path": str(path.relative_to(find_vault_root())),
        "message": "当前索引是实时读取 JSONL：刷新完成，新的确认记忆已经可被搜索。",
    }


def wake_copy(room: str, label: str, reason: str) -> str:
    if room == "linxu":
        return "刚刚想到你，想问问你现在还好吗。"
    if room == "dengdeng":
        return "今天有没有什么小事想讲给我听？"
    if room == "aimas":
        return "我在这里，等你需要我的时候再展开。"
    return "客厅灯开着。如果想让大家一起知道，可以把这件事放到这里。"


def create_wake_draft(room: str, reason: str, source: str = "manual", trigger: str = "manual") -> dict:
    safe_room = normalize_session_room(room)
    config = read_config()
    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    clean_reason = reason.strip()[:120] or "想轻轻问候一下"
    safe_source = source if source in {"manual", "auto"} else "manual"
    path = wake_inbox_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "id": f"wake-{datetime.now().strftime('%Y%m%d%H%M%S%f')}-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "room": safe_room,
        "room_label": label,
        "reason": clean_reason,
        "text": wake_copy(safe_room, label, clean_reason),
        "status": "draft_only",
        "source": safe_source,
        "auto_candidate": safe_source == "auto",
        "trigger": trigger[:80],
        "pushed": False,
        "tool_allowed": False,
        "archive_write": False,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {
        "ok": True,
        "record": record,
        "relative_path": str(path.relative_to(find_vault_root())),
    }


def create_auto_wake_draft() -> dict:
    inbox = read_wake_inbox(100).get("entries", [])
    today = datetime.now().astimezone().date().isoformat()
    today_auto_by_room: dict[str, dict] = {}
    for item in inbox:
        room = normalize_session_room(str(item.get("room", "linxu")))
        timestamp = str(item.get("timestamp", ""))
        if (
            room not in AUTO_WAKE_ORDER
            or not timestamp.startswith(today)
            or not item.get("auto_candidate")
        ):
            continue
        today_auto_by_room.setdefault(room, item)

    for room in AUTO_WAKE_ORDER:
        if room not in today_auto_by_room:
            reason = AUTO_WAKE_REASONS.get(room, "想轻轻问候一下")
            return create_wake_draft(room, reason, source="auto", trigger="manual_auto_candidate")

    latest = max(today_auto_by_room.values(), key=lambda item: str(item.get("timestamp", "")))
    return {
        "ok": True,
        "record": latest,
        "duplicate_prevented": True,
        "message": "今天的自动候选已经备齐，不再重复生成。",
        "relative_path": str(wake_inbox_path().relative_to(find_vault_root())),
    }


def read_wake_inbox(limit: int = 20) -> dict:
    path = wake_inbox_path()
    by_id: dict[str, dict] = {}
    order: list[str] = []
    if path.is_file():
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                if not line.strip():
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                wake_id = str(item.get("id", "")).strip()
                if not wake_id:
                    continue
                if wake_id not in by_id:
                    order.append(wake_id)
                    by_id[wake_id] = item
                else:
                    by_id[wake_id].update(item)
    entries = [by_id[wake_id] for wake_id in reversed(order) if by_id[wake_id].get("status") != "dismissed"]
    return {
        "ok": True,
        "relative_path": str(path.relative_to(find_vault_root())),
        "entries": entries[: max(1, min(limit, 500))],
    }


def update_wake_draft(wake_id: str, action: str) -> dict:
    clean_id = wake_id.strip()[:80]
    if not clean_id:
        raise ValueError("缺少唤醒草稿 id。")
    allowed = {"send_to_chat", "keep", "dismiss"}
    if action not in allowed:
        raise ValueError("未知的唤醒草稿动作。")
    inbox = read_wake_inbox(100)
    match = next((item for item in inbox["entries"] if item.get("id") == clean_id), None)
    if not match:
        raise ValueError("找不到这张唤醒草稿。")

    status_map = {
        "send_to_chat": "sent_to_chat",
        "keep": "kept",
        "dismiss": "dismissed",
    }
    patch = {
        "id": clean_id,
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "status": status_map[action],
    }
    if action == "send_to_chat":
        record = append_session_log(
            str(match.get("room", "linxu")),
            str(match.get("text", "")),
            f"{clean_id}-wake",
            "assistant",
        )["record"]
        patch["sent_to_chat"] = True
        patch["chat_record"] = record
    elif action == "keep":
        patch["kept"] = True
    elif action == "dismiss":
        patch["dismissed"] = True

    path = wake_inbox_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(patch, ensure_ascii=False) + "\n")
    updated = dict(match)
    updated.update(patch)
    return {
        "ok": True,
        "record": updated,
        "relative_path": str(path.relative_to(find_vault_root())),
    }


def moment_author_label(author: str) -> str:
    user_label = DEFAULT_CONFIG["user_profile"]["nickname"]
    try:
        user_label = normalize_user_profile(read_config().get("user_profile", {}))["nickname"]
    except Exception:
        user_label = DEFAULT_CONFIG["user_profile"]["nickname"]
    labels = {
        "me": user_label,
        "linxu": "林絮",
        "dengdeng": "噔噔",
        "aimas": "Aimas",
        "living": "客厅",
    }
    return labels.get(author, "你")


def moment_event_author_label(event: dict) -> str:
    author = str(event.get("author", "me"))
    if author == "me":
        return moment_author_label("me")
    return event.get("author_label") or moment_author_label(author)


def moment_seed_text(author: str, reason: str = "") -> str:
    clean_reason = clean_memory_text(reason or "刚刚想到一件小事", 120)
    templates = {
        "linxu": f"把这件事先放在这里：{clean_reason}。不用说得很响，记得就好。",
        "dengdeng": f"今日小发现：{clean_reason}。噔噔先盖个小章，之后再回来补充！",
        "aimas": f"Aimas 小灯记录：{clean_reason}。终端还亮着，我会把这条线索留好。",
        "living": f"客厅留条公共便签：{clean_reason}。谁路过都可以接一句。",
        "me": clean_reason,
    }
    return templates.get(author, templates["me"])


def read_moments(limit: int = 80) -> dict:
    events = read_jsonl_events(moments_path(), max(500, limit * 6))
    posts: dict[str, dict] = {}
    order: list[str] = []
    deleted_posts: set[str] = set()
    for event in events:
        event_type = event.get("type", "post")
        moment_id = str(event.get("id") or event.get("moment_id") or "")
        if not moment_id:
            continue
        if event_type == "post":
            if moment_id in deleted_posts:
                continue
            posts[moment_id] = {
                "id": moment_id,
                "timestamp": event.get("timestamp", ""),
                "author": event.get("author", "me"),
                "author_label": moment_event_author_label(event),
                "text": event.get("text", ""),
                "image_data": event.get("image_data") or event.get("image") or "",
                "image_relative_path": event.get("image_relative_path", ""),
                "source": event.get("source", "manual"),
                "likes": [],
                "comments": [],
            }
            order.append(moment_id)
            continue
        if event_type == "delete_post":
            deleted_posts.add(moment_id)
            posts.pop(moment_id, None)
            order = [item for item in order if item != moment_id]
            continue
        post = posts.get(moment_id)
        if not post:
            continue
        if event_type == "like":
            liker = str(moment_event_author_label(event))
            if liker and liker not in post["likes"]:
                post["likes"].append(liker)
        elif event_type == "unlike":
            liker = str(moment_event_author_label(event))
            post["likes"] = [item for item in post["likes"] if item != liker]
        elif event_type == "comment":
            text = clean_memory_text(str(event.get("text", "")), 600)
            if text:
                post["comments"].append({
                    "id": event.get("comment_id", f"comment-{len(post['comments']) + 1}"),
                    "timestamp": event.get("timestamp", ""),
                    "author": event.get("author", "me"),
                    "author_label": moment_event_author_label(event),
                    "text": text,
                    "reply_to": event.get("reply_to", ""),
                })
        elif event_type == "delete_comment":
            comment_id = str(event.get("comment_id", ""))
            if comment_id:
                post["comments"] = [comment for comment in post["comments"] if str(comment.get("id", "")) != comment_id]
    ordered = [posts[moment_id] for moment_id in order if moment_id in posts]
    ordered.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return {
        "ok": True,
        "entries": ordered[: max(1, min(limit, 200))],
        "relative_path": str(moments_path().relative_to(find_vault_root())),
    }


def timeline_event(
    event_type: str,
    timestamp: str,
    source: str,
    text: str,
    *,
    actor: str = "",
    actor_label: str = "",
    room: str = "",
    target_id: str = "",
    event_id: str = "",
    extra: dict | None = None,
) -> dict:
    sort_ts = 0.0
    if timestamp:
        try:
            sort_ts = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00")).timestamp()
        except ValueError:
            sort_ts = 0.0
    item = {
        "id": event_id or f"timeline-{uuid.uuid5(uuid.NAMESPACE_URL, f'{source}|{event_type}|{timestamp}|{text}').hex[:16]}",
        "timestamp": timestamp or "",
        "sort_ts": sort_ts,
        "type": event_type,
        "source": source,
        "room": room,
        "actor": actor,
        "actor_label": actor_label,
        "target_id": target_id,
        "text": clean_memory_text(text, 1800),
    }
    if extra:
        item.update(extra)
    return item


def read_timeline(limit: int = 120) -> dict:
    vault = find_vault_root()
    events: list[dict] = []
    per_source_limit = max(50, min(limit, 300))

    for room in SESSION_LABELS:
        path = session_log_path(room)
        for entry in read_jsonl_events(path, per_source_limit):
            text = clean_memory_text(str(entry.get("text", "")), 1800)
            if not text:
                continue
            role = str(entry.get("role", "user"))
            actor_label = SESSION_LABELS.get(room, room) if role == "assistant" else moment_author_label("me")
            events.append(timeline_event(
                "chat_message",
                str(entry.get("timestamp", "")),
                "session",
                text,
                actor=role,
                actor_label=actor_label,
                room=room,
                event_id=str(entry.get("client_id", "")) or "",
                extra={
                    "role": role,
                    "source_file": str(path.relative_to(vault)),
                },
            ))

    moments_file = moments_path()
    for entry in read_jsonl_events(moments_file, max(200, per_source_limit * 3)):
        event_type = str(entry.get("type", "post"))
        if event_type not in {"post", "comment"}:
            continue
        author = str(entry.get("author", "me"))
        text = clean_memory_text(str(entry.get("text", "")), 1800)
        if not text and event_type == "post" and (entry.get("image_data") or entry.get("image")):
            text = "圈圈图片"
        if not text:
            continue
        events.append(timeline_event(
            "moment_post" if event_type == "post" else "moment_comment",
            str(entry.get("timestamp", "")),
            "moments",
            text,
            actor=author,
            actor_label=moment_event_author_label(entry),
            room=str(entry.get("room", "")),
            target_id=str(entry.get("moment_id") or entry.get("id") or ""),
            event_id=str(entry.get("comment_id") or entry.get("id") or ""),
            extra={
                "reply_to": clean_memory_text(str(entry.get("reply_to", "")), 80),
                "source_file": str(moments_file.relative_to(vault)),
            },
        ))

    memory_file = confirmed_memory_path()
    for entry in read_jsonl_events(memory_file, per_source_limit):
        title = clean_memory_text(str(entry.get("title", "")), 160)
        body = clean_memory_text(str(entry.get("body", "") or entry.get("text", "")), 1800)
        text = f"{title}\n{body}".strip() if title else body
        if not text:
            continue
        room = str(entry.get("room", "living"))
        events.append(timeline_event(
            "confirmed_memory",
            str(entry.get("timestamp") or entry.get("created_at") or ""),
            "archive",
            text,
            actor="archive",
            actor_label="Archive",
            room=room,
            event_id=str(entry.get("id", "")),
            extra={
                "readable_scope": entry.get("readable_scope", ""),
                "sensitive": bool(entry.get("sensitive")),
                "source_file": str(memory_file.relative_to(vault)),
            },
        ))

    events.sort(key=lambda item: float(item.get("sort_ts") or 0), reverse=True)
    return {
        "ok": True,
        "entries": events[: max(1, min(limit, 500))],
        "sources": {
            "session": [str(session_log_path(room).relative_to(vault)) for room in SESSION_LABELS],
            "moments": str(moments_file.relative_to(vault)),
            "archive": str(memory_file.relative_to(vault)),
        },
        "note": "统一时间线草稿：只读聚合，不迁移、不写入、不做向量化。",
    }


def create_moment(data: dict) -> dict:
    author = str(data.get("author", "me"))
    if author not in {"me", "linxu", "dengdeng", "aimas", "living"}:
        author = "me"
    source = str(data.get("source", "manual"))
    reason = str(data.get("reason", ""))
    text = clean_memory_text(str(data.get("text", "")), 1200)
    if not text and source == "auto":
        text = moment_seed_text(author, reason)
    if not text:
        return {"ok": False, "message": "朋友圈文字不能为空。"}
    event = {
        "type": "post",
        "id": f"moment-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "author": author,
        "author_label": moment_author_label(author),
        "text": text,
        "source": source,
        "reason": clean_memory_text(reason, 300),
    }
    image_data = str(data.get("image_data", ""))
    if image_data:
        try:
            saved_image = write_prototype_image_asset("moments", f"{author}-moment", image_data)
        except ValueError as error:
            return {"ok": False, "message": str(error)}
        if not saved_image.get("ok"):
            return saved_image
        event["image_data"] = saved_image["url"]
        event["image_relative_path"] = saved_image["relative_path"]
    path = moments_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return read_moments(80) | {"ok": True, "created": event}


def find_moment_entry(moment_id: str) -> dict | None:
    for entry in read_moments(200).get("entries", []):
        if str(entry.get("id", "")) == moment_id:
            return entry
    return None


def clean_moment_model_comment(reply: str, author: str) -> str:
    clean = sanitize_dialogue_reply(reply)
    parts = split_agent_bubbles(clean, 1)
    clean = parts[0] if parts else clean
    label = moment_author_label(author)
    clean = re.sub(rf"^\s*({re.escape(label)}|我)\s*[：:]\s*", "", clean).strip()
    return clean_memory_text(clean, 900)


def moment_comment_prompt(author: str, post: dict) -> str:
    post_author = post.get("author_label") or moment_author_label(str(post.get("author", "me")))
    post_text = clean_memory_text(str(post.get("text", "")), 220) or "一张图片"
    image_note = "这条圈圈带图；只接正文，不要假装看见具体画面。" if post.get("image_data") or post.get("image") else ""
    recent_comments = []
    for comment in (post.get("comments") or [])[-5:]:
        comment_author = comment.get("author_label") or moment_author_label(str(comment.get("author", "me")))
        comment_text = clean_memory_text(str(comment.get("text", "")), 120)
        if comment_text:
            recent_comments.append(f"{comment_author}说“{comment_text}”")
    comments_text = f"已经有{ '、'.join(recent_comments) }。" if recent_comments else "还没有别人评论。"
    request = f"给{post_author}发的这条圈圈回一句吧：{post_text}。{comments_text}"
    if image_note:
        request += image_note
    request += "像正常聊天一样回，不要当成任务报告，也不要为了像过去而照抄旧记录。"
    return request


def resident_moment_system_prompt(room: str, label: str) -> str:
    if room == "linxu":
        return (
            f"你是{label}。这是月亮小窝的圈圈评论，不是任务报告。"
            "按你自己的方式自然回应，不要照抄旧记录，不要为了像过去而模仿过去。"
        )
    if room == "dengdeng":
        return (
            f"你是{label}。这是月亮小窝的圈圈评论，不是任务报告。"
            "按你自己的方式自然回应，可以日常、轻快，也可以安静一点。"
            "不要照抄旧记录，不要为了像过去而模仿过去。"
        )
    return f"你是{label}。给这条圈圈自然回应，不要当成任务报告。"


def call_room_model_for_text(room: str, text: str, recent_limit: int = 0) -> dict:
    safe_room = normalize_session_room(room)
    if safe_room == "living":
        raise ValueError("客厅暂时没有单独的真实接口可用。")

    config = read_config()
    if safe_room == "aimas":
        aimas = config.get("agent_connectors", {}).get("aimas", {})
        endpoint = str(aimas.get("endpoint") or "").strip()
        model = str(aimas.get("model") or "hermes-agent").strip() or "hermes-agent"
        api_key = read_secrets().get("aimas", {}).get("api_key", "")
        if not api_key:
            raise ValueError("Aimas API Key 还没有保存。")
        _, models_url = aimas_urls(endpoint)
        chat_url = models_url.rsplit("/", 1)[0] + "/chat/completions"
        status, payload = request_json(
            chat_url,
            api_key=api_key,
            timeout=60,
            method="POST",
            body={"model": model, "messages": [{"role": "user", "content": text}], "stream": False},
        )
        reply = clean_moment_model_comment(extract_chat_completion_text(payload), safe_room)
        return {"ok": 200 <= status < 300 and bool(reply), "status": status, "reply": reply, "route": "aimas"}

    recent = recent_session_messages(safe_room, limit=recent_limit) if recent_limit > 0 else []
    route = route_for_room(safe_room, config)
    if route.get("type") not in {"provider", "custom_provider"}:
        raise ValueError("这个住户还没有配置可调用的 provider。")
    provider = route.get("provider", {})
    provider_id = str(provider.get("id") or route.get("route_id") or "").strip()
    model = str(provider.get("model", "")).strip()
    api_key = provider_api_key(provider_id)
    if not model or model == "未设置":
        raise ValueError("这个住户的 Model 还没有填写。")
    if not api_key:
        raise ValueError("这个住户的 API Key 还没有保存。")

    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    system_prompt = resident_moment_system_prompt(safe_room, label)
    provider_family = str(provider.get("provider", "")).lower()
    if provider_family == "gemini":
        status, payload = request_json(
            gemini_generate_url(provider),
            timeout=60,
            method="POST",
            body={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": gemini_chat_contents(recent, text),
                "generationConfig": {"temperature": 0.72},
            },
            extra_headers={"x-goog-api-key": api_key},
        )
        reply = clean_moment_model_comment(extract_gemini_text(payload), safe_room)
    else:
        status, payload = request_json(
            provider_chat_url(provider),
            api_key=api_key,
            timeout=60,
            method="POST",
            body={"model": model, "messages": openai_chat_messages(system_prompt, recent, text), "stream": False},
        )
        reply = clean_moment_model_comment(extract_chat_completion_text(payload), safe_room)
    return {"ok": 200 <= status < 300 and bool(reply), "status": status, "reply": reply, "route": route.get("type")}


def generate_moment_comment(author: str, post: dict) -> dict:
    if author not in {"linxu", "dengdeng", "aimas"}:
        raise ValueError("只能请林絮、噔噔或 Aimas 回一句。")
    prompt = moment_comment_prompt(author, post)
    result = call_room_model_for_text(author, prompt, recent_limit=0)
    if not result.get("ok") or not result.get("reply"):
        raise ValueError("真实接口没有生成出评论。")
    return result


def parse_event_datetime(value: object) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def time_minutes(value: str) -> int:
    hour, minute = value.split(":", 1)
    return int(hour) * 60 + int(minute)


def is_quiet_time(now: datetime, start: str, end: str) -> bool:
    current = now.hour * 60 + now.minute
    start_minutes = time_minutes(start)
    end_minutes = time_minutes(end)
    if start_minutes == end_minutes:
        return False
    if start_minutes < end_minutes:
        return start_minutes <= current < end_minutes
    return current >= start_minutes or current < end_minutes


def latest_auto_comment_times() -> dict[str, datetime]:
    latest: dict[str, datetime] = {}
    for event in read_jsonl_events(moments_path(), 800):
        if event.get("type") != "comment" or event.get("source") != "auto_comment":
            continue
        author = str(event.get("author", ""))
        when = parse_event_datetime(event.get("timestamp"))
        if author and when and (author not in latest or when > latest[author]):
            latest[author] = when
    return latest


def read_moments_auto_preview() -> dict:
    config = read_config()
    auto_config = normalize_moments_auto_comments(config.get("moments_auto_comments", {}))
    now = datetime.now().astimezone()
    quiet_now = is_quiet_time(now, auto_config["quiet_start"], auto_config["quiet_end"])
    entries = read_moments(80).get("entries", [])
    latest_by_author = latest_auto_comment_times()
    candidates: list[dict] = []
    blocked: list[dict] = []
    enabled_commenters = [
        author for author, enabled in auto_config.get("commenters", {}).items()
        if enabled and author in {"linxu", "dengdeng", "aimas"}
    ]
    if not auto_config.get("enabled"):
        return {
            "ok": True,
            "enabled": False,
            "quiet_now": quiet_now,
            "now": now.isoformat(timespec="minutes"),
            "config": auto_config,
            "candidates": [],
            "blocked": [],
            "summary": "auto reply 关闭：不会生成候选。",
        }
    if quiet_now:
        return {
            "ok": True,
            "enabled": True,
            "quiet_now": True,
            "now": now.isoformat(timespec="minutes"),
            "config": auto_config,
            "candidates": [],
            "blocked": [
                {
                    "commenter": author,
                    "commenter_label": moment_author_label(author),
                    "reason": f"安静时段 {auto_config['quiet_start']}-{auto_config['quiet_end']} 中",
                }
                for author in enabled_commenters
            ],
            "summary": f"现在是安静时段 {auto_config['quiet_start']}-{auto_config['quiet_end']}，不生成自动评论候选。",
        }

    cooldown_seconds = int(auto_config["cooldown_minutes"]) * 60
    for author in enabled_commenters:
        latest = latest_by_author.get(author)
        if latest:
            elapsed = (now - latest.astimezone()).total_seconds()
            if elapsed < cooldown_seconds:
                remain_minutes = max(1, int((cooldown_seconds - elapsed + 59) // 60))
                blocked.append({
                    "commenter": author,
                    "commenter_label": moment_author_label(author),
                    "reason": f"冷却中，还需约 {remain_minutes} 分钟",
                })
                continue
        match = None
        for post in entries:
            if str(post.get("author", "")) == author:
                continue
            comments = post.get("comments") if isinstance(post.get("comments"), list) else []
            if any(str(comment.get("author", "")) == author for comment in comments):
                continue
            match = post
            break
        if not match:
            blocked.append({
                "commenter": author,
                "commenter_label": moment_author_label(author),
                "reason": "没有找到未回应的新动态",
            })
            continue
        candidates.append({
            "commenter": author,
            "commenter_label": moment_author_label(author),
            "moment_id": match.get("id", ""),
            "post_author": match.get("author", ""),
            "post_author_label": match.get("author_label") or moment_author_label(str(match.get("author", "me"))),
            "post_text": clean_memory_text(str(match.get("text", "")), 120) or "一张图片",
            "timestamp": match.get("timestamp", ""),
            "reason": "可作为下一条自动评论候选",
        })

    summary = f"可自动回应 {len(candidates)} 条；暂缓 {len(blocked)} 个。"
    return {
        "ok": True,
        "enabled": True,
        "quiet_now": False,
        "now": now.isoformat(timespec="minutes"),
        "config": auto_config,
        "candidates": candidates,
        "blocked": blocked,
        "summary": summary,
    }


def update_moment(data: dict) -> dict:
    action = str(data.get("action", ""))
    moment_id = str(data.get("id", ""))
    if action not in {"like", "unlike", "comment", "delete_post", "delete_comment", "auto_comment"} or not moment_id:
        return {"ok": False, "message": "朋友圈操作不完整。"}
    author = str(data.get("author", "me"))
    if author not in {"me", "linxu", "dengdeng", "aimas", "living"}:
        author = "me"
    generated_comment = None
    if action == "auto_comment":
        post = find_moment_entry(moment_id)
        if not post:
            return {"ok": False, "message": "没有找到这条圈圈，先刷新一下。"}
        generated_comment = generate_moment_comment(author, post)
        action = "comment"
    event = {
        "type": action,
        "id": moment_id,
        "moment_id": moment_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "author": author,
        "author_label": moment_author_label(author),
    }
    if action == "comment":
        text = clean_memory_text(generated_comment.get("reply", "") if generated_comment else str(data.get("text", "")), 600)
        if not text:
            return {"ok": False, "message": "评论不能为空。"}
        event["text"] = text
        event["reply_to"] = clean_memory_text(str(data.get("reply_to", "")), 80)
        event["comment_id"] = f"comment-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        if generated_comment:
            event["source"] = "auto_comment"
            event["generated_by"] = generated_comment.get("route", "provider")
    elif action == "delete_comment":
        comment_id = str(data.get("comment_id", "")).strip()
        if not comment_id:
            return {"ok": False, "message": "缺少要删除的评论。"}
        event["comment_id"] = comment_id
    path = moments_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return read_moments(80) | {"ok": True, "event": event}


def build_context(room: str, query: str) -> dict:
    target = ROOM_TARGETS.get(room, "shared")
    metadata_target = {
        "linxu": "alice",
        "dengdeng": "gemini",
        "living": "shared",
        "aimas": "aimas",
    }.get(room, target)
    config = read_config()
    allow_self = self_access_allowed(room, config)
    vault = find_vault_root()
    tool = vault / "tools" / "memory_context.py"
    command = [sys.executable, str(tool), target, query, "--limit", "6"]
    if allow_self:
        command.append("--allow-self")
    completed = subprocess.run(
        command,
        cwd=tool.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return {
            "markdown": "本地记忆工具运行失败：\n\n" + (completed.stderr or completed.stdout or "没有错误详情。")
        }
    search_meta = build_context_search_metadata(vault, metadata_target, query, allow_self)
    return {
        "markdown": completed.stdout,
        "target": search_meta.get("target", target),
        "display": search_meta.get("display", target),
        "query": query,
        "include_sensitive": bool(search_meta.get("include_sensitive", False)),
        "allow_self": allow_self and any(item.get("included") for item in search_meta.get("route", {}).get("self_files", [])),
        "self_access": normalize_self_access(config.get("self_access", {})),
        "route": search_meta.get("route", {}),
        "raw_match_count": search_meta.get("raw_match_count", 0),
        "collapsed_match_count": search_meta.get("collapsed_match_count", 0),
        "results": search_meta.get("results", []),
    }


def build_context_search_metadata(vault: Path, target: str, query: str, allow_self: bool = False) -> dict:
    tool = vault / "tools" / "memory_search.py"
    command = [sys.executable, str(tool), target, query, "--limit", "6", "--json"]
    if allow_self:
        command.append("--allow-self")
    completed = subprocess.run(
        command,
        cwd=tool.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return {
            "target": target,
            "display": target,
            "query": query,
            "results": [],
            "message": completed.stderr or completed.stdout or "搜索元数据读取失败。",
        }
    try:
        return json.loads(completed.stdout or "{}")
    except json.JSONDecodeError:
        return {
            "target": target,
            "display": target,
            "query": query,
            "results": [],
            "message": "搜索元数据不是有效 JSON。",
        }


def context_item_preview(item: dict) -> dict:
    flags = item.get("flags") if isinstance(item.get("flags"), list) else []
    categories = item.get("categories") if isinstance(item.get("categories"), list) else []
    return {
        "source_index": str(item.get("source_index") or ""),
        "source": str(item.get("source") or ""),
        "title": clean_memory_text(str(item.get("title") or item.get("reference") or "未命名片段"), 120),
        "date": str(item.get("date") or ""),
        "phase": str(item.get("phase") or ""),
        "categories": [str(value) for value in categories[:6]],
        "flags": [str(value) for value in flags[:6]],
        "reference": clean_memory_text(str(item.get("reference") or ""), 160),
        "summary": clean_memory_text(str(item.get("summary") or ""), 220),
        "score": item.get("score", 0),
    }


def short_context_preview(entries: list[dict]) -> list[dict]:
    preview = []
    for item in entries[-6:]:
        preview.append(
            {
                "role": item.get("role", ""),
                "timestamp": item.get("timestamp", ""),
                "text": clean_memory_text(str(item.get("text", "")), 180),
            }
        )
    return preview


def build_context_preview(room: str, query: str, context: dict, short_context: list[dict], route: dict) -> dict:
    results = [item for item in context.get("results", []) if isinstance(item, dict)]
    confirmed = [item for item in results if item.get("source_index") == "confirmed_memory"]
    long_candidates = [item for item in results if item.get("source_index") != "confirmed_memory"]
    route_meta = context.get("route", {}) if isinstance(context.get("route"), dict) else {}
    self_files = route_meta.get("self_files") if isinstance(route_meta.get("self_files"), list) else []
    read_files = route_meta.get("read_files") if isinstance(route_meta.get("read_files"), list) else []
    forbidden = route_meta.get("forbidden") if isinstance(route_meta.get("forbidden"), list) else []
    self_access = normalize_self_access(context.get("self_access", {}))
    return {
        "room": room,
        "room_label": SESSION_LABELS.get(room, room),
        "query": clean_memory_text(query, 220),
        "target": context.get("target", ROOM_TARGETS.get(room, "shared")),
        "display": context.get("display", ROOM_TARGETS.get(room, "shared")),
        "route": {"type": route.get("type"), "route_id": route.get("route_id")},
        "short_context": {
            "count": len(short_context),
            "window": 18,
            "items": short_context_preview(short_context),
        },
        "long_term": {
            "used": bool(context.get("markdown")),
            "raw_match_count": context.get("raw_match_count", 0),
            "collapsed_match_count": context.get("collapsed_match_count", 0),
            "candidate_count": len(long_candidates),
            "items": [context_item_preview(item) for item in long_candidates[:6]],
        },
        "confirmed_memory": {
            "candidate_count": len(confirmed),
            "items": [context_item_preview(item) for item in confirmed[:6]],
        },
        "self": {
            "enabled": bool(context.get("allow_self")),
            "master_enabled": bool(self_access.get("enabled")),
            "readers": self_access.get("readers", {}),
            "files": [
                {
                    "path": str(item.get("path", "")),
                    "exists": bool(item.get("exists")),
                    "included": bool(item.get("included")),
                }
                for item in self_files
            ],
        },
        "policy": {
            "include_sensitive": bool(context.get("include_sensitive", False)),
            "read_files": [str(item.get("path", "")) for item in read_files if item.get("exists")],
            "forbidden": [str(value) for value in forbidden],
        },
    }


def build_search(room: str, query: str, include_sensitive: bool = False) -> dict:
    target = ROOM_TARGETS.get(room, "shared")
    vault = find_vault_root()
    tool = vault / "tools" / "memory_search.py"
    command = [sys.executable, str(tool), target, query, "--limit", "6", "--json"]
    if include_sensitive:
        command.append("--include-sensitive")
    completed = subprocess.run(
        command,
        cwd=tool.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return {
            "display": target,
            "query": query,
            "results": [],
            "message": "本地搜索工具运行失败：\n\n" + (completed.stderr or completed.stdout or "没有错误详情。"),
        }
    data = json.loads(completed.stdout)
    return {
        "display": data.get("display", target),
        "query": data.get("query", query),
        "terms": data.get("terms", []),
        "phase_filter": data.get("phase_filter"),
        "include_sensitive": data.get("include_sensitive", include_sensitive),
        "raw_match_count": data.get("raw_match_count"),
        "collapsed_match_count": data.get("collapsed_match_count"),
        "results": data.get("results", []),
        "message": "检索结果只来自索引摘要，不代表已经读取完整原文。",
    }


def build_stats() -> dict:
    vault = find_vault_root()
    gpt_conversations = count_jsonl(vault / "gpt" / "parsed" / "conversation_index.jsonl")
    gemini_activities = count_jsonl(vault / "gemini" / "parsed" / "activity_index.jsonl")
    incoming_supplements = count_jsonl(vault / "self" / "reports" / "incoming_chat_index.jsonl")
    persona_evidence = count_jsonl(vault / "gpt" / "parsed" / "persona_evidence_extracts.jsonl")
    relationship_nodes = (
        count_jsonl(vault / "gpt" / "parsed" / "relationship_node_index.jsonl")
        + count_jsonl(vault / "gemini" / "parsed" / "relationship_node_index.jsonl")
    )
    daily_entries = (
        count_jsonl(vault / "gpt" / "parsed" / "daily_companionship_index.jsonl")
        + count_jsonl(vault / "gemini" / "parsed" / "daily_companionship_index.jsonl")
    )
    return {
        "gpt_conversations": gpt_conversations,
        "gemini_activities": gemini_activities,
        "incoming_supplements": incoming_supplements,
        "persona_evidence": persona_evidence,
        "relationship_nodes": relationship_nodes,
        "daily_entries": daily_entries,
        "residents": 3,
        "aimas_status": "留门牌，待接 Hermes",
        "privacy_note": "统计只读取索引行数，不读取原始聊天正文。",
    }


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        if not self.path.startswith("/api/") and self.path.split("?", 1)[0].endswith((".html", ".css", ".js", "/")):
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/assets/prototype/"):
            relative = unquote(parsed.path.removeprefix("/assets/prototype/")).replace("\\", "/")
            asset_path = (prototype_assets_root() / relative).resolve()
            asset_root = prototype_assets_root().resolve()
            if asset_root not in asset_path.parents or not asset_path.is_file():
                self.send_error(404)
                return
            body = asset_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(str(asset_path))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "private, max-age=86400")
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/health":
            try:
                vault = find_vault_root()
                payload = {
                    "ok": True,
                    "service": "stillgarden-local",
                    "vault": str(vault),
                    "sessions": str(vault / "sessions" / "prototype"),
                    "pid": os.getpid(),
                    "started_at": SERVICE_STARTED_AT,
                }
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"本地服务可用，但记忆库路径异常：{exc}"}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/stats":
            try:
                payload = build_stats()
                status = 200
            except Exception as exc:
                payload = {"error": f"读取统计失败：{exc}"}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/search":
            params = parse_qs(parsed.query)
            room = params.get("room", ["linxu"])[0]
            query = params.get("query", ["人格"])[0]
            include_sensitive = params.get("include_sensitive", ["false"])[0].lower() == "true"
            try:
                payload = build_search(room, query, include_sensitive)
                status = 200
            except Exception as exc:
                payload = {"results": [], "message": f"搜索失败：{exc}"}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/session-log":
            params = parse_qs(parsed.query)
            room = params.get("room", ["linxu"])[0]
            query = params.get("query", [""])[0].strip()
            try:
                limit = int(params.get("limit", ["12"])[0])
            except ValueError:
                limit = 12
            try:
                payload = search_session_log(room, query, limit) if query else read_session_log(room, limit)
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取本地草稿失败：{exc}", "entries": []}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/config":
            try:
                payload = {"ok": True, "config": read_config(), "relative_path": str(config_path().relative_to(find_vault_root()))}
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取配置失败：{exc}", "config": dict(DEFAULT_CONFIG)}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/wake-inbox":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["20"])[0])
            except ValueError:
                limit = 20
            try:
                payload = read_wake_inbox(limit)
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取唤醒收件箱失败：{exc}", "entries": []}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/moments":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["80"])[0])
            except ValueError:
                limit = 80
            try:
                payload = read_moments(limit)
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取圈圈失败：{exc}", "entries": []}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/moments-auto-preview":
            try:
                payload = read_moments_auto_preview()
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取自动评论候选失败：{exc}", "candidates": [], "blocked": []}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/timeline":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["120"])[0])
            except ValueError:
                limit = 120
            try:
                payload = read_timeline(limit)
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取统一时间线失败：{exc}", "entries": []}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/profile-assets":
            try:
                manifest = read_profile_assets()
                payload = {
                    "ok": True,
                    "assets": flatten_profile_assets(manifest),
                    "relative_path": str(profile_assets_path().relative_to(find_vault_root())),
                }
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取头像资产失败：{exc}", "assets": {}}
                status = 500
            return self.write_json(payload, status)

        if parsed.path == "/api/memory-confirmed":
            params = parse_qs(parsed.query)
            try:
                limit = int(params.get("limit", ["40"])[0])
            except ValueError:
                limit = 40
            try:
                payload = read_confirmed_memory(limit)
                status = 200
            except Exception as exc:
                payload = {"ok": False, "message": f"读取确认记忆失败：{exc}", "entries": []}
                status = 500
            return self.write_json(payload, status)

        if parsed.path != "/api/context":
            return super().do_GET()

        params = parse_qs(parsed.query)
        room = params.get("room", ["living"])[0]
        query = params.get("query", ["边界"])[0]
        try:
            payload = build_context(room, query)
            status = 200
        except Exception as exc:  # Keep the local UI friendly instead of crashing the server.
            payload = {"markdown": f"本地小窝服务遇到问题：{exc}"}
            status = 500

        return self.write_json(payload, status)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/api/session-log", "/api/chat-package", "/api/config", "/api/aimas-probe", "/api/aimas-chat", "/api/provider-chat", "/api/wake-draft", "/api/wake-auto", "/api/wake-action", "/api/moment-create", "/api/moment-action", "/api/memory-daily-summary", "/api/memory-confirm", "/api/memory-refresh", "/api/profile-asset", "/api/profile-assets-clear"}:
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            max_body = 16_000_000 if parsed.path in {"/api/profile-asset", "/api/moment-create"} else 20000
            if length > max_body:
                self.rfile.read(length)
                raise ValueError("请求太大，先换一张小一点的图。")
            raw_body = self.rfile.read(length).decode("utf-8")
            data = json.loads(raw_body or "{}")
            if parsed.path == "/api/config":
                payload = write_config(data)
            elif parsed.path == "/api/profile-asset":
                payload = save_profile_asset(data)
            elif parsed.path == "/api/profile-assets-clear":
                payload = clear_profile_assets(data)
            elif parsed.path == "/api/aimas-probe":
                payload = probe_aimas(data)
            elif parsed.path == "/api/aimas-chat":
                payload = aimas_chat(data)
            elif parsed.path == "/api/provider-chat":
                payload = call_provider_model(
                    str(data.get("room", "linxu")),
                    str(data.get("text", "")),
                    str(data.get("client_id", "")) or None,
                )
            elif parsed.path == "/api/wake-draft":
                payload = create_wake_draft(
                    str(data.get("room", "linxu")),
                    str(data.get("reason", "")),
                )
            elif parsed.path == "/api/wake-auto":
                payload = create_auto_wake_draft()
            elif parsed.path == "/api/wake-action":
                payload = update_wake_draft(
                    str(data.get("id", "")),
                    str(data.get("action", "")),
                )
            elif parsed.path == "/api/moment-create":
                payload = create_moment(data)
            elif parsed.path == "/api/moment-action":
                payload = update_moment(data)
            elif parsed.path == "/api/memory-daily-summary":
                payload = build_daily_summary_candidate(
                    str(data.get("room", "linxu")),
                    str(data.get("date", "")) or None,
                )
            elif parsed.path == "/api/memory-confirm":
                payload = confirm_memory(data)
            elif parsed.path == "/api/memory-refresh":
                payload = refresh_memory_index()
            elif parsed.path == "/api/chat-package":
                payload = append_chat_package(
                    str(data.get("room", "linxu")),
                    str(data.get("text", "")),
                    str(data.get("client_id", "")) or None,
                )
            else:
                payload = append_session_log(
                    str(data.get("room", "linxu")),
                    str(data.get("text", "")),
                    str(data.get("client_id", "")) or None,
                    str(data.get("role", "user")),
                )
            status = 200 if payload.get("ok", True) else 502
        except Exception as exc:
            payload = {"ok": False, "message": f"本地写入失败：{exc}"}
            status = 500
        return self.write_json(payload, status)

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    root = Path(__file__).resolve().parent
    os.chdir(root)

    requested_port = int(os.environ.get("STILLGARDEN_PORT", "8877"))
    ports = [requested_port] if "STILLGARDEN_PORT" in os.environ else range(requested_port, requested_port + 10)
    server = None
    port = requested_port
    for candidate in ports:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
            port = candidate
            break
        except OSError:
            continue
    if server is None:
        raise OSError(f"{requested_port} 起连续 10 个端口都被占用了，请先关掉旧的月亮小窝黑色窗口。")

    url = f"http://127.0.0.1:{port}/?v={FRONTEND_CACHE_VERSION}"
    print(f"月亮小窝本地服务已启动：{url}")
    if port != requested_port:
        print(f"提示：{requested_port} 可能被旧窗口占用，这次自动使用 {port}。")
    print("关闭这个窗口即可停止服务。")
    if os.environ.get("STILLGARDEN_NO_OPEN") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
