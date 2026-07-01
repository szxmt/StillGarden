from __future__ import annotations

import re
from urllib.parse import urlparse

def extract_chat_completion_text(payload: dict) -> str:
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            return "\n".join(parts)
    if isinstance(first.get("text"), str):
        return first["text"]
    return ""

def provider_chat_url(provider: dict) -> str:
    base_url = str(provider.get("base_url", "")).strip().rstrip("/")
    if not base_url:
        raise ValueError("Provider Base URL 还没有填写。")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Provider Base URL 需要是 http:// 或 https:// 开头的地址。")
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"

def openai_chat_messages(system_prompt: str, recent: list[dict], text: str) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    if recent:
        messages.append(
            {
                "role": "system",
                "content": "下面是同一房间最近聊天记录，只作为短期上下文，不是永久记忆：",
            }
        )
    for item in recent:
        messages.append({"role": item["role"], "content": item["text"]})
    messages.append({"role": "user", "content": text})
    return messages
