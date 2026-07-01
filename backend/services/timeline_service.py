from __future__ import annotations

import uuid
from datetime import datetime

from server_config import SESSION_LABELS
from repositories.timeline_repository import (
    read_timeline_memory_events,
    read_timeline_moment_events,
    read_timeline_session_events,
    source_relative_path,
    timeline_sources,
)
from server_config import confirmed_memory_path, moments_path, session_log_path
from services.moments_labels import moment_author_label, moment_event_author_label
from services.text_utils import clean_memory_text

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
    events: list[dict] = []
    per_source_limit = max(50, min(limit, 300))

    for room in SESSION_LABELS:
        path = session_log_path(room)
        for entry in read_timeline_session_events(room, per_source_limit):
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
                    "source_file": source_relative_path(path),
                },
            ))

    moments_file = moments_path()
    for entry in read_timeline_moment_events(max(200, per_source_limit * 3)):
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
                "source_file": source_relative_path(moments_file),
            },
        ))

    memory_file = confirmed_memory_path()
    for entry in read_timeline_memory_events(per_source_limit):
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
                "source_file": source_relative_path(memory_file),
            },
        ))

    events.sort(key=lambda item: float(item.get("sort_ts") or 0), reverse=True)
    return {
        "ok": True,
        "entries": events[: max(1, min(limit, 500))],
        "sources": timeline_sources(),
        "note": "统一时间线草稿：只读聚合，不迁移、不写入、不做向量化。",
    }
