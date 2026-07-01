# 当前状态

更新时间：2026-07-01

## 项目位置

- 工作区：`D:\Aaa.项目\lunatte\v0.3`
- 前端：`frontend`
- 后端：`backend`
- 本地私有记忆材料：`memory/`
- 本地运行数据：`data/sessions/prototype`
- 远程仓库：`https://github.com/szxmt/StillGarden.git`

## 当前结论

V0.2 已完成公开仓库隐私历史清理，并进入前后端/数据目录重组验证。CSS / JS / 后端已有明确写入边界，新增功能必须按 `engineering-rules.md` 落到对应模块。

## 已完成

- CSS：`styles.css` 只做入口；token、foundation、components、页面 CSS 已拆开。
- JS：`script.js` 只做启动；可复用逻辑在 `shared/`；Web DOM 在 `web/`。
- 后端：`server.py` 是 HTTP/static 入口；`routes/`、`services/`、`providers/`、`repositories/` 已分层。
- 数据：当前仍以本地 `data/sessions/prototype/*.jsonl` 为原型真源，repository 已包住 JSONL/assets/config IO。
- 公开仓库历史：`gpt/`、`gemini/`、`self/`、`shared/`、`sessions/`、`incoming/` 已从 Git 历史中移除；私有材料恢复到本地 `memory/` 和 `data/`。
- API/browser smoke：本次目录重组完成后重新验证。

## 当前未完成

- Archive 确认记忆编辑、撤回、删除、审计。
- SQLite + FTS5 事件索引草图和副本验证。
- 时间线/热力图正式数据模型。
- UI 翻新试点。
- 真 App 技术路线验证。
- 自动评论后台触发器、主动唤醒调度器。

## 本地脏改注意

写入型测试可能留下 `data/sessions/prototype` diff。默认不提交这些数据，除非明确决定作为种子数据。

`docs/references/` 下的本地参考子目录默认不提交；只提交提取后的 `.md` 总结。
