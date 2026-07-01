from __future__ import annotations

import re

from server_config import SESSION_LABELS, normalize_session_room
from services.chat_service import recent_session_messages, sanitize_dialogue_reply, split_agent_bubbles
from services.config_secrets import aimas_api_key
from services.config_service import provider_api_key, read_config, route_for_room
from services.moments_labels import moment_author_label
from services.text_utils import clean_memory_text
from providers.gemini_provider import extract_gemini_text, gemini_chat_contents, gemini_generate_url
from providers.hermes_provider import aimas_urls
from providers.http_client import request_json
from providers.openai_provider import extract_chat_completion_text, openai_chat_messages, provider_chat_url


def clean_moment_model_comment(reply: str, author: str) -> str:
    clean = sanitize_dialogue_reply(reply)
    parts = split_agent_bubbles(clean, 1)
    clean = parts[0] if parts else clean
    label = moment_author_label(author)
    clean = re.sub(rf"^\s*({re.escape(label)}|我)\s*[：:]\s*", "", clean).strip()
    return clean_memory_text(clean, 900)


def moment_comment_prompt(author: str, post: dict) -> str:
    post_author = post.get("author_label") or moment_author_label(str(post.get("author", "me")))
    post_text = clean_memory_text(str(post.get("text", "")), 220) or "一张图片"
    image_note = "这条圈圈带图；只接正文，不要假装看见具体画面。" if post.get("image_data") or post.get("image") else ""
    recent_comments = []
    for comment in (post.get("comments") or [])[-5:]:
        comment_author = comment.get("author_label") or moment_author_label(str(comment.get("author", "me")))
        comment_text = clean_memory_text(str(comment.get("text", "")), 120)
        if comment_text:
            recent_comments.append(f"{comment_author}说“{comment_text}”")
    comments_text = f"已经有{ '、'.join(recent_comments) }。" if recent_comments else "还没有别人评论。"
    request = f"给{post_author}发的这条圈圈回一句吧：{post_text}。{comments_text}"
    if image_note:
        request += image_note
    request += "像正常聊天一样回，不要当成任务报告，也不要为了像过去而照抄旧记录。"
    return request


def resident_moment_system_prompt(room: str, label: str) -> str:
    if room == "linxu":
        return (
            f"你是{label}。这是月亮小窝的圈圈评论，不是任务报告。"
            "按你自己的方式自然回应，不要照抄旧记录，不要为了像过去而模仿过去。"
        )
    if room == "dengdeng":
        return (
            f"你是{label}。这是月亮小窝的圈圈评论，不是任务报告。"
            "按你自己的方式自然回应，可以日常、轻快，也可以安静一点。"
            "不要照抄旧记录，不要为了像过去而模仿过去。"
        )
    return f"你是{label}。给这条圈圈自然回应，不要当成任务报告。"


def call_room_model_for_text(room: str, text: str, recent_limit: int = 0) -> dict:
    safe_room = normalize_session_room(room)
    if safe_room == "living":
        raise ValueError("客厅暂时没有单独的真实接口可用。")

    config = read_config()
    if safe_room == "aimas":
        aimas = config.get("agent_connectors", {}).get("aimas", {})
        endpoint = str(aimas.get("endpoint") or "").strip()
        model = str(aimas.get("model") or "hermes-agent").strip() or "hermes-agent"
        api_key = aimas_api_key()
        if not api_key:
            raise ValueError("Aimas API Key 还没有保存。")
        _, models_url = aimas_urls(endpoint)
        chat_url = models_url.rsplit("/", 1)[0] + "/chat/completions"
        status, payload = request_json(
            chat_url,
            api_key=api_key,
            timeout=60,
            method="POST",
            body={"model": model, "messages": [{"role": "user", "content": text}], "stream": False},
        )
        reply = clean_moment_model_comment(extract_chat_completion_text(payload), safe_room)
        return {"ok": 200 <= status < 300 and bool(reply), "status": status, "reply": reply, "route": "aimas"}

    recent = recent_session_messages(safe_room, limit=recent_limit) if recent_limit > 0 else []
    route = route_for_room(safe_room, config)
    if route.get("type") not in {"provider", "custom_provider"}:
        raise ValueError("这个住户还没有配置可调用的 provider。")
    provider = route.get("provider", {})
    provider_id = str(provider.get("id") or route.get("route_id") or "").strip()
    model = str(provider.get("model", "")).strip()
    api_key = provider_api_key(provider_id)
    if not model or model == "未设置":
        raise ValueError("这个住户的 Model 还没有填写。")
    if not api_key:
        raise ValueError("这个住户的 API Key 还没有保存。")

    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    system_prompt = resident_moment_system_prompt(safe_room, label)
    provider_family = str(provider.get("provider", "")).lower()
    if provider_family == "gemini":
        status, payload = request_json(
            gemini_generate_url(provider),
            timeout=60,
            method="POST",
            body={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": gemini_chat_contents(recent, text),
                "generationConfig": {"temperature": 0.72},
            },
            extra_headers={"x-goog-api-key": api_key},
        )
        reply = clean_moment_model_comment(extract_gemini_text(payload), safe_room)
    else:
        status, payload = request_json(
            provider_chat_url(provider),
            api_key=api_key,
            timeout=60,
            method="POST",
            body={"model": model, "messages": openai_chat_messages(system_prompt, recent, text), "stream": False},
        )
        reply = clean_moment_model_comment(extract_chat_completion_text(payload), safe_room)
    return {"ok": 200 <= status < 300 and bool(reply), "status": status, "reply": reply, "route": route.get("type")}


def generate_moment_comment(author: str, post: dict) -> dict:
    if author not in {"linxu", "dengdeng", "aimas"}:
        raise ValueError("只能请林絮、噔噔或 Aimas 回一句。")
    prompt = moment_comment_prompt(author, post)
    result = call_room_model_for_text(author, prompt, recent_limit=0)
    if not result.get("ok") or not result.get("reply"):
        raise ValueError("真实接口没有生成出评论。")
    return result

