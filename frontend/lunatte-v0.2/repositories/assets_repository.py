from __future__ import annotations

from server_config import find_vault_root, profile_assets_path
from server_storage import (
    clear_profile_assets,
    flatten_profile_assets,
    read_profile_assets,
    save_profile_asset,
    write_prototype_image_asset,
)


def get_profile_assets_manifest() -> dict:
    return read_profile_assets()


def get_flat_profile_assets() -> dict:
    return flatten_profile_assets(read_profile_assets())


def profile_assets_relative_path() -> str:
    return str(profile_assets_path().relative_to(find_vault_root()))


def save_profile_asset_record(data: dict) -> dict:
    return save_profile_asset(data)


def clear_profile_asset_records(data: dict) -> dict:
    return clear_profile_assets(data)


def save_prototype_image_asset(folder_name: str, prefix: str, data_url: str, max_bytes: int = 8_000_000) -> dict:
    return write_prototype_image_asset(folder_name, prefix, data_url, max_bytes=max_bytes)

