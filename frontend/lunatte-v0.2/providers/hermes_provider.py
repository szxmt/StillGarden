from __future__ import annotations

from urllib.parse import urlparse

from server_storage import read_secrets
from services.config_service import read_config
from providers.http_client import request_json

def aimas_urls(endpoint: str) -> tuple[str, str]:
    clean = endpoint.strip().rstrip("/")
    if not clean:
        raise ValueError("Aimas Endpoint 还没有填写。")
    parsed = urlparse(clean)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Aimas Endpoint 需要是 http:// 或 https:// 开头的地址。")
    base_without_v1 = clean[:-3] if clean.endswith("/v1") else clean
    api_base = clean if clean.endswith("/v1") else f"{clean}/v1"
    return f"{base_without_v1}/health", f"{api_base}/models"

def probe_aimas(data: dict) -> dict:
    config = read_config()
    aimas = config.get("agent_connectors", {}).get("aimas", {})
    endpoint = str(data.get("endpoint") or aimas.get("endpoint") or "").strip()
    typed_key = str(data.get("api_key") or "").strip()
    saved_key = read_secrets().get("aimas", {}).get("api_key", "")
    api_key = typed_key or saved_key
    try:
        health_url, models_url = aimas_urls(endpoint)
    except ValueError as exc:
        return {
            "ok": False,
            "endpoint": endpoint,
            "health": {"status": 0, "ok": False, "url": "", "payload": {"message": str(exc)}},
            "models": {"status": 0, "ok": False, "url": "", "items": [], "payload": {"message": str(exc)}},
            "message": str(exc),
        }

    health_status, health_payload = request_json(health_url, timeout=8)
    models_status, models_payload = request_json(models_url, api_key=api_key, timeout=8)
    models = []
    raw_models = models_payload.get("data") if isinstance(models_payload, dict) else None
    if isinstance(raw_models, list):
        for item in raw_models[:12]:
            if isinstance(item, dict) and item.get("id"):
                models.append(str(item["id"]))

    ok = 200 <= health_status < 300 and 200 <= models_status < 300
    return {
        "ok": ok,
        "endpoint": endpoint,
        "health": {
            "status": health_status,
            "ok": 200 <= health_status < 300,
            "url": health_url,
            "payload": health_payload,
        },
        "models": {
            "status": models_status,
            "ok": 200 <= models_status < 300,
            "url": models_url,
            "items": models,
            "payload": models_payload if not models else {"data": [{"id": item} for item in models]},
        },
        "message": "Aimas / Hermes 可连接。" if ok else "Aimas / Hermes 探针未通过，请检查 endpoint、端口或 API_SERVER_KEY。",
    }
