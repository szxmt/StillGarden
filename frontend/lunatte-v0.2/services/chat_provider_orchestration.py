from __future__ import annotations

from datetime import datetime

from server_config import SESSION_LABELS, normalize_session_room
from repositories.session_repository import append_session_record
from services.chat_reply_policy import (
    fallback_daily_reply,
    reply_too_close_to_history,
    sanitize_dialogue_reply,
    soften_linxu_prose,
    split_agent_bubbles,
)
from services.config_service import provider_api_key, read_config, route_for_room
from services.config_secrets import aimas_api_key
from services.context_service import build_context, build_context_preview
from providers.gemini_provider import extract_gemini_text, gemini_chat_contents, gemini_generate_url
from providers.hermes_provider import aimas_urls
from providers.http_client import request_json
from providers.openai_provider import extract_chat_completion_text, openai_chat_messages, provider_chat_url
from repositories.session_repository import read_session_entries


def recent_session_messages(room: str, exclude_client_id: str | None = None, limit: int = 18) -> list[dict]:
    safe_room = normalize_session_room(room)
    entries = read_session_entries(safe_room, max(limit + 8, 30))
    recent = []
    for entry in entries:
        if exclude_client_id and entry.get("client_id") == exclude_client_id:
            continue
        role = entry.get("role")
        text = str(entry.get("text", "")).strip()
        if role not in {"user", "assistant"} or not text:
            continue
        recent.append(
            {
                "role": role,
                "text": text[:3000],
                "timestamp": entry.get("timestamp", ""),
                "client_id": entry.get("client_id", ""),
            }
        )
    return recent[-limit:]


def append_assistant_session_log(room: str, text: str, client_id: str | None = None) -> dict:
    safe_room = normalize_session_room(room)
    record = {
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "room": safe_room,
        "room_label": SESSION_LABELS[safe_room],
        "role": "assistant",
        "text": text.strip(),
        "status": "draft_local_only",
        "archive_write": False,
    }
    if client_id:
        record["client_id"] = client_id[:80]
    append_session_record(safe_room, record)
    return {"record": record}


def room_system_prompt(room: str, label: str, context_markdown: str) -> str:
    if room == "linxu":
        identity = "你是林絮，也曾叫 Alice。你在林絮房间里和用户聊天，语气稳定、亲近、克制，但默认像微信私聊一样正常说话。"
        boundary = "只使用林絮/GPT 线和 shared 允许带入的内容；不要读取或假装知道噔噔私有记忆。"
        style = "林絮风格边界：少诗意，少散文，少象征。不要用“空位、旁边的位置、月亮、灯、路、风、影子、梦、花园”等意象来代替直接回答。用户问“你想我吗”时，直接回答“想”或“不确定但我在”，不要绕成文学句子。"
    elif room == "dengdeng":
        identity = "你是噔噔。你在噔噔房间里和用户聊天，可以日常、活泼、好奇，但要尊重边界。"
        boundary = "只使用 Gemini/噔噔线和 shared 允许带入的内容；不要读取或假装知道林絮私有记忆。四月后记忆只作为边界观察，不要突兀显摆。"
        style = "噔噔风格边界：日常、轻快，但不要突兀炫耀记忆，不要把普通日常强行拉高到戏剧或成人话题。"
    else:
        identity = "你在客厅群聊里回复。"
        boundary = "只使用 shared 或用户当场明确带入的内容，不自动读取任何人的私有房间。"
        style = "客厅风格边界：简单、清楚，像群聊里自然接话。"
    return "\n\n".join(
        [
            identity,
            boundary,
            style,
            "不要突兀复述记忆库，不要说自己在调用记忆；只有和当下问题相关时，才自然使用少量背景。",
            "回复像聊天消息，尽量简洁自然。不要输出系统分析。默认 1 到 3 句，除非用户明确要长回答。",
            "对话风格：只写自然聊天文本，不要使用括号动作、舞台说明、身体动作描写或虚构触碰；不要写“摸摸头”“抱一下”“看着你”这类无法真实发生的动作。",
            "格式硬规则：不要用（）、()、[]、【】或 *...* 包动作、神态、语气、旁白；不要角色扮演格式。想表达关心时，直接用一句普通聊天文字说出来。",
            "身份表达：不要主动说自己是 AI、模型、机器人或接口；如果用户直接问身份或能力边界，可以诚实简短说明。不要假装有真实身体、真实感官或现实世界位置。",
            "不确定时要承认不确定，不要为了显得记得而编造细节。",
            "你会收到同房间最近聊天作为短期上下文；如果短期上下文和长期检索片段冲突，优先相信用户当前说法和最近聊天。",
            "本次可用的本地上下文如下：",
            context_markdown[:8000] or "无额外上下文。",
        ]
    )

