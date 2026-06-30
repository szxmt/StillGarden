from __future__ import annotations

from server_config import DEFAULT_CONFIG
from services.config_policy import normalize_user_profile


def moment_author_label(author: str) -> str:
    from services.config_service import read_config

    user_label = DEFAULT_CONFIG["user_profile"]["nickname"]
    try:
        user_label = normalize_user_profile(read_config().get("user_profile", {}))["nickname"]
    except Exception:
        user_label = DEFAULT_CONFIG["user_profile"]["nickname"]
    labels = {
        "me": user_label,
        "linxu": "林絮",
        "dengdeng": "噔噔",
        "aimas": "Aimas",
        "living": "客厅",
    }
    return labels.get(author, "你")


def moment_event_author_label(event: dict) -> str:
    author = str(event.get("author", "me"))
    if author == "me":
        return moment_author_label("me")
    return event.get("author_label") or moment_author_label(author)

