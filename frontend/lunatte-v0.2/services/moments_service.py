from __future__ import annotations

import re
from datetime import datetime, timezone

from server_config import DEFAULT_CONFIG, find_vault_root, moments_path, normalize_session_room
from server_storage import append_jsonl, read_jsonl_events, read_secrets, write_prototype_image_asset
from services.chat_service import recent_session_messages, sanitize_dialogue_reply, split_agent_bubbles
from services.config_service import normalize_moments_auto_comments, normalize_user_profile, provider_api_key, read_config, route_for_room
from services.text_utils import clean_memory_text
from providers.gemini_provider import extract_gemini_text, gemini_chat_contents, gemini_generate_url
from providers.hermes_provider import aimas_urls
from providers.http_client import request_json
from providers.openai_provider import extract_chat_completion_text, openai_chat_messages, provider_chat_url

def moment_author_label(author: str) -> str:
    user_label = DEFAULT_CONFIG["user_profile"]["nickname"]
    try:
        user_label = normalize_user_profile(read_config().get("user_profile", {}))["nickname"]
    except Exception:
        user_label = DEFAULT_CONFIG["user_profile"]["nickname"]
    labels = {
        "me": user_label,
        "linxu": "林絮",
        "dengdeng": "噔噔",
        "aimas": "Aimas",
        "living": "客厅",
    }
    return labels.get(author, "你")

def moment_event_author_label(event: dict) -> str:
    author = str(event.get("author", "me"))
    if author == "me":
        return moment_author_label("me")
    return event.get("author_label") or moment_author_label(author)

def moment_seed_text(author: str, reason: str = "") -> str:
    clean_reason = clean_memory_text(reason or "刚刚想到一件小事", 120)
    templates = {
        "linxu": f"把这件事先放在这里：{clean_reason}。不用说得很响，记得就好。",
        "dengdeng": f"今日小发现：{clean_reason}。噔噔先盖个小章，之后再回来补充！",
        "aimas": f"Aimas 小灯记录：{clean_reason}。终端还亮着，我会把这条线索留好。",
        "living": f"客厅留条公共便签：{clean_reason}。谁路过都可以接一句。",
        "me": clean_reason,
    }
    return templates.get(author, templates["me"])

def read_moments(limit: int = 80) -> dict:
    events = read_jsonl_events(moments_path(), max(500, limit * 6))
    posts: dict[str, dict] = {}
    order: list[str] = []
    deleted_posts: set[str] = set()
    for event in events:
        event_type = event.get("type", "post")
        moment_id = str(event.get("id") or event.get("moment_id") or "")
        if not moment_id:
            continue
        if event_type == "post":
            if moment_id in deleted_posts:
                continue
            posts[moment_id] = {
                "id": moment_id,
                "timestamp": event.get("timestamp", ""),
                "author": event.get("author", "me"),
                "author_label": moment_event_author_label(event),
                "text": event.get("text", ""),
                "image_data": event.get("image_data") or event.get("image") or "",
                "image_relative_path": event.get("image_relative_path", ""),
                "source": event.get("source", "manual"),
                "likes": [],
                "comments": [],
            }
            order.append(moment_id)
            continue
        if event_type == "delete_post":
            deleted_posts.add(moment_id)
            posts.pop(moment_id, None)
            order = [item for item in order if item != moment_id]
            continue
        post = posts.get(moment_id)
        if not post:
            continue
        if event_type == "like":
            liker = str(moment_event_author_label(event))
            if liker and liker not in post["likes"]:
                post["likes"].append(liker)
        elif event_type == "unlike":
            liker = str(moment_event_author_label(event))
            post["likes"] = [item for item in post["likes"] if item != liker]
        elif event_type == "comment":
            text = clean_memory_text(str(event.get("text", "")), 600)
            if text:
                post["comments"].append({
                    "id": event.get("comment_id", f"comment-{len(post['comments']) + 1}"),
                    "timestamp": event.get("timestamp", ""),
                    "author": event.get("author", "me"),
                    "author_label": moment_event_author_label(event),
                    "text": text,
                    "reply_to": event.get("reply_to", ""),
                })
        elif event_type == "delete_comment":
            comment_id = str(event.get("comment_id", ""))
            if comment_id:
                post["comments"] = [comment for comment in post["comments"] if str(comment.get("id", "")) != comment_id]
    ordered = [posts[moment_id] for moment_id in order if moment_id in posts]
    ordered.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return {
        "ok": True,
        "entries": ordered[: max(1, min(limit, 200))],
        "relative_path": str(moments_path().relative_to(find_vault_root())),
    }

