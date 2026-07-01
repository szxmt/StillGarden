from __future__ import annotations

import uuid
from datetime import datetime, timezone

from server_config import AUTO_WAKE_ORDER, AUTO_WAKE_REASONS, SESSION_LABELS, normalize_session_room
from repositories.wake_repository import append_wake_record, read_wake_events, wake_relative_path
from services.chat_service import append_session_log

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
    append_wake_record(record)
    return {
        "ok": True,
        "record": record,
        "relative_path": wake_relative_path(),
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
        "relative_path": wake_relative_path(),
    }

def read_wake_inbox(limit: int = 20) -> dict:
    by_id: dict[str, dict] = {}
    order: list[str] = []
    for item in read_wake_events():
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
        "relative_path": wake_relative_path(),
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

    append_wake_record(patch)
    updated = dict(match)
    updated.update(patch)
    return {
        "ok": True,
        "record": updated,
        "relative_path": wake_relative_path(),
    }
