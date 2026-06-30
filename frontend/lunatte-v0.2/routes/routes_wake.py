from __future__ import annotations

from services.wake_service import create_auto_wake_draft, create_wake_draft, read_wake_inbox, update_wake_draft


def _int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(params.get(name, [str(default)])[0])
    except ValueError:
        return default


def wake_inbox_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    limit = _int_param(params, "limit", 20)
    try:
        return read_wake_inbox(limit), 200
    except Exception as exc:
        return {"ok": False, "message": f"读取唤醒收件箱失败：{exc}", "entries": []}, 500


def wake_draft_post(data: dict) -> dict:
    return create_wake_draft(str(data.get("room", "linxu")), str(data.get("reason", "")))


def wake_auto_post(data: dict) -> dict:
    return create_auto_wake_draft()


def wake_action_post(data: dict) -> dict:
    return update_wake_draft(str(data.get("id", "")), str(data.get("action", "")))


GET_ROUTES = {"/api/wake-inbox": wake_inbox_get}

POST_ROUTES = {
    "/api/wake-draft": wake_draft_post,
    "/api/wake-auto": wake_auto_post,
    "/api/wake-action": wake_action_post,
}

