from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from memory_route import make_route, resolve_target


DEFAULT_LIMIT = 8


def find_base() -> Path:
    return Path(__file__).resolve().parents[1]


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_activity_summaries(base: Path) -> dict[int, dict]:
    summaries = {}
    path = base / "gemini" / "parsed" / "activity_summaries.jsonl"
    for row in read_jsonl(path):
        try:
            summaries[int(row["activity_index"])] = row
        except Exception:
            continue
    return summaries


def tokenize(query: str) -> list[str]:
    raw = re.findall(r"[A-Za-z0-9_\-]+|[\u4e00-\u9fff]{1,4}", query.lower())
    stop = {"我", "你", "她", "他", "的", "了", "和", "想", "聊", "一下", "什么", "怎么"}
    return [token for token in raw if token not in stop and token.strip()]


def phase_filter(query: str) -> str | None:
    if "四月后" in query or "4月后" in query or "after april" in query.lower():
        return "gemini-after-2026-04"
    if "四月前" in query or "4月前" in query or "before april" in query.lower():
        return "gemini-before-2026-04"
    return None


def flatten(value: object) -> str:
    if isinstance(value, dict):
        return " ".join(f"{k} {flatten(v)}" for k, v in value.items())
    if isinstance(value, list):
        return " ".join(flatten(v) for v in value)
    if value is None:
        return ""
    return str(value)


def is_sensitive(row: dict) -> bool:
    flags = row.get("flags")
    if isinstance(flags, list) and flags:
        return True
    if row.get("sensitive") is True:
        return True
    return False


def row_sensitive_with_summary(row: dict, summaries: dict[int, dict]) -> bool:
    if is_sensitive(row):
        return True
    activity_index = row.get("activity_index")
    if activity_index is None:
        return False
    try:
        summary = summaries.get(int(activity_index))
    except Exception:
        summary = None
    return bool(summary and summary.get("flags"))


def score_row(row: dict, terms: list[str], phase: str | None = None) -> int:
    haystack = flatten(
        {
            "title": row.get("title"),
            "categories": row.get("categories"),
            "category_hits": row.get("category_hits"),
            "nodes": row.get("nodes"),
            "node_hits": row.get("node_hits"),
            "filename": row.get("filename"),
            "tags": row.get("tags"),
            "sections": row.get("sections"),
            "yaml_keys": row.get("yaml_keys"),
            "summary": row.get("summary"),
            "preview": row.get("local_preview") or row.get("local_previews") or row.get("local_notes"),
        }
    ).lower()
    score = 0
    for term in terms:
        score += haystack.count(term.lower()) * 4
    for field in ["title", "filename"]:
        text = str(row.get(field) or "").lower()
        for term in terms:
            if term.lower() in text:
                score += 8
    if score > 0 and row.get("source") in {"gpt", "gemini"}:
        score += 1
    if phase and row.get("phase") == phase:
        score += 20
    return score


def candidate_sources(base: Path, target: str) -> list[tuple[str, Path]]:
    if target == "alice":
        return [
            ("confirmed_memory", base / "sessions" / "prototype" / "confirmed-memory.jsonl"),
            ("gpt_daily", base / "gpt" / "parsed" / "daily_companionship_index.jsonl"),
            ("gpt_relationship", base / "gpt" / "parsed" / "relationship_node_index.jsonl"),
            ("gpt_conversation", base / "gpt" / "parsed" / "conversation_index.jsonl"),
            ("incoming_chat", base / "self" / "reports" / "incoming_chat_index.jsonl"),
            ("persona_evidence", base / "gpt" / "parsed" / "persona_evidence_extracts.jsonl"),
        ]
    if target == "dengdeng":
        return [
            ("confirmed_memory", base / "sessions" / "prototype" / "confirmed-memory.jsonl"),
            ("gemini_daily", base / "gemini" / "parsed" / "daily_companionship_index.jsonl"),
            ("gemini_relationship", base / "gemini" / "parsed" / "relationship_node_index.jsonl"),
            ("gemini_phase", base / "gemini" / "parsed" / "phase_index.jsonl"),
            ("incoming_chat", base / "self" / "reports" / "incoming_chat_index.jsonl"),
        ]
    if target == "aimas":
        return [
            ("confirmed_memory", base / "sessions" / "prototype" / "confirmed-memory.jsonl"),
        ]
    return [
        ("confirmed_memory", base / "sessions" / "prototype" / "confirmed-memory.jsonl"),
        ("incoming_chat", base / "self" / "reports" / "incoming_chat_index.jsonl"),
    ]


