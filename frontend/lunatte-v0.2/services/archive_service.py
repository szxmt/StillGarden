from __future__ import annotations

import subprocess
import sys
import uuid
from datetime import datetime, timezone

from server_config import SESSION_LABELS, normalize_session_room
from repositories.archive_repository import (
    append_confirmed_memory,
    append_memory_candidate,
    confirmed_memory_count,
    confirmed_memory_relative_path,
    memory_candidate_relative_path,
    read_confirmed_events,
    read_session_entries_for_day,
)
from services.config_service import read_config
from services.text_utils import clean_memory_text

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

def read_confirmed_memory(limit: int = 40) -> dict:
    return {
        "ok": True,
        "relative_path": confirmed_memory_relative_path(),
        "entries": read_confirmed_events(limit),
    }

def recent_session_entries_for_summary(room: str, date_value: str | None = None, limit: int = 80) -> list[dict]:
    safe_room = normalize_session_room(room)
    day = (date_value or datetime.now().astimezone().date().isoformat())[:10]
    return read_session_entries_for_day(safe_room, day, limit)

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
    append_memory_candidate(record)
    return {
        "ok": True,
        "record": record,
        "relative_path": memory_candidate_relative_path(),
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
    append_confirmed_memory(record)

    if candidate_id:
        candidate_patch = {
            "id": candidate_id,
            "updated_at": now.isoformat(timespec="seconds"),
            "status": "confirmed",
            "confirmed": True,
            "memory_id": memory_id,
        }
        append_memory_candidate(candidate_patch)

    return {
        "ok": True,
        "record": record,
        "relative_path": confirmed_memory_relative_path(),
        "message": "已确认入库；Archive 搜索会读取这条 confirmed-memory。",
    }

def refresh_memory_index() -> dict:
    return {
        "ok": True,
        "confirmed_count": confirmed_memory_count(),
        "relative_path": confirmed_memory_relative_path(),
        "message": "当前索引是实时读取 JSONL：刷新完成，新的确认记忆已经可被搜索。",
    }
