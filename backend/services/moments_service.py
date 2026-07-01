from __future__ import annotations

from datetime import datetime

from repositories.moments_repository import append_moment_event, moments_relative_path, read_moment_events, save_moment_image
from services.config_service import normalize_moments_auto_comments, read_config
from services.moments_auto_policy import is_quiet_time, latest_auto_comment_times
from services.moments_comment_service import generate_moment_comment
from services.moments_labels import moment_author_label, moment_event_author_label
from services.text_utils import clean_memory_text

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
    events = read_moment_events(max(500, limit * 6))
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
        "relative_path": moments_relative_path(),
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
            saved_image = save_moment_image(author, image_data)
        except ValueError as error:
            return {"ok": False, "message": str(error)}
        if not saved_image.get("ok"):
            return saved_image
        event["image_data"] = saved_image["url"]
        event["image_relative_path"] = saved_image["relative_path"]
    append_moment_event(event)
    return read_moments(80) | {"ok": True, "created": event}

def find_moment_entry(moment_id: str) -> dict | None:
    for entry in read_moments(200).get("entries", []):
        if str(entry.get("id", "")) == moment_id:
            return entry
    return None

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
    append_moment_event(event)
    return read_moments(80) | {"ok": True, "event": event}
