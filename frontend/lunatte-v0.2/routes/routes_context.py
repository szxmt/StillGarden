from __future__ import annotations

from services.context_service import build_context, build_search


def search_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    room = params.get("room", ["linxu"])[0]
    query = params.get("query", ["人格"])[0]
    include_sensitive = params.get("include_sensitive", ["false"])[0].lower() == "true"
    try:
        return build_search(room, query, include_sensitive), 200
    except Exception as exc:
        return {"results": [], "message": f"搜索失败：{exc}"}, 500


def context_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    room = params.get("room", ["living"])[0]
    query = params.get("query", ["边界"])[0]
    try:
        return build_context(room, query), 200
    except Exception as exc:
        return {"markdown": f"本地小窝服务遇到问题：{exc}"}, 500


GET_ROUTES = {
    "/api/search": search_get,
    "/api/context": context_get,
}

