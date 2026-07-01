# 工程写入规则

本文件是新增功能和重构前必须遵守的规则。目标是避免再次形成单体文件和散乱文档。

## CSS

- 全局视觉只改 `frontend/css/00-tokens.css`，或未来新增的主题 token 文件。
- 通用按钮、输入、select、textarea、开关、卡片、弹层、toast、头像、状态条写入 `05-components.css`。
- 页面 CSS 只写页面独有布局：
  - Chat：`20-chat.css`
  - Profile：`21-profile.css`
  - Dialog：`22-dialogs.css`
  - Chat search：`23-chat-search.css`
  - Archive：`30-archive.css`
  - Timeline：`31-timeline.css`
  - Settings / More：`40-subpages-settings.css`
  - Moments：`50-moments.css`
  - Wake：`51-wake.css`
- 页面 CSS 不为主题复制一套，不新增散落硬编码色值。
- CSS 文件超过 700 行要审查，超过 1000 行必须拆分后再加功能。

## 前端 JS

- `script.js` 永远只做 bootstrapping。
- `shared/` 只能放纯逻辑、API client、browser state，不能访问 DOM。
- `web/*controller.js` 可以访问 DOM，但不能直接拼 API path，必须走 `LunatteApi`。
- controller 超过 700 行：新增功能前先拆 render、actions、helpers 或子 controller。
- render 函数超过 120 行：拆 view helper。
- 事件绑定只在 controller/init 层；纯数据计算回到 `shared/`。

## 后端

- `server.py` 不写业务逻辑。
- `routes/*.py` 只做 HTTP 解析、调用 service、返回 payload/status。
- `services/*.py` 写业务规则，不直接关心 HTTP。
- `providers/*.py` 只负责外部模型/Agent 请求和响应解析。
- `repositories/*.py` 负责 JSONL / SQLite / assets / config IO。
- `server_config.py` 只放路径、默认值、轻量 normalize。
- `server_storage.py` 只保留通用读写工具，不承载功能业务规则。

后端阈值：

- service 超过 500 行：新增功能前拆 policy/helper/repository。
- service 同时处理 prompt、provider、写数据、读列表四类职责：必须拆。
- route 中出现 JSONL / SQLite / provider 调用：退回 service/provider。
- provider 中出现 UI 文案或页面状态：退回 service。

## 配置与数据

配置分三类：

- Public config：前端可读取，如 room label、provider model、self access 状态。
- Secret config：API key、agent key，只能通过 secret storage，不返回明文。
- Feature policy：self access、moments auto、quiet time、cooldown、wake scheduler policy。

数据分三层：

- Prototype JSONL：当前运行基准，继续保护。
- Repository API：统一 JSONL/assets/config 读写，为 SQLite 迁移做边界。
- SQLite / FTS5：后续事件索引，不直接替代原始 JSONL。

## 提交前检查

每次代码提交前至少运行：

```powershell
node --check frontend\script.js
python -m py_compile backend\server.py backend\server_config.py backend\server_storage.py
```

涉及 `frontend/shared`、`frontend/web`、`backend/services`、`backend/routes`、`backend/providers`、`backend/repositories` 时，要扩大检查到对应目录。

短启动 8877 后必须确认：

- `/api/health` 返回 200。
- `sessions` 指向 `D:\Aaa.项目\lunatte\v0.3\data\sessions\prototype`。

写入型测试产生的 `data/sessions/prototype` diff 默认不提交。

## 文档写入

- 根目录只保留 `README.md`。
- 当前状态写入 `docs/current-status.md`。
- 下一步计划写入 `docs/roadmap.md`。
- 架构边界写入 `docs/architecture.md`。
- 规则变化写入本文件。
- 参考原文归档，不直接作为当前真源。