def source_allowed(row: dict, target: str, source_name: str) -> bool:
    if source_name == "confirmed_memory":
        room = row.get("room")
        source = row.get("source")
        if target == "alice":
            return room == "linxu" or source == "gpt"
        if target == "dengdeng":
            return room == "dengdeng" or source == "gemini"
        if target == "aimas":
            return room == "aimas" or source == "aimas"
        return room == "living" or source == "shared"
    if source_name == "incoming_chat":
        if target == "alice":
            return row.get("source") == "gpt"
        if target == "dengdeng":
            return row.get("source") == "gemini"
        return False
    return True


def display_row(source_name: str, row: dict, score: int, summaries: dict[int, dict] | None = None) -> dict:
    summaries = summaries or {}
    activity_index = row.get("activity_index")
    summary = None
    if activity_index is not None:
        try:
            summary = summaries.get(int(activity_index))
        except Exception:
            summary = None
    title = row.get("title") or row.get("filename") or ""
    date = row.get("create_time") or row.get("first_message_time") or row.get("datetime") or row.get("effective_date") or row.get("timestamp") or ""
    if summary:
        title = title if title and title != "Gemini Apps" else summary.get("summary") or title
        date = date or summary.get("timestamp") or summary.get("effective_date") or ""
    row_summary = row.get("summary") or row.get("local_preview") or ""
    flags = row.get("flags") or (["sensitive"] if row.get("sensitive") else [])
    if summary and summary.get("flags"):
        existing = flags if isinstance(flags, list) else [str(flags)]
        flags = sorted(set(existing + list(summary.get("flags") or [])))
    return {
        "score": score,
        "source_index": source_name,
        "source": row.get("source") or source_name,
        "title": title,
        "date": date,
        "categories": row.get("categories") or row.get("nodes") or row.get("tags") or [],
        "flags": flags,
        "reference": row.get("conversation_id") or row.get("activity_index") or row.get("filename") or "",
        "summary": summary.get("summary") if summary else row_summary,
        "phase": row.get("phase") or (summary.get("phase") if summary else ""),
    }


def date_day(value: str) -> str:
    if not value:
        return ""
    match = re.search(r"\d{4}-\d{2}-\d{2}", value)
    return match.group(0) if match else ""


def normalize_title(value: str) -> str:
    text = (value or "").lower()
    text = re.sub(r"\.[a-z0-9]+$", "", text)
    text = re.sub(r"^(chatgpt|gemini)[_\-\s]*\d{8,14}[_\-\s]*", "", text)
    text = re.sub(r"[\s_\-，。！？、,.!?：:；;（）()\[\]【】\"'“”‘’]+", "", text)
    return text[:120]


def duplicate_key(item: dict) -> tuple[str, str, str, str]:
    title_key = normalize_title(str(item.get("title") or item.get("reference") or ""))
    day = date_day(str(item.get("date") or ""))
    source = str(item.get("source") or "")
    phase = str(item.get("phase") or "")
    if not title_key:
        title_key = normalize_title(str(item.get("reference") or ""))
    return (source, phase, day, title_key)


