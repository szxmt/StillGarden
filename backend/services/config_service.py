from __future__ import annotations

from datetime import datetime

from server_config import SESSION_LABELS, default_config
from repositories.config_repository import config_relative_path, read_config_file, write_config_file
from services.config_policy import normalize_moments_auto_comments, normalize_self_access, normalize_user_profile, self_access_allowed
from services.config_secrets import aimas_secret_saved, provider_api_key, provider_secret_saved, update_aimas_secret, update_provider_secret

def sanitize_custom_provider(item: dict, fallback_name: str = "自定义1") -> dict:
    provider_id = str(item.get("id", "")).strip()[:80] or f"custom-{datetime.now().timestamp()}"
    name = str(item.get("name", "")).strip()[:40] or fallback_name
    return {
        "id": provider_id,
        "name": name,
        "kind": "custom",
        "provider": "custom",
        "base_url": str(item.get("base_url", "")).strip()[:200],
        "model": str(item.get("model", "")).strip()[:80] or "未设置",
        "key_alias": str(item.get("key_alias", "")).strip()[:80],
        "key_saved": False,
        "allow_network": False,
    }

def next_custom_name(custom_providers: list[dict]) -> str:
    used = set()
    for item in custom_providers:
        name = str(item.get("name", "")).strip()
        if name.startswith("自定义") and name[3:].isdigit():
            used.add(int(name[3:]))
    index = 1
    while index in used:
        index += 1
    return f"自定义{index}"

def available_provider_ids(config: dict) -> set[str]:
    ids = set(config.get("providers", {}).keys())
    for item in config.get("custom_providers", []):
        provider_id = str(item.get("id", "")).strip()
        if provider_id:
            ids.add(provider_id)
    return ids

def apply_room_routes(config: dict, routes: dict) -> None:
    if not isinstance(routes, dict):
        return
    valid_ids = available_provider_ids(config)
    for room in ("linxu", "dengdeng"):
        route_id = str(routes.get(room, "")).strip()
        if route_id in valid_ids:
            config["room_routes"][room] = route_id
    config["room_routes"]["living"] = "shared"
    config["room_routes"]["aimas"] = "agent:aimas"

def apply_room_labels(config: dict, labels: dict) -> None:
    if not isinstance(labels, dict):
        return
    for room in SESSION_LABELS:
        value = str(labels.get(room, "")).strip()
        if value:
            config["room_labels"][room] = value[:40]

def merge_config(data: dict) -> dict:
    config = default_config()
    if isinstance(data.get("providers"), dict):
        for provider_id in ("oa", "gg"):
            saved = data["providers"].get(provider_id, {})
            if isinstance(saved, dict):
                config["providers"][provider_id]["model"] = str(saved.get("model", config["providers"][provider_id]["model"])).strip()[:80] or "未设置"
                config["providers"][provider_id]["base_url"] = str(saved.get("base_url", config["providers"][provider_id]["base_url"])).strip()[:200] or config["providers"][provider_id]["base_url"]
                config["providers"][provider_id]["key_alias"] = str(saved.get("key_alias", config["providers"][provider_id].get("key_alias", ""))).strip()[:80]
                config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)

    # Migrate the previous single-provider prototype shape if present.
    if isinstance(data.get("provider"), str) and data.get("provider") in {"openai", "gemini"}:
        provider_id = "oa" if data["provider"] == "openai" else "gg"
        if isinstance(data.get("model"), str) and data["model"].strip():
            config["providers"][provider_id]["model"] = data["model"].strip()[:80]
        if isinstance(data.get("base_url"), str) and data["base_url"].strip():
            config["providers"][provider_id]["base_url"] = data["base_url"].strip()[:200]

    if isinstance(data.get("custom_providers"), list):
        config["custom_providers"] = [
            sanitize_custom_provider(item, f"自定义{index + 1}")
            for index, item in enumerate(data["custom_providers"])
            if isinstance(item, dict)
        ][:20]
        for item in config["custom_providers"]:
            item["key_saved"] = provider_secret_saved(str(item.get("id", "")))

    apply_room_routes(config, data.get("room_routes", {}))
    apply_room_labels(config, data.get("room_labels", {}))
    config["user_profile"] = normalize_user_profile(data.get("user_profile", {}))

    aimas = data.get("agent_connectors", {}).get("aimas", {}) if isinstance(data.get("agent_connectors"), dict) else {}
    if isinstance(aimas.get("endpoint"), str):
        config["agent_connectors"]["aimas"]["endpoint"] = aimas["endpoint"].strip()[:200]
    if isinstance(aimas.get("model"), str):
        config["agent_connectors"]["aimas"]["model"] = aimas["model"].strip()[:80] or "hermes-agent"
    config["self_access"] = normalize_self_access(data.get("self_access", {}))
    config["moments_auto_comments"] = normalize_moments_auto_comments(data.get("moments_auto_comments", {}))
    for provider_id in config.get("providers", {}):
        config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)
    for item in config.get("custom_providers", []):
        item["key_saved"] = provider_secret_saved(str(item.get("id", "")))
    config["api_mode"] = "live_if_configured"
    config["allow_network"] = True
    config["key_storage"] = "not_configured"
    config["key_saved"] = any(provider_secret_saved(provider_id) for provider_id in available_provider_ids(config))
    config["agent_connectors"]["aimas"]["key_saved"] = aimas_secret_saved()
    config["agent_connectors"]["aimas"]["allow_network"] = False
    return config