def create_moment(data: dict) -> dict:
    author = str(data.get("author", "me"))
    if author not in {"me", "linxu", "dengdeng", "aimas", "living"}:
        author = "me"
    source = str(data.get("source", "manual"))
    reason = str(data.get("reason", ""))
    text = clean_memory_text(str(data.get("text", "")), 1200)
    if not text and source == "auto":
        text = moment_seed_text(author, reason)
    if not text:
        return {"ok": False, "message": "朋友圈文字不能为空。"}
    event = {
        "type": "post",
        "id": f"moment-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "author": author,
        "author_label": moment_author_label(author),
        "text": text,
        "source": source,
        "reason": clean_memory_text(reason, 300),
    }
    image_data = str(data.get("image_data", ""))
    if image_data:
        try:
            saved_image = write_prototype_image_asset("moments", f"{author}-moment", image_data)
        except ValueError as error:
            return {"ok": False, "message": str(error)}
        if not saved_image.get("ok"):
            return saved_image
        event["image_data"] = saved_image["url"]
        event["image_relative_path"] = saved_image["relative_path"]
    path = moments_path()
    append_jsonl(path, event)
    return read_moments(80) | {"ok": True, "created": event}

def find_moment_entry(moment_id: str) -> dict | None:
    for entry in read_moments(200).get("entries", []):
        if str(entry.get("id", "")) == moment_id:
            return entry
    return None

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
        api_key = read_secrets().get("aimas", {}).get("api_key", "")
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

def parse_event_datetime(value: object) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed

def time_minutes(value: str) -> int:
    hour, minute = value.split(":", 1)
    return int(hour) * 60 + int(minute)

def is_quiet_time(now: datetime, start: str, end: str) -> bool:
    current = now.hour * 60 + now.minute
    start_minutes = time_minutes(start)
    end_minutes = time_minutes(end)
    if start_minutes == end_minutes:
        return False
    if start_minutes < end_minutes:
        return start_minutes <= current < end_minutes
    return current >= start_minutes or current < end_minutes

def latest_auto_comment_times() -> dict[str, datetime]:
    latest: dict[str, datetime] = {}
    for event in read_jsonl_events(moments_path(), 800):
        if event.get("type") != "comment" or event.get("source") != "auto_comment":
            continue
        author = str(event.get("author", ""))
        when = parse_event_datetime(event.get("timestamp"))
        if author and when and (author not in latest or when > latest[author]):
            latest[author] = when
    return latest

