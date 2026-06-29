from __future__ import annotations

import argparse
import json
from pathlib import Path

from memory_search import search


def base_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def read_text(base: Path, relative: str, max_chars: int = 1200) -> str:
    path = base / relative
    if not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8", errors="ignore")
    # Keep API drafts compact and avoid breaking the outer Markdown fence.
    text = text.replace("```", "'''")
    return text[:max_chars]


def extract_compact_markdown(text: str, max_chars: int = 1200) -> str:
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#") or line.startswith("- ") or line.startswith("用途：") or line.startswith("状态："):
            lines.append(line)
        if len("\n".join(lines)) >= max_chars:
            break
    compact = "\n".join(lines)
    return compact[:max_chars] if compact else text[:max_chars]


def compact_file_context(base: Path, read_files: list[dict]) -> list[dict]:
    contexts = []
    for item in read_files:
        relative = item["path"]
        if not item.get("exists"):
            continue
        if relative.endswith(".md"):
            text = read_text(base, relative, max_chars=2500)
            contexts.append(
                {
                    "path": relative,
                    "content": extract_compact_markdown(text),
                }
            )
    return contexts


def build_context(target: str, query: str, limit: int, include_sensitive: bool, allow_self: bool) -> dict:
    base = base_dir()
    result = search(base, target, query, limit, include_sensitive, allow_self)
    route = result["route"]
    file_context = compact_file_context(base, route["read_files"])
    return {
        "target": result["display"],
        "query": query,
        "include_sensitive": include_sensitive,
        "allow_self": allow_self,
        "memory_prompt": route["memory_prompt"],
        "file_context": file_context,
        "memory_hits": result["results"],
        "forbidden": route["forbidden"],
        "self_files": route["self_files"],
    }


def write_markdown(context: dict) -> str:
    lines = [
        f"# API 上下文草稿：{context['target']}",
        "",
        f"- 当前话题：`{context['query']}`",
        f"- 包含敏感标记：{'是' if context['include_sensitive'] else '否'}",
        f"- 读取 self：{'是' if context['allow_self'] else '否'}",
        "",
        "## 记忆调用提示",
        "",
        "```text",
        context["memory_prompt"],
        "```",
        "",
        "## 基础文件上下文",
        "",
    ]
    for item in context["file_context"]:
        lines.extend(
            [
                f"### {item['path']}",
                "",
                "```text",
                item["content"],
                "```",
                "",
            ]
        )

    lines.extend(["## 相关记忆候选", ""])
    if not context["memory_hits"]:
        lines.append("- 未命中。")
    for index, item in enumerate(context["memory_hits"], start=1):
        categories = item.get("categories") or []
        if isinstance(categories, list):
            categories_text = ", ".join(str(x) for x in categories)
        else:
            categories_text = str(categories)
        flags = item.get("flags") or []
        flags_text = ", ".join(str(x) for x in flags) if isinstance(flags, list) else str(flags)
        lines.extend(
            [
                f"### {index}. {item.get('title') or item.get('reference')}",
                "",
                f"- 来源索引：`{item.get('source_index')}`",
                f"- 日期：{item.get('date') or 'unknown'}",
                f"- 相位：{item.get('phase') or '无'}",
                f"- 类别：{categories_text or '无'}",
                f"- 标记：{flags_text or '无'}",
                f"- 引用：`{item.get('reference')}`",
                "",
            ]
        )

    lines.extend(["## 禁止读取", ""])
    for item in context["forbidden"]:
        lines.append(f"- `{item}`")

    lines.extend(
        [
            "",
            "## 使用提醒",
            "",
            "- 这只是上下文草稿，不会自动调用 API。",
            "- 如果要实际发送给模型，仍需要人工确认。",
            "- 不要把禁止读取区域补进上下文。",
            "- 敏感内容默认不进入上下文。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a draft API context from route + memory search.")
    parser.add_argument("target", help="alice, 林絮, gpt, gemini, 噔噔, shared")
    parser.add_argument("query", help="Current topic/query")
    parser.add_argument("--limit", type=int, default=6)
    parser.add_argument("--include-sensitive", action="store_true")
    parser.add_argument("--allow-self", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    context = build_context(args.target, args.query, args.limit, args.include_sensitive, args.allow_self)
    if args.json:
        print(json.dumps(context, ensure_ascii=False, indent=2))
    else:
        print(write_markdown(context))


if __name__ == "__main__":
    main()
