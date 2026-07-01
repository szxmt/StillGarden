# Lunette 文档索引

本目录是 V0.2 之后的唯一项目文档入口。后续不要继续把计划、规则和状态散落到根目录。

## 当前真源

- `current-status.md`：当前真实状态，先看这个。
- `roadmap.md`：下一步做什么、暂缓什么。
- `engineering-rules.md`：写代码前必须遵守的写入规则。
- `architecture.md`：当前前后端和数据层结构。
- `product-blueprint.md`：长期产品蓝图。
- `ui-direction.md`：UI 翻新方向和 token/components 规则。
- `memory-system-plan.md`：记忆库、时间线、SQLite/FTS5、RAG、热力图。
- `app-strategy.md`：真 App、APK、VPS、云同步路线。
- `decision-log.md`：已经定下来的关键决策。

## 记忆库资料

- `archive/memory-index-legacy-v0.1/`：旧 v0.1 记忆库访问、检索、上下文生成说明。只作历史参考，不是当前计划真源。

## 参考和归档

- `references/antigravity-useful-extract.md`：从 Antigravity 文档提取出的可用信息。
- `archive/`：历史审计、旧计划、外部参考原文。默认不作为当前真源。

## 写入规则

新增文档前先判断：

- 当前状态变化：改 `current-status.md`。
- 工程边界变化：改 `engineering-rules.md` 或 `architecture.md`。
- 下一步顺序变化：改 `roadmap.md`。
- UI 审美或组件原则：改 `ui-direction.md`。
- 记忆、RAG、热力图、SQLite：改 `memory-system-plan.md`。
- App / VPS / 部署：改 `app-strategy.md`。
- 外部资料摘录：改 `references/`，不要直接把原文当真源。
