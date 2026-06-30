from __future__ import annotations


from repositories.assets_repository import (
    clear_profile_asset_records,
    get_flat_profile_assets,
    get_profile_assets_manifest,
    profile_assets_relative_path,
    save_profile_asset_record,
)


def get_profile_assets() -> dict:
    manifest = get_profile_assets_manifest()
    return {
        "ok": True,
        "assets": get_flat_profile_assets(),
        "relative_path": profile_assets_relative_path(),
    }


save_profile_asset = save_profile_asset_record
clear_profile_assets = clear_profile_asset_records

__all__ = ["get_profile_assets", "save_profile_asset", "clear_profile_assets"]
