from __future__ import annotations


from server_config import find_vault_root, profile_assets_path
from server_storage import clear_profile_assets, flatten_profile_assets, read_profile_assets, save_profile_asset


def get_profile_assets() -> dict:
    manifest = read_profile_assets()
    return {
        "ok": True,
        "assets": flatten_profile_assets(manifest),
        "relative_path": str(profile_assets_path().relative_to(find_vault_root())),
    }


__all__ = ["get_profile_assets", "save_profile_asset", "clear_profile_assets"]
