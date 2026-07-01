from __future__ import annotations

from services.timeline_service import read_timeline


def timeline_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    try:
        try:
            limit = int(params.get("limit", ["120"])[0])
        except ValueError:
            limit = 120
        return read_timeline(limit), 200
    except Exception as exc:
        return {"ok": False, "message": f"读取统一时间线失败：{exc}", "entries": []}, 500


GET_ROUTES = {"/api/timeline": timeline_get}

