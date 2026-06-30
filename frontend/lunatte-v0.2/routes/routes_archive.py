from __future__ import annotations

from services.archive_service import build_daily_summary_candidate, confirm_memory, read_confirmed_memory, refresh_memory_index


def _int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(params.get(name, [str(default)])[0])
    except ValueError:
        return default


def memory_confirmed_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    limit = _int_param(params, "limit", 40)
    try:
        return read_confirmed_memory(limit), 200
    except Exception as exc:
        return {"ok": False, "message": f"读取确认记忆失败：{exc}", "entries": []}, 500


def memory_daily_summary_post(data: dict) -> dict:
    return build_daily_summary_candidate(
        str(data.get("room", "linxu")),
        str(data.get("date", "")) or None,
    )


def memory_confirm_post(data: dict) -> dict:
    return confirm_memory(data)


def memory_refresh_post(data: dict) -> dict:
    return refresh_memory_index()


GET_ROUTES = {"/api/memory-confirmed": memory_confirmed_get}

POST_ROUTES = {
    "/api/memory-daily-summary": memory_daily_summary_post,
    "/api/memory-confirm": memory_confirm_post,
    "/api/memory-refresh": memory_refresh_post,
}

