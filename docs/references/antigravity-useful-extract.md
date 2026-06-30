# Antigravity 可用信息提取

原文位置：`docs/archive/imported-antigravity-raw/`

这些资料只作为参考，不覆盖当前 V0.2 代码。

## 可吸收

### UI

来源：

- `问题改进方案/abyssal-letter-ui-overhaul.md`
- `问题改进方案/ui-design-concept.md`

可用点：

- 降低幼态感。
- 提高信息密度。
- 减少厚重卡片和大阴影。
- 使用纸感、细线、轻磨砂、低饱和色。
- 让交互件更安静，不做强提示的后台系统感。

不能直接用：

- 不直接替换当前 HTML/CSS。
- 不直接合并 `ui模板` 源码。

### 架构

来源：

- `问题改进方案/frontend-architecture-plan.md`
- `问题改进方案/backend-monolith-refactor.md`

可用点：

- 单体 `script.js` / `server.py` 的风险判断是对的。
- API、状态、DOM、service、routes、providers、repositories 需要分层。

当前状态：

- V0.2 已经完成主要拆分，因此这些文档转为历史参考。

### 数据与热力图

来源：

- `问题改进方案/data-structure-and-processing-analysis.md`

可用点：

- 热力图依赖标准 timestamp。
- JSONL 不适合直接支撑复杂搜索和聚合。
- SQLite + FTS5 适合作为本地索引层。
- 后续可以再评估向量库。

修正：

- 不直接废弃 JSONL。
- SQLite 先做副本索引，不做唯一真源。

### 真 App / VPS

来源：

- `问题改进方案/blueprint-vs-pdf-gap-analysis.md`
- `问题清单/implementation_plan.md`

可用点：

- 真 App 应优先于 WebView 套壳。
- VPS 可以承担轻量后端角色。
- 前后端分离需要 API base、CORS、鉴权设计。

修正：

- Supabase 不是当前默认路线。
- Cloudflare/VPS 正式部署暂缓。
- 未设计鉴权前不开放公网服务。

## 不采用

- 直接合并 Antigravity 代码。
- 直接使用 UI 模板源码。
- 直接迁移 Supabase。
- 直接把 VPS 做唯一数据真源。
- 直接上商店发布。