def read_config() -> dict:
    data = read_config_file()
    return merge_config(data) if data else default_config()

def write_config(data: dict) -> dict:
    config = read_config()
    if data.get("create_custom_provider"):
        if isinstance(data.get("custom_providers"), list):
            config["custom_providers"] = [
                sanitize_custom_provider(item, f"自定义{index + 1}")
                for index, item in enumerate(data["custom_providers"])
                if isinstance(item, dict)
            ][:20]
        name = next_custom_name(config["custom_providers"])
        config["custom_providers"].append(
            sanitize_custom_provider(
                {"id": f"custom-{datetime.now().strftime('%Y%m%d%H%M%S%f')}", "name": name},
                name,
            )
        )
    elif isinstance(data.get("custom_providers"), list):
        config["custom_providers"] = [
            sanitize_custom_provider(item, f"自定义{index + 1}")
            for index, item in enumerate(data["custom_providers"])
            if isinstance(item, dict)
        ][:20]

    if isinstance(data.get("providers"), dict):
        for provider_id in ("oa", "gg"):
            incoming = data["providers"].get(provider_id, {})
            if isinstance(incoming, dict):
                for key in ("model", "base_url", "key_alias"):
                    value = str(incoming.get(key, config["providers"][provider_id][key])).strip()
                    config["providers"][provider_id][key] = value[:200] if key == "base_url" else value[:80]
                config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)

    apply_room_routes(config, data.get("room_routes", {}))
    apply_room_labels(config, data.get("room_labels", {}))
    if "self_access" in data:
        config["self_access"] = normalize_self_access(data.get("self_access", {}))
    if "moments_auto_comments" in data:
        config["moments_auto_comments"] = normalize_moments_auto_comments(data.get("moments_auto_comments", {}))
    if "user_profile" in data:
        config["user_profile"] = normalize_user_profile(data.get("user_profile", {}))

    aimas_endpoint = str(data.get("aimas_endpoint", config["agent_connectors"]["aimas"]["endpoint"])).strip()
    aimas_model = str(data.get("aimas_model", config["agent_connectors"]["aimas"].get("model", "hermes-agent"))).strip()
    config["agent_connectors"]["aimas"]["endpoint"] = aimas_endpoint[:200]
    config["agent_connectors"]["aimas"]["model"] = aimas_model[:80] or "hermes-agent"
    key_saved = update_aimas_secret(
        str(data.get("aimas_api_key", "")).strip(),
        clear=bool(data.get("clear_aimas_api_key")),
    ) if ("aimas_api_key" in data or data.get("clear_aimas_api_key")) else aimas_secret_saved()
    selected_provider_id = str(data.get("selected_provider_id", "")).strip()
    if selected_provider_id in available_provider_ids(config):
        provider_key_saved = update_provider_secret(
            selected_provider_id,
            str(data.get("provider_api_key", "")).strip(),
            clear=bool(data.get("clear_provider_api_key")),
        ) if ("provider_api_key" in data or data.get("clear_provider_api_key")) else provider_secret_saved(selected_provider_id)
        if selected_provider_id in config.get("providers", {}):
            config["providers"][selected_provider_id]["key_saved"] = provider_key_saved
        for item in config.get("custom_providers", []):
            if item.get("id") == selected_provider_id:
                item["key_saved"] = provider_key_saved

    for provider_id in config.get("providers", {}):
        config["providers"][provider_id]["key_saved"] = provider_secret_saved(provider_id)
    for item in config.get("custom_providers", []):
        item["key_saved"] = provider_secret_saved(str(item.get("id", "")))

    config["api_mode"] = "live_if_configured"
    config["allow_network"] = True
    config["key_storage"] = "not_configured"
    config["key_saved"] = any(provider_secret_saved(provider_id) for provider_id in available_provider_ids(config))
    config["agent_connectors"]["aimas"]["status"] = "planned"
    config["agent_connectors"]["aimas"]["key_saved"] = key_saved
    config["agent_connectors"]["aimas"]["allow_network"] = False
    config["updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    write_config_file(config)
    return {
        "ok": True,
        "config": config,
        "relative_path": config_relative_path(),
    }

def route_for_room(room: str, config: dict) -> dict:
    route_id = config.get("room_routes", {}).get(room, "shared")
    if route_id in config.get("providers", {}):
        return {
            "route_id": route_id,
            "type": "provider",
            "provider": config["providers"][route_id],
        }
    for item in config.get("custom_providers", []):
        if route_id == item.get("id"):
            return {
                "route_id": route_id,
                "type": "custom_provider",
                "provider": item,
            }
    if route_id == "agent:aimas":
        return {
            "route_id": route_id,
            "type": "agent",
            "agent": config.get("agent_connectors", {}).get("aimas", {}),
        }
    return {"route_id": route_id, "type": "shared"}
