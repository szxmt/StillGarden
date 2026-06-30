from __future__ import annotations

from services.chat_service import (
    aimas_chat,
    append_chat_package,
    append_session_log,
    call_provider_model,
    read_session_log,
    search_session_log,
)


def _int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(params.get(name, [str(default)])[0])
    except ValueError:
        return default


def session_log_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    room = params.get("room", ["linxu"])[0]
    query = params.get("query", [""])[0].strip()
    limit = _int_param(params, "limit", 12)
    try:
        payload = search_session_log(room, query, limit) if query else read_session_log(room, limit)
        return payload, 200
    except Exception as exc:
        return {"ok": False, "message": f"读取本地草稿失败：{exc}", "entries": []}, 500


def session_log_post(data: dict) -> dict:
    return append_session_log(
        str(data.get("room", "linxu")),
        str(data.get("text", "")),
        str(data.get("client_id", "")) or None,
        str(data.get("role", "user")),
    )


def chat_package_post(data: dict) -> dict:
    return append_chat_package(
        str(data.get("room", "linxu")),
        str(data.get("text", "")),
        str(data.get("client_id", "")) or None,
    )


def provider_chat_post(data: dict) -> dict:
    return call_provider_model(
        str(data.get("room", "linxu")),
        str(data.get("text", "")),
        str(data.get("client_id", "")) or None,
    )


def aimas_chat_post(data: dict) -> dict:
    return aimas_chat(data)


GET_ROUTES = {"/api/session-log": session_log_get}

POST_ROUTES = {
    "/api/session-log": session_log_post,
    "/api/chat-package": chat_package_post,
    "/api/provider-chat": provider_chat_post,
    "/api/aimas-chat": aimas_chat_post,
}

