from __future__ import annotations

import os

from server_config import DEFAULT_CONFIG, SERVICE_STARTED_AT, find_vault_root
from services.stats_service import build_stats


def health_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    try:
        vault = find_vault_root()
        return {
            "ok": True,
            "service": "stillgarden-local",
            "vault": str(vault),
            "sessions": str(vault / "sessions" / "prototype"),
            "pid": os.getpid(),
            "started_at": SERVICE_STARTED_AT,
        }, 200
    except Exception as exc:
        return {"ok": False, "message": f"本地服务可用，但记忆库路径异常：{exc}"}, 500


def stats_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    try:
        return build_stats(), 200
    except Exception as exc:
        return {"error": f"读取统计失败：{exc}"}, 500


GET_ROUTES = {
    "/api/health": health_get,
    "/api/stats": stats_get,
}

