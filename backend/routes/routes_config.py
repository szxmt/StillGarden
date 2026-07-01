from __future__ import annotations

from server_config import DEFAULT_CONFIG, config_path, find_vault_root
from services.config_service import read_config, write_config
from providers.hermes_provider import probe_aimas


def config_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    try:
        return {
            "ok": True,
            "config": read_config(),
            "relative_path": str(config_path().relative_to(find_vault_root())),
        }, 200
    except Exception as exc:
        return {"ok": False, "message": f"读取配置失败：{exc}", "config": dict(DEFAULT_CONFIG)}, 500


def config_post(data: dict) -> dict:
    return write_config(data)


def aimas_probe_post(data: dict) -> dict:
    return probe_aimas(data)


GET_ROUTES = {"/api/config": config_get}

POST_ROUTES = {
    "/api/config": config_post,
    "/api/aimas-probe": aimas_probe_post,
}

