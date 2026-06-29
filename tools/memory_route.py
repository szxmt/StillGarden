from __future__ import annotations

import argparse
import json
from pathlib import Path


ALIASES = {
    "alice": "alice",
    "linxu": "alice",
    "lin-xu": "alice",
    "林絮": "alice",
    "gpt": "alice",
    "chatgpt": "alice",
    "噔噔": "dengdeng",
    "dengdeng": "dengdeng",
    "gemini": "dengdeng",
    "aimas": "aimas",
    "hermes": "aimas",
    "shared": "shared",
    "普通": "shared",
    "tool": "shared",
}


ROUTES = {
    "alice": {
        "display": "Alice / 林絮 / GPT",
        "read": [
            "gpt/alice-api-brief-v0.1.md",
            "gpt/alice-core-persona-v0.1.md",
            "gpt/persona.md",
            "shared/api-memory-policy.md",
            "shared/do-not-share.md",
            "access-rules.md",
        ],
        "optional_self": [
            "self/about-me-v0.1.md",
            "self/my-story.md",
            "self/relationship-map.md",
            "self/names-and-identities.md",
        ],
        "forbidden": [
            "gemini/private.md",
            "gemini/persona.md",
            "gemini/boundaries.md",
            "gemini/raw/",
            "gemini/parsed/",
        ],
        "notes": [
            "Use Alice / 林絮 as the identity anchor.",
            "Do not read 噔噔 private memory.",
            "Memory is background, not performance.",
            "Adult/sensitive content is retained but not loaded by default.",
        ],
    },
    "dengdeng": {
        "display": "Gemini / 噔噔",
        "read": [
            "gemini/persona.md",
            "gemini/boundaries.md",
            "gemini/phase-observations.md",
            "shared/api-memory-policy.md",
            "shared/do-not-share.md",
            "access-rules.md",
        ],
        "optional_self": [
            "self/about-me-v0.1.md",
            "self/my-story.md",
            "self/relationship-map.md",
            "self/names-and-identities.md",
        ],
        "forbidden": [
            "gpt/private.md",
            "gpt/alice-core-persona-v0.1.md",
            "gpt/alice-api-brief-v0.1.md",
            "gpt/persona-evidence-digest.md",
            "gpt/raw/",
            "gpt/parsed/",
        ],
        "notes": [
            "Use 噔噔 as the identity anchor.",
            "Prefer gemini-before-2026-04 for core companionship style.",
            "Use gemini-after-2026-04 mainly as boundary/version-change reference.",
            "Do not read Alice / 林絮 private memory.",
        ],
    },
    "shared": {
        "display": "普通 AI / 工具型对话",
        "read": [
            "shared/basic-about-me.md",
            "shared/can-be-known-by-both.md",
            "shared/api-memory-policy.md",
            "shared/do-not-share.md",
            "access-rules.md",
        ],
        "optional_self": [
            "self/about-me-v0.1.md",
        ],
        "forbidden": [
            "gpt/",
            "gemini/",
            "self/my-story.md",
            "self/relationship-map.md",
        ],
        "notes": [
            "Do not load relationship-specific private memory by default.",
            "Use only shared facts unless the user explicitly allows more.",
        ],
    },
    "aimas": {
        "display": "Aimas / Hermes",
        "read": [
            "sessions/prototype/confirmed-memory.jsonl",
            "shared/api-memory-policy.md",
            "shared/do-not-share.md",
            "access-rules.md",
        ],
        "optional_self": [],
        "forbidden": [
            "gpt/",
            "gemini/",
            "self/",
        ],
        "notes": [
            "Aimas only reads its own confirmed memories for now.",
            "Do not load Alice / 林絮 or 噔噔 private memory.",
            "Hermes terminal permissions should stay separate from chat memory.",
        ],
    },
}


def find_base() -> Path:
    current = Path(__file__).resolve()
    return current.parents[1]


def resolve_target(value: str) -> str:
    key = value.strip().lower()
    return ALIASES.get(value.strip()) or ALIASES.get(key) or key


def exists(base: Path, relative: str) -> bool:
    if relative.endswith("/"):
        return (base / relative).exists()
    return (base / relative).is_file()


def make_route(base: Path, target: str, allow_self: bool) -> dict:
    route_key = resolve_target(target)
    if route_key not in ROUTES:
        raise SystemExit(f"Unknown target: {target}")

    route = ROUTES[route_key]
    read = list(route["read"])
    if allow_self:
        read.extend(route["optional_self"])

    return {
        "target": route_key,
        "display": route["display"],
        "read_files": [
            {
                "path": item,
                "exists": exists(base, item),
            }
            for item in read
        ],
        "self_files": [
            {
                "path": item,
                "exists": exists(base, item),
                "included": allow_self,
            }
            for item in route["optional_self"]
        ],
        "forbidden": route["forbidden"],
        "notes": route["notes"],
        "memory_prompt": (
            "以下记忆仅作为背景参考。不要为了证明你记得而主动展示这些记忆。"
            "只有当它们与用户当前表达高度相关时，才自然、轻微地承接。"
            "不要复述记忆清单，不要显摆记忆，不要把旧事硬插进当前情绪。"
        ),
    }


def write_markdown(route: dict) -> str:
    lines = [
        f"# 本次记忆读取路线：{route['display']}",
        "",
        "## 应读取",
        "",
    ]
    for item in route["read_files"]:
        mark = "ok" if item["exists"] else "missing"
        lines.append(f"- `{item['path']}` [{mark}]")

    lines.extend(["", "## self 文件", ""])
    for item in route["self_files"]:
        state = "included" if item["included"] else "需要用户明确允许"
        mark = "ok" if item["exists"] else "missing"
        lines.append(f"- `{item['path']}` [{mark}] - {state}")

    lines.extend(["", "## 禁止读取", ""])
    for item in route["forbidden"]:
        lines.append(f"- `{item}`")

    lines.extend(["", "## 提醒", ""])
    for note in route["notes"]:
        lines.append(f"- {note}")

    lines.extend(["", "## 记忆提示", "", "```text", route["memory_prompt"], "```", ""])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Choose memory-vault files for a conversation target.")
    parser.add_argument("target", help="alice, 林絮, gpt, gemini, 噔噔, shared")
    parser.add_argument("--allow-self", action="store_true", help="Include optional self files.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown.")
    args = parser.parse_args()

    base = find_base()
    route = make_route(base, args.target, args.allow_self)
    if args.json:
        print(json.dumps(route, ensure_ascii=False, indent=2))
    else:
        print(write_markdown(route))


if __name__ == "__main__":
    main()
