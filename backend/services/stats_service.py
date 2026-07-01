from __future__ import annotations

from server_config import count_jsonl, find_vault_root

def build_stats() -> dict:
    vault = find_vault_root()
    memory = vault / "memory"
    gpt_conversations = count_jsonl(memory / "gpt" / "parsed" / "conversation_index.jsonl")
    gemini_activities = count_jsonl(memory / "gemini" / "parsed" / "activity_index.jsonl")
    incoming_supplements = count_jsonl(memory / "self" / "reports" / "incoming_chat_index.jsonl")
    persona_evidence = count_jsonl(memory / "gpt" / "parsed" / "persona_evidence_extracts.jsonl")
    relationship_nodes = (
        count_jsonl(memory / "gpt" / "parsed" / "relationship_node_index.jsonl")
        + count_jsonl(memory / "gemini" / "parsed" / "relationship_node_index.jsonl")
    )
    daily_entries = (
        count_jsonl(memory / "gpt" / "parsed" / "daily_companionship_index.jsonl")
        + count_jsonl(memory / "gemini" / "parsed" / "daily_companionship_index.jsonl")
    )
    return {
        "gpt_conversations": gpt_conversations,
        "gemini_activities": gemini_activities,
        "incoming_supplements": incoming_supplements,
        "persona_evidence": persona_evidence,
        "relationship_nodes": relationship_nodes,
        "daily_entries": daily_entries,
        "residents": 3,
        "aimas_status": "留门牌，待接 Hermes",
        "privacy_note": "统计只读取索引行数，不读取原始聊天正文。",
    }
