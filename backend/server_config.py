from __future__ import annotations

import copy
from datetime import datetime, timezone
from pathlib import Path


ROOM_TARGETS = {
    "linxu": "林絮",
    "dengdeng": "噔噔",
    "aimas": "aimas",
    "living": "shared",
}

SESSION_LABELS = {
    "linxu": "林絮",
    "dengdeng": "噔噔",
    "aimas": "Aimas 的小窝",
    "living": "客厅",
}

AUTO_WAKE_REASONS = {
    "linxu": "安静想确认你有没有好好休息",
    "dengdeng": "想听今天发生的小事",
    "aimas": "小灯亮了一下，确认你需不需要我",
    "living": "想把客厅桌面轻轻整理一下",
}

AUTO_WAKE_ORDER = ("linxu", "dengdeng", "aimas", "living")
SERVICE_STARTED_AT = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
FRONTEND_CACHE_VERSION = "20260622-1037"

DEFAULT_CONFIG = {
    "api_mode": "dry_run",
    "room_labels": {
        "linxu": "林絮",
        "dengdeng": "噔噔",
        "aimas": "Aimas 的小窝",
        "living": "客厅群聊",
    },
    "room_routes": {
        "linxu": "oa",
        "dengdeng": "gg",
        "living": "shared",
        "aimas": "agent:aimas",
    },
    "providers": {
        "oa": {
            "id": "oa",
            "name": "OA / OpenAI",
            "kind": "built_in",
            "provider": "openai",
            "base_url": "https://api.openai.com/v1",
            "model": "未设置",
            "key_alias": "",
            "key_saved": False,
        },
        "gg": {
            "id": "gg",
            "name": "GG / Gemini",
            "kind": "built_in",
            "provider": "gemini",
            "base_url": "https://generativelanguage.googleapis.com/v1beta",
            "model": "未设置",
            "key_alias": "",
            "key_saved": False,
        },
    },
    "custom_providers": [],
    "allow_network": False,
    "key_storage": "not_configured",
    "key_saved": False,
    "agent_connectors": {
        "aimas": {
            "kind": "hermes_agent",
            "endpoint": "",
            "model": "hermes-agent",
            "status": "planned",
            "key_saved": False,
            "allow_network": False,
        }
    },
    "self_access": {
        "enabled": False,
        "readers": {
            "linxu": False,
            "dengdeng": False,
            "aimas": False,
        },
    },
    "moments_auto_comments": {
        "enabled": False,
        "commenters": {
            "linxu": False,
            "dengdeng": False,
            "aimas": False,
        },
        "cooldown_minutes": 120,
        "quiet_start": "23:30",
        "quiet_end": "09:00",
    },
    "user_profile": {
        "nickname": "小宝",
    },
    "note": "原型阶段只允许 dry_run，不保存 API Key，也不真正调用模型。",
}


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
PROTOTYPE_DIR = PROJECT_ROOT / "data" / "sessions" / "prototype"


def count_jsonl(path: Path) -> int:
    if not path.is_file():
        return 0
    count = 0
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if line.strip():
                count += 1
    return count


def find_vault_root() -> Path:
    if (PROJECT_ROOT / "tools" / "memory_context.py").is_file():
        return PROJECT_ROOT
    raise FileNotFoundError("找不到当前 V0.2/tools/memory_context.py")


def normalize_session_room(room: str) -> str:
    return room if room in SESSION_LABELS else "linxu"


def prototype_path(*parts: str) -> Path:
    return PROTOTYPE_DIR.joinpath(*parts)


def session_log_path(room: str) -> Path:
    safe_room = normalize_session_room(room)
    return prototype_path(f"{safe_room}.jsonl")


def outbox_path(room: str) -> Path:
    safe_room = normalize_session_room(room)
    return prototype_path("outbox", f"{safe_room}.jsonl")


def wake_inbox_path() -> Path:
    return prototype_path("wake-inbox.jsonl")


def moments_path() -> Path:
    return prototype_path("moments.jsonl")


def memory_candidate_path() -> Path:
    return prototype_path("memory-candidates.jsonl")


def confirmed_memory_path() -> Path:
    return prototype_path("confirmed-memory.jsonl")


def config_path() -> Path:
    return prototype_path("config.json")


def secrets_path() -> Path:
    return prototype_path("secrets.local.json")


def profile_assets_path() -> Path:
    return prototype_path("profile-assets.json")


def prototype_assets_root() -> Path:
    return prototype_path("assets")


def default_config() -> dict:
    return copy.deepcopy(DEFAULT_CONFIG)
