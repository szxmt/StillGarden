from __future__ import annotations

from datetime import datetime

from server_config import SESSION_LABELS, normalize_session_room
from repositories.session_repository import (
    append_outbox_record,
    append_session_record,
    outbox_relative_path,
    read_session_entries,
    search_session_entries,
    session_relative_path,
)
from services.config_service import read_config, route_for_room
from services.context_service import build_context, build_context_preview
from services.chat_provider_orchestration import aimas_chat, call_provider_model, recent_session_messages
from services.chat_reply_policy import sanitize_dialogue_reply, split_agent_bubbles
from services.text_utils import clean_memory_text

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

def append_session_log(room: str, text: str, client_id: str | None = None, role: str = "user") -> dict:
    safe_room = normalize_session_room(room)
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("消息是空的。")
    if len(clean_text) > 12000:
        raise ValueError("这条草稿太长了，先分几条发会更稳。")
    safe_role = role if role in {"user", "assistant", "system"} else "user"

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
    append_session_record(safe_room, record)
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "relative_path": session_relative_path(safe_room),
        "record": record,
    }

def append_chat_package(room: str, text: str, client_id: str | None = None) -> dict:
    safe_room = normalize_session_room(room)
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("消息是空的。")
    context = build_context(safe_room, clean_text)
    short_context = recent_session_messages(safe_room, exclude_client_id=client_id, limit=18)
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
    append_outbox_record(safe_room, record)
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "relative_path": outbox_relative_path(safe_room),
        "markdown": context.get("markdown", ""),
        "context_preview": context_preview,
        "record": record,
    }

def read_session_log(room: str, limit: int = 12) -> dict:
    safe_room = normalize_session_room(room)
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "relative_path": session_relative_path(safe_room),
        "entries": read_session_entries(safe_room, limit),
    }

def search_session_log(room: str, query: str, limit: int = 60) -> dict:
    safe_room = normalize_session_room(room)
    return {
        "ok": True,
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "query": query,
        "relative_path": session_relative_path(safe_room),
        "entries": search_session_entries(safe_room, query, limit),
    }
