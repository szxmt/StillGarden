from __future__ import annotations



def clean_memory_text(value: str, limit: int = 4000) -> str:
    text = str(value or "").strip()
    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    return text[:limit]
