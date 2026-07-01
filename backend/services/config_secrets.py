from __future__ import annotations

from repositories.config_repository import read_secret_store, write_secret_store


def provider_secret_key(provider_id: str) -> str:
    return str(provider_id or "").strip()[:80]


def update_provider_secret(provider_id: str, api_key: str | None = None, clear: bool = False) -> bool:
    clean_id = provider_secret_key(provider_id)
    if not clean_id:
        return False
    secrets = read_secret_store()
    providers = secrets.get("providers")
    if not isinstance(providers, dict):
        providers = {}
    item = providers.get(clean_id)
    if not isinstance(item, dict):
        item = {}
    if clear:
        item.pop("api_key", None)
    elif api_key and api_key.strip():
        item["api_key"] = api_key.strip()
    providers[clean_id] = item
    secrets["providers"] = providers
    write_secret_store(secrets)
    return bool(item.get("api_key"))


def provider_secret_saved(provider_id: str) -> bool:
    clean_id = provider_secret_key(provider_id)
    return bool(read_secret_store().get("providers", {}).get(clean_id, {}).get("api_key"))


def provider_api_key(provider_id: str) -> str:
    clean_id = provider_secret_key(provider_id)
    return str(read_secret_store().get("providers", {}).get(clean_id, {}).get("api_key", ""))


def update_aimas_secret(api_key: str | None = None, clear: bool = False) -> bool:
    secrets = read_secret_store()
    aimas = secrets.get("aimas")
    if not isinstance(aimas, dict):
        aimas = {}
    if clear:
        aimas.pop("api_key", None)
    elif api_key and api_key.strip():
        aimas["api_key"] = api_key.strip()
    secrets["aimas"] = aimas
    write_secret_store(secrets)
    return bool(aimas.get("api_key"))


def aimas_secret_saved() -> bool:
    return bool(read_secret_store().get("aimas", {}).get("api_key"))


def aimas_api_key() -> str:
    return str(read_secret_store().get("aimas", {}).get("api_key", ""))

