from __future__ import annotations

import csv
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path


ADULT_HINTS = ["涉黄", "色情", "性爱", "性癖", "成人", "nsfw", "18+", "上床"]
PRIVATE_HINTS = ["身份证", "银行卡", "验证码", "密码", "住址", "手机号", "token", "secret"]


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data:
            self.parts.append(data)

    def handle_entityref(self, name: str) -> None:
        self.parts.append(html.unescape(f"&{name};"))

    def handle_charref(self, name: str) -> None:
        self.parts.append(html.unescape(f"&#{name};"))

    def text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()


def base_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def text_from_html(fragment: str) -> str:
    parser = TextExtractor()
    parser.feed(fragment)
    return parser.text()


def extract_datetime(text: str) -> str:
    pattern = re.compile(
        r"([0-9]{4})\u5e74([0-9]{1,2})\u6708([0-9]{1,2})\u65e5\s+([0-9]{1,2}):([0-9]{2}):([0-9]{2})\s+([A-Z]+)"
    )
    match = pattern.search(text)
    if not match:
        time_match = re.search(r"([0-9]{1,2}):([0-9]{2}):([0-9]{2})\s+([A-Z]+)", text)
        if not time_match:
            return ""
        hour, minute, second, zone = time_match.groups()
        return f"{int(hour):02d}:{minute}:{second} {zone}"
    year, month, day, hour, minute, second, zone = match.groups()
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d} {int(hour):02d}:{minute}:{second} {zone}"


def detect_flags(text: str) -> list[str]:
    lowered = text.lower()
    flags = []
    if any(hint.lower() in lowered for hint in ADULT_HINTS):
        flags.append("sensitive-adult")
    if any(hint.lower() in lowered for hint in PRIVATE_HINTS):
        flags.append("sensitive-private")
    return flags


def redact(text: str) -> str:
    text = re.sub(r"\b\d{6,}\b", "[number]", text)
    text = re.sub(r"(?i)(api[_ -]?key|secret|token)\s*[:=]\s*\S+", r"\1=[redacted]", text)
    return text


def clean_summary(text: str, limit: int = 72) -> str:
    # Remove noisy Google activity footer fragments when possible.
    text = re.sub(r"详情\s*Google.*$", "", text)
    text = re.sub(r"为什么会显示这个.*$", "", text)
    text = text.replace("Gemini Apps Prompted", "").strip()
    text = redact(text).strip()
    return text[:limit]


def load_phase_map(base: Path) -> dict[int, dict]:
    path = base / "gemini" / "parsed" / "phase_index.jsonl"
    data: dict[int, dict] = {}
    if not path.exists():
        return data
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            row = json.loads(line)
            data[int(row["activity_index"])] = row
    return data


def parse_cards(base: Path) -> list[dict]:
    html_path = next((base / "gemini" / "raw" / "gemini-apps-text").glob("*.html"))
    raw = html_path.read_text(encoding="utf-8", errors="ignore")
    cards = re.findall(
        r'<div class="outer-cell[^>]*>.*?(?=<div class="outer-cell|</body>|</html>)',
        raw,
        flags=re.S,
    )
    phase_map = load_phase_map(base)
    rows = []
    for index, card in enumerate(cards, start=1):
        text = text_from_html(card)
        phase = phase_map.get(index, {})
        summary = clean_summary(text)
        rows.append(
            {
                "activity_index": index,
                "timestamp": phase.get("timestamp") or extract_datetime(text),
                "effective_date": phase.get("effective_date") or "",
                "phase": phase.get("phase") or "",
                "summary": summary,
                "char_count": len(text),
                "flags": detect_flags(text),
                "has_image": "<img" in card.lower(),
            }
        )
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_csv(path: Path, rows: list[dict]) -> None:
    fields = ["activity_index", "timestamp", "effective_date", "phase", "summary", "char_count", "flags", "has_image"]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            cleaned = dict(row)
            cleaned["flags"] = " | ".join(row["flags"])
            writer.writerow(cleaned)


def write_report(base: Path, rows: list[dict]) -> None:
    after = sum(1 for row in rows if row["phase"] == "gemini-after-2026-04")
    before = sum(1 for row in rows if row["phase"] == "gemini-before-2026-04")
    flagged = sum(1 for row in rows if row["flags"])
    text = f"""# 噔噔活动摘要映射报告

本报告说明 `gemini/parsed/activity_summaries.*` 的生成状态。

## 总览

- 活动卡片：{len(rows)}
- 四月前：{before}
- 四月后：{after}
- 带敏感标记：{flagged}

## 输出文件

```text
gemini/parsed/activity_summaries.jsonl
gemini/parsed/activity_summaries.csv
```

## 用途

- 让关键词检索结果显示短摘要，而不是只有活动编号。
- 仍然不代替原始 HTML。
- 摘要被截断并做了基础脱敏。
- 带敏感标记的记录默认不参与普通检索。
"""
    (base / "gemini" / "activity-summary-report.md").write_text(text, encoding="utf-8")


def main() -> None:
    base = base_dir()
    rows = parse_cards(base)
    write_jsonl(base / "gemini" / "parsed" / "activity_summaries.jsonl", rows)
    write_csv(base / "gemini" / "parsed" / "activity_summaries.csv", rows)
    write_report(base, rows)
    print(json.dumps({"rows": len(rows), "report": str(base / "gemini" / "activity-summary-report.md")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
