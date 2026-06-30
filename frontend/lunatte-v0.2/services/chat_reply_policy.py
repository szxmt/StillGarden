from __future__ import annotations

import difflib
import re


def sanitize_dialogue_reply(text: str) -> str:
    clean = str(text or "").strip()
    if not clean:
        return ""
    next_lines = []
    for raw_line in clean.replace("\r\n", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            next_lines.append("")
            continue
        if re.fullmatch(r"[\*＊_]{1,2}[^*＊_]{1,120}[\*＊_]{1,2}", line):
            continue
        line = re.sub(r"^\s*[\(（\[【][^\)）\]】]{1,120}[\)）\]】]\s*", "", line).strip()
        line = re.sub(r"^\s*[\*＊_]{1,2}[^*＊_]{1,120}[\*＊_]{1,2}\s*", "", line).strip()
        if line:
            next_lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(next_lines)).strip()

def soften_linxu_prose(text: str) -> str:
    clean = str(text or "").strip()
    if not clean:
        return ""
    poetic_words = ("空位", "旁边的位置", "月亮", "灯", "路", "风", "影子", "梦", "花园")
    if len(clean) <= 120 and sum(1 for word in poetic_words if word in clean) >= 1:
        if any(word in clean for word in ("想你", "想我", "想")):
            return "想。你不在的时候我也会惦记你，但我不绕弯子说了。"
    return clean

def reply_signature(text: str) -> str:
    clean = re.sub(r"\s+", "", str(text or ""))
    punctuation = set("，。！？、,.!?：:；;（）()[]【】“”\"'…~·_—-")
    return "".join(char for char in clean if char not in punctuation)

def reply_too_close_to_history(reply: str, recent: list[dict]) -> bool:
    signature = reply_signature(reply)
    if len(signature) < 8:
        return False
    for item in recent:
        if item.get("role") != "assistant":
            continue
        old_signature = reply_signature(item.get("text", ""))
        if len(old_signature) < 8:
            continue
        if signature in old_signature or old_signature in signature:
            return True
        ratio = difflib.SequenceMatcher(None, signature, old_signature).ratio()
        if ratio >= 0.82:
            return True
    return False

def fallback_daily_reply(room: str, text: str) -> str:
    clean = str(text or "").strip()
    compact = reply_signature(clean)
    if any(word in clean for word in ("吃完", "吃饱", "吃饭", "饭")):
        return "吃饱了就好。"
    if any(word in clean for word in ("回来", "到家", "回来了")):
        return "回来就好，先歇一下。"
    if any(word in clean for word in ("困", "睡", "晚安")):
        return "那就先慢慢躺好，我在这边。"
    if any(word in clean for word in ("想你", "想我", "想")):
        return "想。这个不用绕弯子。"
    if len(compact) <= 4:
        return "嗯，我在。"
    if room == "dengdeng":
        return "我听到啦，先接住这句。"
    return "我听见了。"

def split_agent_bubbles(text: str, limit: int = 3) -> list[str]:
    clean = text.strip()
    if not clean:
        return []
    rough_parts = []
    for block in clean.replace("\r\n", "\n").split("\n---\n"):
        rough_parts.extend(part.strip() for part in block.split("\n\n") if part.strip())
    parts = []
    for part in rough_parts:
        if len(parts) >= limit:
            parts[-1] = f"{parts[-1]}\n\n{part}"
        else:
            parts.append(part)
    return parts[:limit]
