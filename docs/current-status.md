# 当前状态

更新时间：2026-06-30

## 项目位置

- 工作区：`D:\A月亮啊\lunette`
- 当前可运行原型：`frontend/lunatte-v0.2`
- 数据副本：`sessions/prototype`
- 远程仓库：`https://github.com/szxmt/StillGarden.git`

## 当前结论

V0.2 结构重构已收口。CSS / JS / 后端都已有明确写入边界，可以恢复功能设计，但新增功能必须按 `engineering-rules.md` 落到对应模块。

## 已完成

- CSS：`styles.css` 只做入口；token、foundation、components、页面 CSS 已拆开。
- JS：`script.js` 只做启动；可复用逻辑在 `shared/`；Web DOM 在 `web/`。
- 后端：`server.py` 是 HTTP/static 入口；`routes/`、`services/`、`providers/`、`repositories/` 已分层。
- 数据：当前仍以 `sessions/prototype/*.jsonl` 为原型真源，repository 已包住 JSONL/assets/config IO。
- API smoke：`/`、`/api/health`、`/api/stats`、`/api/config`、`/api/moments`、`/api/timeline` 已确认返回 200。
- 浏览器 smoke：Home / Rooms / Chat / Archive / Timeline / More / Moments，以及主要二级页已确认可打开，无 console error。

## 当前未完成

- Archive 确认记忆编辑、撤回、删除、审计。
- SQLite + FTS5 事件索引草图和副本验证。
- 时间线/热力图正式数据模型。
- UI 翻新试点。
- 真 App 技术路线验证。
- 自动评论后台触发器、主动唤醒调度器。

## 本地脏改注意

写入型测试可能留下 `sessions/prototype` diff。默认不提交这些数据，除非明确决定作为种子数据。

`docs/references/` 下的本地参考子目录默认不提交；只提交提取后的 `.md` 总结。
