# Aimas / Hermes 接入评估 v0.1

更新时间：2026-06-19

## 结论

Aimas 可以接，但不要把 Hermes 当成普通 provider。

更稳的结构是：

```text
月亮小窝前端
  -> 本地 Stillgarden bridge
  -> Aimas Connector
  -> Hermes Agent API Server
  -> Hermes profile: aimas
```

也就是说，林絮和噔噔继续走 provider 路线；Aimas 走独立 Agent Connector。

## 为什么不是 provider

Hermes Agent 不是单纯模型接口。它自己有：

- profile
- SOUL.md
- sessions
- memory
- skills
- tools
- gateway
- API server

如果把它塞进 provider 下拉，会把“模型供应商”和“一个完整住户本体”混在一起，后面很容易乱。

## 源码/文档里确认到的可接入口

Hermes 有 OpenAI-compatible API server。

可用方向：

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`
- `GET /health`
- `GET /v1/capabilities`
- `GET /api/sessions`
- `POST /api/sessions`
- `POST /api/sessions/{session_id}/chat`
- `POST /api/sessions/{session_id}/chat/stream`

默认端口是 `8642`。

它需要 `API_SERVER_ENABLED=true` 和 `API_SERVER_KEY`。

## 最适合小窝的接法

第一阶段用 OpenAI-compatible endpoint：

```text
base_url: http://127.0.0.1:8642/v1
model: hermes-agent
auth: Authorization: Bearer <API_SERVER_KEY>
```

优点：

- 小窝侧容易接。
- 可以先复用现在 dry-run 请求包结构。
- 不需要先碰 Hermes 的 TUI/PTY。
- 未来搬 VPS 也能接，只要做好反代和鉴权。

限制：

- Hermes 工具运行在 Hermes API server 所在机器上。
- 如果 Hermes 在 VPS，Aimas 的文件/终端/工具也在 VPS，不在本机。
- 不能把 API server 暴露到公网裸奔，必须有强 key，最好再加反代、IP 限制或 VPN。

## 推荐的 Aimas 隔离方案

创建独立 Hermes profile：

```text
hermes profile create aimas
```

这个 profile 应该有自己的：

- `config.yaml`
- `.env`
- `SOUL.md`
- `state.db`
- sessions
- memory
- tools / skills

这样 Aimas 不会天然读到林絮、噔噔或用户 self 的旧库。

小窝只把允许给 Aimas 的上下文塞进请求，不让 Hermes 自己扫整个记忆库。

## 推荐的阶段

### 阶段 1：只做探针

小窝 More 页保留：

- Aimas Endpoint
- Aimas Model
- API_SERVER_KEY
- 状态

新增一个“测试连接”即可。

测试目标：

- `/health` 可达
- `/v1/models` 鉴权成功
- 返回模型里有 `hermes-agent`

当前已完成：

- More 页已加入 Aimas Endpoint、Model、API Key 输入。
- API Key 会保存到 `sessions/prototype/secrets.local.json`。
- `/api/config` 不回传明文 key，只回传 `key_saved`。
- 已加入“测试 Hermes 连接”按钮。
- 已加入本地 `/api/aimas-probe`，会测试 `/health` 与 `/v1/models`。

### 阶段 2：dry-run 转真实请求

当前 Chat 已经能生成 dry-run 请求包。

后面给 Aimas 单独加：

```text
route.type = agent
route.agent.kind = hermes_agent
route.agent.endpoint = http://127.0.0.1:8642/v1
```

只有 Aimas 房间会调用这个 connector。

当前已完成：

- Aimas 房间发送后仍会写本地 session 草稿。
- Aimas 房间仍会生成 dry-run 请求包，便于追踪上下文和路线。
- 请求包生成成功后，会调用 Hermes `/v1/chat/completions`。
- 回复会显示为 `Aimas · Hermes` 气泡。
- 林絮、噔噔和客厅不受影响，仍保持 dry-run。

### 阶段 3：持久 session

如果只用 `/v1/chat/completions`，小窝可以自己保存 Aimas session，再把最近消息发过去。

如果用 Hermes 的 `/api/sessions/{session_id}/chat`，就可以让 Hermes 自己保留 Aimas 的会话状态。

更推荐后者，但先从前者试通更稳。

## 暂时不做的事

- 不直接接 Hermes TUI。
- 不用 PTY 包一层终端。
- 不让 Aimas 自动读取 Alice / 林絮 或噔噔私有记忆。
- 不把 Hermes key 明文写入前端。
- 不先开放公网。
- 不先做无限制主动连发。

## 主动唤醒设计草案

主动找用户聊天可以做，但需要先设边界。

推荐顺序：

1. 先做“唤醒草稿”：Aimas 生成想说的话，先进小窝收件箱，不直接推送。
2. 再做“冷却规则”：例如 2 到 6 小时内最多一次，夜间安静。
3. 再接“触发条件”：最近聊天、用户在线、手动允许、纪念日或时光胶囊。
4. 最后接 Bark / 浏览器通知 / 手机推送。

当前已完成多气泡回复：一次 Hermes 返回最多拆成 3 条气泡。它让聊天不像机械一问一答，但仍然避免无限刷屏。

## Aimas 工具 / 终端输出设计草案

Aimas 有终端和工具能力，但聊天页不能像普通机器人日志一样刷屏。

推荐交互：

```text
聊天流
  Aimas：我去小电脑里看一下。
  [小电脑工作卡片 · 可展开]
```

小电脑卡片默认折叠，只显示：

- 任务标题
- 当前状态
- 是否需要用户批准
- 简短结果摘要

展开后再显示：

- 运行过的命令
- 工具调用步骤
- 输出摘要
- 错误信息
- 可复制的完整日志入口

默认规则：

- 主动唤醒不能自动跑工具。
- 聊天里如需跑代码，先显示确认卡。
- 用户确认后才允许本次工具运行。
- 工具输出不直接灌进聊天气泡，只进入小电脑卡片。
- 聊天流只放最终摘要或 Aimas 的自然语言解释。

目标不是削弱 Aimas，而是让她有“工作台”，不要把客厅变成终端滚屏。

## 风险

- Hermes 更新很快，API 细节可能变。
- API server 有终端和工具能力，权限比普通模型接口高。
- 如果在 VPS 跑，所有工具都在 VPS 上执行。
- 如果要手机访问，需要额外处理 HTTPS、鉴权、反代和跨域。
- 如果用 Caddy 反代，建议 endpoint 填 `https://域名/v1`，不要裸露 `:8642`。
- 反代层建议继续保留 Hermes 的 `API_SERVER_KEY`，不要只靠域名保密。

## 当前判断

可以做。

最小可行版本不是“接完整 Hermes”，而是：

```text
小窝 Aimas 房间
  -> 本地桥接
  -> Hermes /health + /v1/models 探针
  -> /v1/chat/completions 单轮真实回复
  -> 再升级到 Hermes session API
```

这条路不会堵死。