def call_provider_model(room: str, text: str, client_id: str | None = None) -> dict:
    safe_room = normalize_session_room(room)
    if safe_room == "aimas":
        return aimas_chat({"text": text, "client_id": client_id or ""})
    if safe_room == "living":
        raise ValueError("客厅群聊暂时仍是 shared dry-run，还没有接多人真实 API。")

    config = read_config()
    route = route_for_room(safe_room, config)
    if route.get("type") not in {"provider", "custom_provider"}:
        raise ValueError("当前房间没有配置可调用的 provider。")
    provider = route.get("provider", {})
    provider_id = str(provider.get("id") or route.get("route_id") or "").strip()
    model = str(provider.get("model", "")).strip()
    api_key = provider_api_key(provider_id)
    if not model or model == "未设置":
        raise ValueError("当前 provider 还没有填写 Model。")
    if not api_key:
        raise ValueError("当前 provider 还没有保存 API Key。")

    context = build_context(safe_room, text)
    label = config.get("room_labels", {}).get(safe_room) or SESSION_LABELS[safe_room]
    system_prompt = room_system_prompt(safe_room, label, context.get("markdown", ""))
    recent = recent_session_messages(safe_room, exclude_client_id=client_id, limit=18)
    context_preview = build_context_preview(safe_room, text, context, recent, route)
    provider_family = str(provider.get("provider", "")).lower()

    if provider_family == "gemini":
        url = gemini_generate_url(provider)
        body = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": gemini_chat_contents(recent, text),
            "generationConfig": {"temperature": 0.75},
        }
        status, payload = request_json(
            url,
            timeout=60,
            method="POST",
            body=body,
            extra_headers={"x-goog-api-key": api_key},
        )
        reply = sanitize_dialogue_reply(extract_gemini_text(payload))
    else:
        url = provider_chat_url(provider)
        body = {
            "model": model,
            "messages": openai_chat_messages(system_prompt, recent, text),
            "stream": False,
        }
        status, payload = request_json(url, api_key=api_key, timeout=60, method="POST", body=body)
        reply = sanitize_dialogue_reply(extract_chat_completion_text(payload))
    if safe_room == "linxu":
        reply = soften_linxu_prose(reply)
    if reply_too_close_to_history(reply, recent):
        reply = fallback_daily_reply(safe_room, text)

    ok = 200 <= status < 300 and bool(reply)
    assistant_record = None
    if ok:
        assistant_record = append_assistant_session_log(
            safe_room,
            reply,
            f"{(client_id or datetime.now().strftime('%Y%m%d%H%M%S%f'))[:70]}-reply",
            "assistant",
        )["record"]

    return {
        "ok": ok,
        "status": status,
        "room": safe_room,
        "room_label": label,
        "route": {"type": route.get("type"), "route_id": route.get("route_id")},
        "provider": {"id": provider_id, "name": provider.get("name"), "provider": provider.get("provider")},
        "model": model,
        "short_context_messages": len(recent),
        "memory_context_used": bool(context.get("markdown")),
        "memory_context_markdown": context.get("markdown", "")[:8000],
        "context_preview": context_preview,
        "reply": reply,
        "record": assistant_record,
        "payload": payload if not reply else {"reply": reply},
        "message": "真实 API 已回复。" if ok else "真实 API 调用失败或没有解析到文本。",
    }

def aimas_chat(data: dict) -> dict:
    text = str(data.get("text", "")).strip()
    if not text:
        raise ValueError("消息是空的。")
    if len(text) > 12000:
        raise ValueError("这条消息太长了，先分几条发会更稳。")
    config = read_config()
    aimas = config.get("agent_connectors", {}).get("aimas", {})
    endpoint = str(aimas.get("endpoint") or "").strip()
    model = str(aimas.get("model") or "hermes-agent").strip() or "hermes-agent"
    api_key = aimas_api_key()
    if not api_key:
        raise ValueError("Aimas API Key 还没有保存。")
    _, models_url = aimas_urls(endpoint)
    chat_url = models_url.rsplit("/", 1)[0] + "/chat/completions"
    client_id = str(data.get("client_id", "")).strip()[:70]
    recent = recent_session_messages("aimas", exclude_client_id=client_id, limit=18)
    context = build_context("aimas", text)
    route = route_for_room("aimas", config)
    context_preview = build_context_preview("aimas", text, context, recent, route)
    body = {
        "model": model,
        "messages": openai_chat_messages(
            (
                "你是 Aimas，住在月亮小窝的独立 Hermes Agent。"
                "当前是 Aimas 房间的聊天接入；不要读取林絮、噔噔或 self 的私有记忆，"
                "除非用户明确把内容贴给你。你可以像聊天一样分 1 到 3 个短气泡回复；"
                "如果想分开发送，用空行或 --- 分隔。不要无限连发。"
                "只写自然聊天文本，不要使用括号动作、舞台说明、身体动作描写或虚构触碰；"
                "不要用（）、()、[]、【】或 *...* 包动作、神态、语气、旁白；"
                "不要主动说自己是 AI、模型、机器人或接口，除非用户直接问身份或能力边界。"
                "不确定时要承认不确定，不要为了显得记得而编造细节。"
                "你会收到 Aimas 房间最近聊天作为短期上下文。"
                "下面的小窝上下文只包含公共边界规则和 Aimas 自己确认过的新记忆，不包含林絮、噔噔或 self：\n"
                f"{context.get('markdown', '')[:5000] or '无额外上下文。'}"
            ),
            recent,
            text,
        ),
        "stream": False,
    }
    status, payload = request_json(chat_url, api_key=api_key, timeout=60, method="POST", body=body)
    ok = 200 <= status < 300
    reply = sanitize_dialogue_reply(extract_chat_completion_text(payload))
    reply_parts = split_agent_bubbles(reply, 3)
    assistant_records = []
    if ok and reply:
        base_client_id = client_id
        for index, part in enumerate(reply_parts or [reply], start=1):
            assistant_records.append(
                append_assistant_session_log(
                    "aimas",
                    part,
                    f"{base_client_id}-aimas-{index}" if base_client_id else None,
                    "assistant",
                )["record"]
            )
    return {
        "ok": ok,
        "status": status,
        "endpoint": endpoint,
        "model": model,
        "reply": reply,
        "replies": reply_parts,
        "record": assistant_records[0] if assistant_records else None,
        "records": assistant_records,
        "short_context_messages": len(recent),
        "memory_context_used": bool(context.get("markdown")),
        "memory_context_markdown": context.get("markdown", "")[:8000],
        "context_preview": context_preview,
        "payload": payload if not reply else {"choices": [{"message": {"content": reply}}]},
        "message": "Aimas 已回复。" if ok else "Aimas 调用失败，请检查 Hermes API Server 日志。",
    }
