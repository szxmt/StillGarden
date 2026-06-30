from __future__ import annotations

import json
import subprocess
import sys

from server_config import ROOM_TARGETS, SESSION_LABELS, find_vault_root
from services.config_service import normalize_self_access, read_config, route_for_room, self_access_allowed
from services.text_utils import clean_memory_text

def build_context(room: str, query: str) -> dict:
    target = ROOM_TARGETS.get(room, "shared")
    metadata_target = {
        "linxu": "alice",
        "dengdeng": "gemini",
        "living": "shared",
        "aimas": "aimas",
    }.get(room, target)
    config = read_config()
    allow_self = self_access_allowed(room, config)
    vault = find_vault_root()
    tool = vault / "tools" / "memory_context.py"
    command = [sys.executable, str(tool), target, query, "--limit", "6"]
    if allow_self:
        command.append("--allow-self")
    completed = subprocess.run(
        command,
        cwd=tool.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return {
            "markdown": "本地记忆工具运行失败：\n\n" + (completed.stderr or completed.stdout or "没有错误详情。")
        }
    search_meta = build_context_search_metadata(vault, metadata_target, query, allow_self)
    return {
        "markdown": completed.stdout,
        "target": search_meta.get("target", target),
        "display": search_meta.get("display", target),
        "query": query,
        "include_sensitive": bool(search_meta.get("include_sensitive", False)),
        "allow_self": allow_self and any(item.get("included") for item in search_meta.get("route", {}).get("self_files", [])),
        "self_access": normalize_self_access(config.get("self_access", {})),
        "route": search_meta.get("route", {}),
        "raw_match_count": search_meta.get("raw_match_count", 0),
        "collapsed_match_count": search_meta.get("collapsed_match_count", 0),
        "results": search_meta.get("results", []),
    }

def build_context_search_metadata(vault: Path, target: str, query: str, allow_self: bool = False) -> dict:
    tool = vault / "tools" / "memory_search.py"
    command = [sys.executable, str(tool), target, query, "--limit", "6", "--json"]
    if allow_self:
        command.append("--allow-self")
    completed = subprocess.run(
        command,
        cwd=tool.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return {
            "target": target,
            "display": target,
            "query": query,
            "results": [],
            "message": completed.stderr or completed.stdout or "搜索元数据读取失败。",
        }
    try:
        return json.loads(completed.stdout or "{}")
    except json.JSONDecodeError:
        return {
            "target": target,
            "display": target,
            "query": query,
            "results": [],
            "message": "搜索元数据不是有效 JSON。",
        }

def context_item_preview(item: dict) -> dict:
    flags = item.get("flags") if isinstance(item.get("flags"), list) else []
    categories = item.get("categories") if isinstance(item.get("categories"), list) else []
    return {
        "source_index": str(item.get("source_index") or ""),
        "source": str(item.get("source") or ""),
        "title": clean_memory_text(str(item.get("title") or item.get("reference") or "未命名片段"), 120),
        "date": str(item.get("date") or ""),
        "phase": str(item.get("phase") or ""),
        "categories": [str(value) for value in categories[:6]],
        "flags": [str(value) for value in flags[:6]],
        "reference": clean_memory_text(str(item.get("reference") or ""), 160),
        "summary": clean_memory_text(str(item.get("summary") or ""), 220),
        "score": item.get("score", 0),
    }

def short_context_preview(entries: list[dict]) -> list[dict]:
    preview = []
    for item in entries[-6:]:
        preview.append(
            {
                "role": item.get("role", ""),
                "timestamp": item.get("timestamp", ""),
                "text": clean_memory_text(str(item.get("text", "")), 180),
            }
        )
    return preview

def build_context_preview(room: str, query: str, context: dict, short_context: list[dict], route: dict) -> dict:
    results = [item for item in context.get("results", []) if isinstance(item, dict)]
    confirmed = [item for item in results if item.get("source_index") == "confirmed_memory"]
    long_candidates = [item for item in results if item.get("source_index") != "confirmed_memory"]
    route_meta = context.get("route", {}) if isinstance(context.get("route"), dict) else {}
    self_files = route_meta.get("self_files") if isinstance(route_meta.get("self_files"), list) else []
    read_files = route_meta.get("read_files") if isinstance(route_meta.get("read_files"), list) else []
    forbidden = route_meta.get("forbidden") if isinstance(route_meta.get("forbidden"), list) else []
    self_access = normalize_self_access(context.get("self_access", {}))
    return {
        "room": room,
        "room_label": SESSION_LABELS.get(room, room),
        "query": clean_memory_text(query, 220),
        "target": context.get("target", ROOM_TARGETS.get(room, "shared")),
        "display": context.get("display", ROOM_TARGETS.get(room, "shared")),
        "route": {"type": route.get("type"), "route_id": route.get("route_id")},
        "short_context": {
            "count": len(short_context),
            "window": 18,
            "items": short_context_preview(short_context),
        },
        "long_term": {
            "used": bool(context.get("markdown")),
            "raw_match_count": context.get("raw_match_count", 0),
            "collapsed_match_count": context.get("collapsed_match_count", 0),
            "candidate_count": len(long_candidates),
            "items": [context_item_preview(item) for item in long_candidates[:6]],
        },
        "confirmed_memory": {
            "candidate_count": len(confirmed),
            "items": [context_item_preview(item) for item in confirmed[:6]],
        },
        "self": {
            "enabled": bool(context.get("allow_self")),
            "master_enabled": bool(self_access.get("enabled")),
            "readers": self_access.get("readers", {}),
            "files": [
                {
                    "path": str(item.get("path", "")),
                    "exists": bool(item.get("exists")),
                    "included": bool(item.get("included")),
                }
                for item in self_files
            ],
        },
        "policy": {
            "include_sensitive": bool(context.get("include_sensitive", False)),
            "read_files": [str(item.get("path", "")) for item in read_files if item.get("exists")],
            "forbidden": [str(value) for value in forbidden],
        },
    }

def build_search(room: str, query: str, include_sensitive: bool = False) -> dict:
    target = ROOM_TARGETS.get(room, "shared")
    vault = find_vault_root()
    tool = vault / "tools" / "memory_search.py"
    command = [sys.executable, str(tool), target, query, "--limit", "6", "--json"]
    if include_sensitive:
        command.append("--include-sensitive")
    completed = subprocess.run(
        command,
        cwd=tool.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return {
            "display": target,
            "query": query,
            "results": [],
            "message": "本地搜索工具运行失败：\n\n" + (completed.stderr or completed.stdout or "没有错误详情。"),
        }
    data = json.loads(completed.stdout)
    return {
        "display": data.get("display", target),
        "query": data.get("query", query),
        "terms": data.get("terms", []),
        "phase_filter": data.get("phase_filter"),
        "include_sensitive": data.get("include_sensitive", include_sensitive),
        "raw_match_count": data.get("raw_match_count"),
        "collapsed_match_count": data.get("collapsed_match_count"),
        "results": data.get("results", []),
        "message": "检索结果只来自索引摘要，不代表已经读取完整原文。",
    }
