# Lunette V0.2

Lunette V0.2 是从当前稳定 V0.1 初始化出来的独立开发工作区。

当前运行基准来自：

```text
D:\A月亮啊\memory-vault-starter
```

V0.2 工作区位置：

```text
D:\A月亮啊\lunette
```

## 当前阶段

当前阶段：V0.2 初始化完成，CSS / JS / 后端第一轮结构清理已落地，可以继续功能开发。

原则：

- 当前稳定 V0.1 只作为运行基准归档保护，不直接大拆。
- V0.2 使用 V0.1 的完整副本继续开发。
- Antigravity 代码版本只作为 patch source，不作为覆盖源。
- Antigravity Project-Docs 只作为文档来源，不作为源码执行。
- V0.2 使用自己的 `sessions/prototype` 副本测试，不能直接写 V0.1 原始数据。

## 目录结构

```text
lunette/
  README.md
  .gitignore
  docs/
    lunette-v0.2-plan-reviewed.md
    imported-antigravity/
  self/
  gpt/
  gemini/
  shared/
  tools/
  sessions/
    prototype/
  frontend/
    lunatte-v0.2/
```

根目录的 `self/`、`gpt/`、`gemini/`、`shared/`、`tools/` 和记忆库索引文档都是项目文件，不能遗漏。

## 前端原型

原型位置：

```text
frontend\lunatte-v0.2
```

主要文件：

```text
index.html
styles.css
script.js
server.py
README.md
start-stillgarden.bat
start-stillgarden.ps1
```

当前形态：

- CSS 以 `styles.css` 为运行入口，实际样式已拆到 `frontend/lunatte-v0.2/css/` 下的 token、foundation、页面和组件模块。
- JS 以 `script.js` 为 Web 入口，已抽出可复用底层到 `frontend/lunatte-v0.2/shared/lunatte-core.js`。
- 后端以 `server.py` 为运行入口，已抽出配置/路径层 `server_config.py` 和存储层 `server_storage.py`。

## 启动方式

进入原型目录：

```powershell
cd D:\A月亮啊\lunette\frontend\lunatte-v0.2
```

启动方式：

```powershell
.\start-stillgarden.ps1
```

或双击：

```text
start-stillgarden.bat
```

注意：不要长期启动隐藏服务占用端口。测试完成后关闭对应服务窗口。

## 数据安全规则

V0.2 数据副本位于：

```text
D:\A月亮啊\lunette\sessions\prototype
```

规则：

- 不直接写 `D:\A月亮啊\memory-vault-starter\sessions\prototype`。
- 不删除、移动、覆盖 V0.1 原目录。
- V0.2 内所有功能测试应写入 V0.2 自己的数据副本。
- 原始导出 zip 保留在本地工作区，但因 GitHub 单文件限制，不纳入 Git 推送。
- 记忆库索引、说明文档、路由脚本、结构文档纳入 V0.2。

## Antigravity patch source

Antigravity 代码版本：

```text
D:\Antigravity\Lunette\memory-vault-starter
```

用途：

- 差异来源。
- patch source。
- CSS/JS/结构拆分参考。
- 可选择合并的代码来源。

禁止：

- 不整体覆盖 V0.2。
- 不运行 Antigravity 的补丁脚本。
- 不复制 Antigravity 的 `sessions` 数据。
- 不直接替换 V0.2 的 `index.html`、`styles.css`、`script.js`、`server.py`。

## Project-Docs

Antigravity 规划文档已导入：

```text
docs\imported-antigravity
```

这些文件保留原文，只作为规划资料和设计参考。

## 下一步

当前拆分状态：

- CSS R5 可收口：全局视觉走 `00-tokens.css`，通用按钮/输入/开关/卡片/弹层/头像/状态条走 `05-components.css`，页面 CSS 只保留页面布局和局部差异。
- JS R5 可收口：`script.js` 只做 bootstrapping；复用底层在 `shared/`；Web DOM controller、render、actions 已拆到 `web/`。
- 后端 R5 可收口：HTTP 分发在 `routes/`，业务在 `services/`，外部模型在 `providers/`，JSONL/assets/config IO 已下沉到 `repositories/`。
- 结构维护规则维护在 `docs/v0.2-next-actions.md` 的 R5 小节；后续功能推进前先看对应 CSS / JS / Python 门槛，避免继续把新逻辑堆回入口文件或最大文件。

下一步：

1. 继续具体功能开发时，按功能补小范围模块，不再为了“拆分本身”继续无限小刀。
2. Archive 确认记忆编辑 / 撤回 / 删除 / 权限审计可以进入实现设计。
3. SQLite + FTS5 仍只做草图，不直接迁移 JSONL。
4. 每一步功能合并都单独提交，便于回滚。

详细计划见：

```text
docs\lunette-v0.2-plan-reviewed.md
```
