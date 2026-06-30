from __future__ import annotations

from datetime import datetime, timezone

from repositories.moments_repository import read_moment_events


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
    for event in read_moment_events(800):
        if event.get("type") != "comment" or event.get("source") != "auto_comment":
            continue
        author = str(event.get("author", ""))
        when = parse_event_datetime(event.get("timestamp"))
        if author and when and (author not in latest or when > latest[author]):
            latest[author] = when
    return latest

