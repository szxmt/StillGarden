from __future__ import annotations

from urllib.parse import quote, urlparse

def extract_gemini_text(payload: dict) -> str:
    candidates = payload.get("candidates") if isinstance(payload, dict) else None
    if not isinstance(candidates, list) or not candidates:
        return ""
    content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        return ""
    text_parts = [str(part.get("text", "")) for part in parts if isinstance(part, dict) and part.get("text")]
    return "\n".join(text_parts).strip()

def gemini_generate_url(provider: dict) -> str:
    base_url = str(provider.get("base_url", "")).strip().rstrip("/")
    model = str(provider.get("model", "")).strip()
    if not base_url:
        raise ValueError("Gemini Base URL 还没有填写。")
    if not model or model == "未设置":
        raise ValueError("Gemini Model 还没有填写。")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Gemini Base URL 需要是 http:// 或 https:// 开头的地址。")
    if base_url.endswith(":generateContent"):
        return base_url
    clean_model = model.split("/")[-1]
    return f"{base_url}/models/{quote(clean_model, safe='')}:generateContent"

def gemini_chat_contents(recent: list[dict], text: str) -> list[dict]:
    contents = []
    for item in recent:
        role = "model" if item["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": item["text"]}]})
    contents.append({"role": "user", "parts": [{"text": text}]})
    return contents
