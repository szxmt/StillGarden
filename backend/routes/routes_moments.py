from __future__ import annotations

from services.moments_service import create_moment, read_moments, read_moments_auto_preview, update_moment


def _int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(params.get(name, [str(default)])[0])
    except ValueError:
        return default


def moments_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    limit = _int_param(params, "limit", 80)
    try:
        return read_moments(limit), 200
    except Exception as exc:
        return {"ok": False, "message": f"读取圈圈失败：{exc}", "entries": []}, 500


def moments_auto_preview_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    try:
        return read_moments_auto_preview(), 200
    except Exception as exc:
        return {"ok": False, "message": f"读取自动评论候选失败：{exc}", "candidates": [], "blocked": []}, 500


GET_ROUTES = {
    "/api/moments": moments_get,
    "/api/moments-auto-preview": moments_auto_preview_get,
}

POST_ROUTES = {
    "/api/moment-create": create_moment,
    "/api/moment-action": update_moment,
}