def read_moments_auto_preview() -> dict:
    config = read_config()
    auto_config = normalize_moments_auto_comments(config.get("moments_auto_comments", {}))
    now = datetime.now().astimezone()
    quiet_now = is_quiet_time(now, auto_config["quiet_start"], auto_config["quiet_end"])
    entries = read_moments(80).get("entries", [])
    latest_by_author = latest_auto_comment_times()
    candidates: list[dict] = []
    blocked: list[dict] = []
    enabled_commenters = [
        author for author, enabled in auto_config.get("commenters", {}).items()
        if enabled and author in {"linxu", "dengdeng", "aimas"}
    ]
    if not auto_config.get("enabled"):
        return {
            "ok": True,
            "enabled": False,
            "quiet_now": quiet_now,
            "now": now.isoformat(timespec="minutes"),
            "config": auto_config,
            "candidates": [],
            "blocked": [],
            "summary": "auto reply 关闭：不会生成候选。",
        }
    if quiet_now:
        return {
            "ok": True,
            "enabled": True,
            "quiet_now": True,
            "now": now.isoformat(timespec="minutes"),
            "config": auto_config,
            "candidates": [],
            "blocked": [
                {
                    "commenter": author,
                    "commenter_label": moment_author_label(author),
                    "reason": f"安静时段 {auto_config['quiet_start']}-{auto_config['quiet_end']} 中",
                }
                for author in enabled_commenters
            ],
            "summary": f"现在是安静时段 {auto_config['quiet_start']}-{auto_config['quiet_end']}，不生成自动评论候选。",
        }

    cooldown_seconds = int(auto_config["cooldown_minutes"]) * 60
    for author in enabled_commenters:
        latest = latest_by_author.get(author)
        if latest:
            elapsed = (now - latest.astimezone()).total_seconds()
            if elapsed < cooldown_seconds:
                remain_minutes = max(1, int((cooldown_seconds - elapsed + 59) // 60))
                blocked.append({
                    "commenter": author,
                    "commenter_label": moment_author_label(author),
                    "reason": f"冷却中，还需约 {remain_minutes} 分钟",
                })
                continue
        match = None
        for post in entries:
            if str(post.get("author", "")) == author:
                continue
            comments = post.get("comments") if isinstance(post.get("comments"), list) else []
            if any(str(comment.get("author", "")) == author for comment in comments):
                continue
            match = post
            break
        if not match:
            blocked.append({
                "commenter": author,
                "commenter_label": moment_author_label(author),
                "reason": "没有找到未回应的新动态",
            })
            continue
        candidates.append({
            "commenter": author,
            "commenter_label": moment_author_label(author),
            "moment_id": match.get("id", ""),
            "post_author": match.get("author", ""),
            "post_author_label": match.get("author_label") or moment_author_label(str(match.get("author", "me"))),
            "post_text": clean_memory_text(str(match.get("text", "")), 120) or "一张图片",
            "timestamp": match.get("timestamp", ""),
            "reason": "可作为下一条自动评论候选",
        })

    summary = f"可自动回应 {len(candidates)} 条；暂缓 {len(blocked)} 个。"
    return {
        "ok": True,
        "enabled": True,
        "quiet_now": False,
        "now": now.isoformat(timespec="minutes"),
        "config": auto_config,
        "candidates": candidates,
        "blocked": blocked,
        "summary": summary,
    }

def update_moment(data: dict) -> dict:
    action = str(data.get("action", ""))
    moment_id = str(data.get("id", ""))
    if action not in {"like", "unlike", "comment", "delete_post", "delete_comment", "auto_comment"} or not moment_id:
        return {"ok": False, "message": "朋友圈操作不完整。"}
    author = str(data.get("author", "me"))
    if author not in {"me", "linxu", "dengdeng", "aimas", "living"}:
        author = "me"
    generated_comment = None
    if action == "auto_comment":
        post = find_moment_entry(moment_id)
        if not post:
            return {"ok": False, "message": "没有找到这条圈圈，先刷新一下。"}
        generated_comment = generate_moment_comment(author, post)
        action = "comment"
    event = {
        "type": action,
        "id": moment_id,
        "moment_id": moment_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "author": author,
        "author_label": moment_author_label(author),
    }
    if action == "comment":
        text = clean_memory_text(generated_comment.get("reply", "") if generated_comment else str(data.get("text", "")), 600)
        if not text:
            return {"ok": False, "message": "评论不能为空。"}
        event["text"] = text
        event["reply_to"] = clean_memory_text(str(data.get("reply_to", "")), 80)
        event["comment_id"] = f"comment-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        if generated_comment:
            event["source"] = "auto_comment"
            event["generated_by"] = generated_comment.get("route", "provider")
    elif action == "delete_comment":
        comment_id = str(data.get("comment_id", "")).strip()
        if not comment_id:
            return {"ok": False, "message": "缺少要删除的评论。"}
        event["comment_id"] = comment_id
    path = moments_path()
    append_jsonl(path, event)
    return read_moments(80) | {"ok": True, "event": event}
