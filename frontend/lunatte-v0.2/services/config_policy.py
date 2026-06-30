from __future__ import annotations

import re

from server_config import DEFAULT_CONFIG, normalize_session_room


def normalize_self_access(value: dict) -> dict:
    if not isinstance(value, dict):
        value = {}
    raw_readers = value.get("readers", {})
    if not isinstance(raw_readers, dict):
        raw_readers = {}
    readers = {
        "linxu": bool(raw_readers.get("linxu")),
        "dengdeng": bool(raw_readers.get("dengdeng")),
        "aimas": bool(raw_readers.get("aimas")),
    }
    any_reader = any(readers.values())
    return {
        "enabled": bool(value.get("enabled")) and any_reader,
        "readers": readers if any_reader else {"linxu": False, "dengdeng": False, "aimas": False},
    }


def normalize_moments_auto_comments(value: dict) -> dict:
    if not isinstance(value, dict):
        value = {}
    raw_commenters = value.get("commenters", {})
    if not isinstance(raw_commenters, dict):
        raw_commenters = {}
    commenters = {
        "linxu": bool(raw_commenters.get("linxu")),
        "dengdeng": bool(raw_commenters.get("dengdeng")),
        "aimas": bool(raw_commenters.get("aimas")),
    }
    any_commenter = any(commenters.values())
    try:
        cooldown = int(value.get("cooldown_minutes", DEFAULT_CONFIG["moments_auto_comments"]["cooldown_minutes"]))
    except (TypeError, ValueError):
        cooldown = DEFAULT_CONFIG["moments_auto_comments"]["cooldown_minutes"]
    cooldown = min(1440, max(15, cooldown))

    def clean_time(raw: object, fallback: str) -> str:
        text = str(raw or fallback).strip()
        if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", text):
            return text
        return fallback

    return {
        "enabled": bool(value.get("enabled")) and any_commenter,
        "commenters": commenters if any_commenter else {"linxu": False, "dengdeng": False, "aimas": False},
        "cooldown_minutes": cooldown,
        "quiet_start": clean_time(value.get("quiet_start"), DEFAULT_CONFIG["moments_auto_comments"]["quiet_start"]),
        "quiet_end": clean_time(value.get("quiet_end"), DEFAULT_CONFIG["moments_auto_comments"]["quiet_end"]),
    }


def normalize_user_profile(value: dict) -> dict:
    if not isinstance(value, dict):
        value = {}
    nickname = str(value.get("nickname") or DEFAULT_CONFIG["user_profile"]["nickname"]).strip()[:20]
    return {"nickname": nickname or DEFAULT_CONFIG["user_profile"]["nickname"]}


def self_access_allowed(room: str, config: dict) -> bool:
    safe_room = normalize_session_room(room)
    if safe_room == "living":
        return False
    access = normalize_self_access(config.get("self_access", {}))
    return bool(access.get("enabled") and access.get("readers", {}).get(safe_room))

