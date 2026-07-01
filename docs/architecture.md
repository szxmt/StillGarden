# 当前架构

## 顶层目录

```text
lunatte/
  README.md
  docs/
  frontend/
  backend/
  tools/
  memory/                 local only, ignored
    gpt/
    gemini/
    self/
    shared/
    incoming/
  data/                   local only, ignored
    sessions/prototype/
```

`memory/` 是本地私有记忆材料，不进公开 Git。`data/` 是本地运行数据，不进公开 Git。

## 前端原型

```text
frontend/
  index.html
  styles.css
  script.js
  shared/
  web/
  css/
```

## 后端原型

```text
backend/
  server.py
  routes/
  services/
  providers/
  repositories/
  server_config.py
  server_storage.py
```

## CSS 层级

```text
styles.css
  00-tokens.css
  00-foundation.css
  05-components.css
  10-home-rooms.css
  20-chat.css
  21-profile.css
  22-dialogs.css
  23-chat-search.css
  30-archive.css
  31-timeline.css
  40-subpages-settings.css
  50-moments.css
  51-wake.css
  60-config-dock-responsive.css
```

主题和整体气质优先改 token/components，不逐页面重写。

## JS 层级

- `script.js`：启动入口。
- `shared/lunatte-core.js`：纯 helper、常量、格式化。
- `shared/lunatte-api.js`：API client。
- `shared/lunatte-state.js`：浏览器状态/localStorage。
- `web/`：页面 controller、render、actions、helpers。

## 后端层级

- `server.py`：HTTP/static 入口。
- `routes/`：HTTP path、query/body 解析、payload/status 返回。
- `services/`：业务用例和规则。
- `providers/`：外部模型 / Hermes / Gemini / OpenAI-compatible 请求。
- `repositories/`：JSONL、assets、config/secrets IO。
- `server_config.py`：路径、默认值。
- `server_storage.py`：通用读写工具。

## 当前数据真源

- 原型事件：`data/sessions/prototype/*.jsonl`
- 配置：`data/sessions/prototype/config.json`
- secrets：本地 secret store，不返回前端明文。
- 图片资产：`data/sessions/prototype/assets/`

SQLite / FTS5 只能先做副本索引，不直接替换 JSONL。
