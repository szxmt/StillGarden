# 记忆系统计划

## 当前状态

当前原型以 JSONL 为真源：

- `data/sessions/prototype/linxu.jsonl`
- `data/sessions/prototype/dengdeng.jsonl`
- `data/sessions/prototype/aimas.jsonl`
- `data/sessions/prototype/moments.jsonl`
- `data/sessions/prototype/confirmed-memory.jsonl`
- `data/sessions/prototype/wake-inbox.jsonl`

后端已经通过 `repositories/` 包住 JSONL/assets/config IO。

## 原则

- JSONL 继续作为原始记录和回滚基础。
- SQLite / FTS5 先做副本索引，不直接替换 JSONL。
- 向量库 / RAG 只提供上下文证据，不替代人格生成。
- 任何迁移都使用 `data/sessions/prototype` 副本验证。

## 事件模型

后续统一事件至少需要：

- `event_id`
- `source`
- `actor`
- `target`
- `event_type`
- `text`
- `created_at`
- `visibility`
- `sensitive`
- `related_room`
- `raw_ref`

## 时间线和热力图

热力图依赖标准时间，不是单独 UI。

顺序：

1. 统一 timestamp。
2. 建 SQLite events 副本表。
3. 建 FTS5 search index。
4. 按 day / actor / source 聚合。
5. 前端做热力图 UI。

## RAG 路线

1. 关键词/FTS5 检索。
2. 时间、人物、可读范围过滤。
3. 轻量 rerank。
4. 向量检索。
5. 模型请求包中显示引用来源。

RAG 输出必须可解释：能看到引用了哪些事件、哪些确认记忆、哪些被权限过滤。

## 记忆库旧索引资料

`docs/memory-index/legacy-v0.1/` 保存 v0.1 的本地记忆路由、搜索、上下文生成和访问规则说明。它们属于记忆库资料，不和普通项目计划混放。