def collapse_duplicates(items: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str, str], dict] = {}
    ordered_keys = []
    for item in items:
        key = duplicate_key(item)
        if not key[-1]:
            key = (
                str(item.get("source") or ""),
                str(item.get("source_index") or ""),
                str(item.get("date") or ""),
                str(item.get("reference") or ""),
            )
        if key not in grouped:
            clone = dict(item)
            clone["duplicate_count"] = 0
            clone["duplicate_sources"] = []
            clone["duplicate_references"] = []
            grouped[key] = clone
            ordered_keys.append(key)
            continue

        grouped_item = grouped[key]
        grouped_item["duplicate_count"] = int(grouped_item.get("duplicate_count") or 0) + 1
        source_label = item.get("source_index") or item.get("source") or ""
        reference = item.get("reference") or ""
        if source_label:
            grouped_item["duplicate_sources"].append(source_label)
        if reference:
            grouped_item["duplicate_references"].append(reference)

    collapsed = [grouped[key] for key in ordered_keys]
    for item in collapsed:
        item["duplicate_sources"] = sorted(set(item.get("duplicate_sources") or []))
        item["duplicate_references"] = list(dict.fromkeys(item.get("duplicate_references") or []))[:8]
    return collapsed


def search(base: Path, target_input: str, query: str, limit: int, include_sensitive: bool, allow_self: bool) -> dict:
    target = resolve_target(target_input)
    terms = tokenize(query)
    phase = phase_filter(query)
    if not terms:
        terms = [query.lower()]
    scored = []
    summaries = load_activity_summaries(base) if target == "dengdeng" else {}
    for source_name, path in candidate_sources(base, target):
        for row in read_jsonl(path):
            if not source_allowed(row, target, source_name):
                continue
            if row_sensitive_with_summary(row, summaries) and not include_sensitive:
                continue
            if phase and row.get("phase") and row.get("phase") != phase:
                continue
            score = score_row(row, terms, phase)
            if score > 0:
                scored.append(display_row(source_name, row, score, summaries))
    scored.sort(key=lambda item: (item["score"], item["date"]), reverse=True)
    raw_match_count = len(scored)
    collapsed = collapse_duplicates(scored)
    route = make_route(base, target, allow_self)
    return {
        "target": target,
        "display": route["display"],
        "query": query,
        "terms": terms,
        "phase_filter": phase,
        "include_sensitive": include_sensitive,
        "route": route,
        "raw_match_count": raw_match_count,
        "collapsed_match_count": len(collapsed),
        "results": collapsed[:limit],
    }


def write_markdown(result: dict) -> str:
    lines = [
        f"# 关键词记忆检索：{result['display']}",
        "",
        f"- 查询：`{result['query']}`",
        f"- 关键词：`{', '.join(result['terms'])}`",
        f"- 时间相位：`{result.get('phase_filter') or '无'}`",
        f"- 包含敏感标记：{'是' if result['include_sensitive'] else '否'}",
        f"- 原始命中：{result.get('raw_match_count', len(result['results']))}",
        f"- 折叠后：{result.get('collapsed_match_count', len(result['results']))}",
        "",
        "## 命中结果",
        "",
    ]
    if not result["results"]:
        lines.append("- 未命中。")
    for item in result["results"]:
        categories = item["categories"]
        if isinstance(categories, list):
            categories_text = ", ".join(str(x) for x in categories)
        else:
            categories_text = str(categories)
        flags = item["flags"]
        flags_text = ", ".join(str(x) for x in flags) if isinstance(flags, list) else str(flags)
        lines.extend(
            [
                f"### {item['title'] or item['reference']}",
                "",
                f"- 分数：{item['score']}",
                f"- 索引：`{item['source_index']}`",
        f"- 日期：{item['date']}",
                f"- 相位：{item.get('phase') or '无'}",
                f"- 类别：{categories_text}",
                f"- 标记：{flags_text or '无'}",
                f"- 引用：`{item['reference']}`",
                f"- 已折叠相似来源：{item.get('duplicate_count') or 0}",
                "",
            ]
        )

    lines.extend(
        [
            "## 路线提醒",
            "",
            f"- 对象：{result['display']}",
            "- 详细读取路线请先运行 `tools/memory_route.py`。",
            "- 检索结果只来自索引，不代表已经读取完整原文。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Search memory-vault indexes for a conversation target.")
    parser.add_argument("target", help="alice, 林絮, gpt, gemini, 噔噔, shared")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--include-sensitive", action="store_true")
    parser.add_argument("--allow-self", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    base = find_base()
    result = search(base, args.target, args.query, args.limit, args.include_sensitive, args.allow_self)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(write_markdown(result))


if __name__ == "__main__":
    main()
