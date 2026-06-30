from __future__ import annotations

from urllib.parse import parse_qs

from routes import routes_archive, routes_assets, routes_chat, routes_config, routes_context, routes_moments, routes_stats, routes_timeline, routes_wake


GET_ROUTES = {}
POST_ROUTES = {}

for module in (
    routes_stats,
    routes_config,
    routes_context,
    routes_chat,
    routes_archive,
    routes_wake,
    routes_moments,
    routes_timeline,
    routes_assets,
):
    GET_ROUTES.update(getattr(module, "GET_ROUTES", {}))
    POST_ROUTES.update(getattr(module, "POST_ROUTES", {}))


LARGE_BODY_ROUTES = {"/api/profile-asset", "/api/moment-create"}


def route_get(path: str, query: str) -> tuple[dict, int] | None:
    handler = GET_ROUTES.get(path)
    if not handler:
        return None
    return handler(parse_qs(query))


def route_post(path: str, data: dict) -> tuple[dict, int] | None:
    handler = POST_ROUTES.get(path)
    if not handler:
        return None
    payload = handler(data)
    return payload, 200 if payload.get("ok", True) else 502


def max_body_bytes(path: str) -> int:
    return 16_000_000 if path in LARGE_BODY_ROUTES else 20_000

