from __future__ import annotations

from services.assets_service import clear_profile_assets, get_profile_assets, save_profile_asset


def profile_assets_get(params: dict[str, list[str]]) -> tuple[dict, int]:
    try:
        return get_profile_assets(), 200
    except Exception as exc:
        return {"ok": False, "message": f"读取头像资产失败：{exc}", "assets": {}}, 500


GET_ROUTES = {"/api/profile-assets": profile_assets_get}

POST_ROUTES = {
    "/api/profile-asset": save_profile_asset,
    "/api/profile-assets-clear": clear_profile_assets,
}

