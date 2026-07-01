# Lunette V0.2 Reviewed Initialization Plan

更新时间：2026-06-29  
状态：已完成只读审计，V0.2 进入独立工作区初始化阶段。

## 1. 审计摘要

本次审计确认了三个目录的角色：

- 当前稳定 V0.1：`D:\A月亮啊\memory-vault-starter`
- Antigravity 代码版本：`D:\Antigravity\Lunette\memory-vault-starter`
- Antigravity 规划文档：`D:\Antigravity\Lunette\Project-Docs`

结论：

- 当前稳定 V0.1 是唯一运行基准，不能删除、移动、覆盖，也不能直接改动原始 `data/sessions/prototype`。
- Antigravity 代码版本和当前 V0.1 内容不同，不能作为覆盖源。
- Antigravity 代码版本仍然有价值：它包含 CSS 拆分、主题切换、自定义下拉框、profile 面板修正和一些临时补丁脚本，可作为 patch source。
- Project-Docs 是规划资料源，应该导入 V0.2 的 `docs/imported-antigravity/`，但不能当源码执行。
- V0.2 应建立为独立工作区：`D:\Aaa.项目\lunatte-v0.2`。
- V0.2 初始代码应来自当前稳定 V0.1；Antigravity 内容只能逐项审计、逐项合并。

## 2. 三个目录文件树摘要

### 2.1 当前稳定 V0.1

路径：`D:\A月亮啊\memory-vault-starter`

审计结果：

- 存在。
- 约 133 个文件、28 个目录。
- 总大小约 1.365 GB。
- 不是 git 仓库。
- 包含长期记忆库、前端原型、后端原型、本地会话数据。

4 层以内结构重点：

```text
memory-vault-starter/
  README.md
  access-rules.md
  current-status-v0.1.md
  memory-vault-usage-v0.1.md
  memory-router-v0.1.md
  self/
  gpt/
    raw/
  gemini/
    raw/
  shared/
  tools/
  sessions/
    prototype/
  frontend/
    lunatte-v0.2/
      index.html
      styles.css
      script.js
      server.py
      README.md
      start-lunatte.bat
      start-lunatte.ps1
```

运行入口：

- 前端入口：`frontend/index.html`
- 样式入口：`frontend/styles.css`
- 逻辑入口：`frontend/script.js`
- 本地后端：`backend/server.py`
- 启动脚本：
  - `start-lunatte.bat`
  - `start-lunatte.ps1`

当前形态：

- CSS 仍是单文件 `styles.css`。
- JS 仍是单文件 `script.js`。
- 后端仍是单文件 `server.py`。
- `data/sessions/prototype` 是原型数据目录。
- 根目录记忆库索引、说明、路由文件都属于项目文件，V0.2 必须保留副本。

### 2.2 Antigravity 代码版本

路径：`D:\Antigravity\Lunette\memory-vault-starter`

审计结果：

- 存在。
- 约 224 个文件、90 个目录。
- 总大小约 1.366 GB。
- 是 git 仓库。
- 当前分支：`main`。
- 最近提交：`b908762 UI 重构进行中：CSS 模块化 + 自定义下拉框 + 主题切换`。
- 含未跟踪临时脚本：
  - `add_cors.py`
  - `add_listener.py`
  - `fix_html.py`
  - `update_fetches_safe.py`

4 层以内结构重点：

```text
memory-vault-starter/
  .git/
  .gitignore
  README.md
  core-design-principles.md
  self/
  gpt/
  gemini/
  shared/
  tools/
  sessions/
  frontend/
    lunatte-v0.2/
      index.html
      styles.css
      script.js
      server.py
      css/
        main.css
        variables.css
        reset.css
        components.css
        pages/
      apply_custom_select.py
      apply_generic_select.py
      fix.py
      fix_dropdown.py
      fix_profile.py
      fix_profile_panel.py
      test_select.html
      update_back.py
```

当前形态：

- CSS 已经部分拆分。
- `css/main.css` 会导入：
  - `variables.css`
  - `reset.css`
  - `../styles.css`
  - `components.css`
- 历史审计结论：当时 JS 没有真正模块化拆分，仍主要集中在 `script.js`；截至 2026-06-30，V0.2 已抽出 `shared/lunatte-core.js`。
- 历史审计结论：当时 `server.py` 没有真正拆分；截至 2026-06-30，V0.2 已抽出 `server_config.py` 和 `server_storage.py`。
- 没有稳定的 `apps/`、`packages/`、`src/components/`、`modules/` 架构。
- 包含当前 V0.1 的后续功能痕迹，也包含实验性 UI/refactor 内容。

### 2.3 Antigravity Project-Docs

路径：`D:\Antigravity\Lunette\Project-Docs`

审计结果：

- 存在。
- 约 26 个文件、4 个目录。
- 总大小约 1.10 MB。
- 是规划资料源，不是源码。

文档结构：

```text
Project-Docs/
  问题清单/
    current_status.md
    implementation_plan.md
    unresolved_issues.md
  问题改进方案/
    abyssal-letter-ui-overhaul.md
    autonomous-agent-integration.md
    backend-monolith-refactor.md
    blueprint-vs-pdf-gap-analysis.md
    data-structure-and-processing-analysis.md
    frontend-architecture-plan.md
    ui-design-concept.md
  ui模板/
    index.html
    album.html
    DEPLOY.md
    manifest.webmanifest
    sw.js
    *.png
    *.webp
    *.mp3
```

用途：

- 作为 V0.2 的规划资料导入到 `docs/imported-antigravity/`。
- 保留原文，不改写为源码。
- UI 模板只作为参考，不直接替换当前原型。

## 3. V0.1 与 Antigravity 代码差异摘要

同名但内容不同：

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/script.js`
- `backend/server.py`

同名且内容一致：

- 根 `README.md`
- `tools/README.md`
- `frontend/README.md`
- `start-lunatte.bat`
- `start-lunatte.ps1`

只存在于 Antigravity 的重点文件：

- `.gitignore`
- `core-design-principles.md`
- Antigravity 代码版本中的 `css/main.css`
- Antigravity 代码版本中的 `css/variables.css`
- Antigravity 代码版本中的 `css/reset.css`
- Antigravity 代码版本中的 `css/components.css`
- Antigravity 代码版本中的 `css/pages/`
- 多个一次性 patch/fix 脚本：
  - `apply_custom_select.py`
  - `apply_generic_select.py`
  - `fix.py`
  - `fix_dropdown.py`
  - `fix_profile.py`
  - `fix_profile_panel.py`
  - `update_back.py`
  - `add_cors.py`
  - `add_listener.py`
  - `fix_html.py`
  - `update_fetches_safe.py`

关键差异：

- V0.1 的 HTML 使用：

```html
<link rel="stylesheet" href="./styles.css?v=20260622-1037" />
```

- Antigravity 的 HTML 使用：

```html
<link rel="stylesheet" href="./css/main.css?v=20260624-1419" />
```

- Antigravity 中出现自定义下拉框相关代码：
  - `providerSelectWrapper`
  - `custom-select-*`
- Antigravity 中出现主题切换相关代码：
  - `themeSelection`
  - `data-theme`
- Antigravity 中有 profile 面板改动。
- Antigravity 中的 CORS/API_BASE_URL 主要出现在补丁脚本或计划文档里，不能直接视为稳定后端能力。

## 4. Antigravity 中值得保留或选择性合并的内容

可作为 patch source 的内容：

- CSS 拆分方式：
  - `css/main.css`
  - `css/variables.css`
  - `css/reset.css`
  - `css/components.css`
- 主题切换相关实现，可在 V0.2 中单独评估。
- 自定义下拉框样式和交互，可按当前手机 UI 风格筛选使用。
- profile 面板修正，可对照 V0.1 当前实现逐项合并。
- `core-design-principles.md` 可作为设计原则参考文档。
- Project-Docs 中的：
  - frontend architecture plan
  - backend monolith refactor
  - data structure and processing analysis
  - abyssal letter UI overhaul
  - autonomous agent integration

合并原则：

- 不整体覆盖 V0.2。
- 不运行 Antigravity 的一次性 patch 脚本。
- 每次只合并一个主题。
- 每次合并后跑静态检查。
- 每次合并前后保持 git commit，便于回滚。

## 5. Antigravity 中不能直接覆盖的内容

不能直接覆盖的内容：

- Antigravity 的 `index.html`。
- Antigravity 的 `styles.css`。
- Antigravity 的 `script.js`。
- Antigravity 的 `server.py`。
- Antigravity 的 `sessions/` 数据。
- Antigravity 的 patch/fix 脚本输出结果。

原因：

- Antigravity 代码与当前稳定 V0.1 hash 不一致。
- Antigravity 包含实验性 UI 重构，不保证和 V0.1 已测通功能一致。
- patch 脚本本身会写源码，不能在未审计时执行。
- Antigravity 的 CORS/API/远程部署改动未确认稳定。
- 当前 V0.1 已经有被测试通过的 Archive、Self、Moments、Timeline、Auto Reply 等链路，不能被实验代码覆盖。

## 6. 修正后的 V0.2 结构清理与独立工作区计划

V0.2 目标路径：

```text
D:\Aaa.项目\lunatte-v0.2
```

V0.2 初始原则：

- 以当前稳定 V0.1 作为运行基准。
- 不嵌套成 `lunette-v0.2/memory-vault-starter/...`。
- 直接保留当前记忆库根结构，便于和 V0.1 对比。
- Antigravity 代码版本只作为差异来源和 patch source。
- Project-Docs 只作为文档来源导入。
- V0.2 使用自己的 `data/sessions/prototype` 数据副本测试。
- V0.2 不直接写 V0.1 原始数据。

建议 V0.2 结构：

```text
lunette-v0.2/
  README.md
  .gitignore
  docs/
    lunette-v0.2-plan-reviewed.md
    imported-antigravity/
      问题清单/
      问题改进方案/
      ui模板/
  self/
  gpt/
  gemini/
  shared/
  tools/
  sessions/
    prototype/
  frontend/
    lunatte-v0.2/
      index.html
      styles.css
      script.js
      server.py
      README.md
      start-lunatte.bat
      start-lunatte.ps1
```

阶段计划：

### Phase 0：只读审计与差异报告

已完成。

产物：

- 三个目录审计。
- V0.1 与 Antigravity 差异摘要。
- V0.2 初始化策略。

### Phase 1：建立独立 V0.2 工作区

目标：

- 新建 `D:\Aaa.项目\lunatte-v0.2`。
- 从稳定 V0.1 复制全部当前项目内容。
- 导入 Project-Docs 到 `docs/imported-antigravity/`。
- 创建 V0.2 README、`.gitignore`、审计计划文档。
- 初始化 Git。

### Phase 2：选择性合并 Antigravity 的 CSS/JS/结构拆分

目标：

- 优先审计 Antigravity CSS 拆分。
- 如可用，先合并 `css/main.css`、`variables.css`、`reset.css`、`components.css` 的结构思路。
- 不重新拆一遍已经可复用的 CSS。
- JS 暂不强拆，先建立模块边界和命名方案。

### Phase 3：整理本地后端边界

目标：

- 保持 `server.py` 可运行。
- 梳理 API 边界、数据文件边界、外部模型调用边界。
- 不急着做云部署。

### Phase 4：SQLite + FTS5 草图

目标：

- 设计可查询、可回滚的数据结构。
- 原始 jsonl 先保留。
- SQLite/FTS5 作为索引层，不作为立即替换层。

### Phase 5：Abyssal Letter UI 翻新

目标：

- 根据导入文档中的 UI 方案翻新 Abyssal Letter。
- 保持现有功能链路可测。
- 不让 UI 翻新影响 Archive、Moments、Self、Timeline 的数据写入。

暂缓：

- React Native。
- Supabase。
- Cloudflare/VPS 正式部署。
- 后台自主唤醒调度器。

## 7. 数据安全规则

- V0.1 原目录不可删除、移动、覆盖。
- V0.1 的 `data/sessions/prototype` 不可直接写入。
- V0.2 必须使用复制后的 `D:\Aaa.项目\lunatte-v0.2\data\\sessions\\prototype` 测试。
- 原始导出文件保留本地副本。
- GitHub 不适合直接推送超过 100MB 的原始 zip；这类文件保留在本地工作区，可通过 `.gitignore` 排除出 Git。
- 记忆库索引、说明文档、路由脚本、结构文档属于项目文件，不能遗漏。
- 每个功能合并前先确认读写路径指向 V0.2，而不是 V0.1。

## 8. Antigravity patch source 说明

Antigravity 代码版本路径：

```text
D:\Antigravity\Lunette\memory-vault-starter
```

使用方式：

- 作为差异来源。
- 作为 patch source。
- 作为 CSS/JS/结构拆分参考。
- 作为可选择合并的代码来源。

禁止方式：

- 不得整体覆盖 V0.2。
- 不得直接复制 Antigravity 的 `sessions` 数据。
- 不得直接运行 Antigravity 里的 patch/fix 脚本。
- 不得在未对比时替换 V0.2 的 `index.html`、`styles.css`、`script.js`、`server.py`。

## 9. 下一步真正执行时的安全操作顺序

1. 在 V0.2 工作区确认 Git 状态干净。
2. 建立一个只用于 Antigravity 合并的分支或 commit 边界。
3. 先比较 Antigravity CSS 文件和 V0.2 当前 CSS。
4. 只引入 CSS 目录结构，不改变业务 JS。
5. 修改 HTML 样式入口前先确认缓存版本。
6. 跑静态检查：
   - `node --check frontend/script.js`
   - `python -m py_compile backend/server.py`
7. 启动 V0.2 本地服务测试，不占用长期隐藏服务。
8. 验证 Archive、Self、Moments、Timeline、Auto Reply 基础链路。
9. 确认数据写入 V0.2 的 `data/sessions/prototype` 副本。
10. 每完成一个合并主题就提交一次。

## 10. 当前执行结论

- V0.2 应从 `D:\A月亮啊\memory-vault-starter` 作为运行基准初始化。
- Antigravity 代码有可用内容，但只能选择性合并。
- Antigravity CSS 已经部分拆分。
- Antigravity JS 尚未真正拆分。
- Project-Docs 应导入到 `docs/imported-antigravity/`。
- 下一步可以进入 Phase 2：选择性合并 Antigravity 的 CSS 拆分。

## 11. V0.2 资料来源说明

V0.2 工作区内现在同时存在多类材料。它们不是同一种东西，不能混用角色。

### 11.1 V0.1 原始主线

来源：

- 根目录 `README.md`
- 根目录产品、路线图、记忆库、访问规则、检索规则相关文档
- `self/`
- `gpt/`
- `gemini/`
- `shared/`
- `tools/`

角色：

- 这是 Lunette / Stillgarden 的产品蓝图、记忆库设计、隔离规则、索引规则和路线图。
- 它不是“原型附属资料”，而是项目主线。
- 这些文件定义了林絮、噔噔、Aimas、self、shared、private、incoming 的关系边界。

处理规则：

- 必须纳入 V0.2。
- 不得因为前端重构而丢弃。
- 后续数据库、RAG、时间线和人格系统都要从这些边界继续生长。

### 11.2 当前可运行原型层

来源：

```text
frontend/
```

角色：

- 这是当前可以启动和测试的手机壳原型。
- `index.html`、`styles.css`、`script.js`、`server.py` 是当前能跑但臃肿的实现。
- 它证明 Archive、Self、Moments、Timeline、Auto Reply、Aimas Connector 等链路已经有可测闭环。
- 它不代表整个项目，只是项目当前可运行外壳和本地桥接层。

处理规则：

- 本轮不修改原型代码。
- 后续拆分 `styles.css`、`script.js`、`server.py` 时必须保持现有功能链路可测。
- 每次拆分必须有回滚点和测试清单。

### 11.3 Antigravity 代码版本

来源：

```text
D:\Antigravity\Lunette\memory-vault-starter
```

角色：

- 这是 AGY/Gemini 魔改过的代码版本。
- 它不是 V0.2 的运行基准。
- 它可以作为 patch source、差异来源和拆分参考。

处理规则：

- 禁止整体覆盖 V0.2。
- 禁止执行其中的补丁脚本。
- 禁止直接把 AGY 的 `index.html`、`styles.css`、`script.js`、`server.py` 替换进 V0.2。
- 只能按任务逐项审计、逐项 cherry-pick 思路或代码片段。

### 11.4 `docs/imported-antigravity/问题清单`

来源：

```text
docs/imported-antigravity/问题清单/
```

角色：

- 这是 CC 检查 AGY/Gemini 魔改版本后留下的问题清单。
- 它主要记录 AGY/Gemini 版本的已修内容、未验证内容、遗留 bug、部署风险和下次接手提示。
- 它不是 V0.2 已确认需求清单；需要经过 V0.2 过滤。

处理规则：

- 可作为问题来源。
- 不能直接照着改 V0.2。
- 涉及 Cloudflare/VPS/CORS 的内容进入暂缓或后端边界讨论，不作为当前本地 V0.2 优先任务。

### 11.5 `docs/imported-antigravity/问题改进方案`

来源：

```text
docs/imported-antigravity/问题改进方案/
```

角色：

- 这是用户人工检查 V0.1 和 AGY 版本后整理出的新问题、想法、解决方案和后续方向。
- 其中一部分尚未写回 V0.1 README 或 roadmap。
- 它是 V0.2 需要收编的规划资料。

处理规则：

- 需要归类进 V0.2 任务总表。
- 其中关于 React Native、Supabase、Cloudflare/VPS、后台调度器的内容暂缓。
- 其中关于视觉风格、代码拆分、数据结构、检索策略的内容可进入 V0.2 后续阶段。

### 11.6 `docs/imported-antigravity/ui模板`

来源：

```text
docs/imported-antigravity/ui模板/
```

角色：

- 这是看到好看的 UI 后，由 Gemini 扒来的 Tidal Echo / PWA 参考模板。
- 它不是 Lunette 源码。
- 它不能直接合并进 V0.2。

处理规则：

- 只作为视觉风格、布局、交互、PWA 形态和移动端手感参考。
- 不直接复制 `index.html`、`sw.js`、`manifest.webmanifest` 或图片资源到运行源码。
- 后续 UI 翻新时只提取原则：密度、材质、留白、导航层级、动效节奏、移动端结构。

## 12. V0.1 蓝图与当前可运行原型的关系

V0.1 根目录蓝图是项目主线，前端原型只是主线下的一个可运行验证层。

关系口径：

- 根目录文档定义“要做什么”和“边界是什么”。
- `frontend` 验证“当前哪些东西已经能点、能写、能看”。
- `data/sessions/prototype` 是原型数据副本，不是最终数据库。
- `tools/` 里的检索脚本是本地记忆能力的早期实现，不是最终后端架构。
- `gpt/`、`gemini/`、`self/`、`shared/` 是长期记忆和权限体系，不是 UI 附件。

当前重要结论：

- V0.2 不能只围绕 `frontend` 重构。
- 前端拆分、后端拆分、数据库草图都必须保护根目录记忆库规则。
- 后续 RAG 不是把旧记录灌给模型模仿，而是把记忆、证据、时间线和权限作为可参考背景。
- 最终目标不是聊天人格、评论人格、发圈人格分裂，而是同一住户系统通过不同入口回应。

## 13. AGY/Gemini 魔改版本问题摘要

AGY/Gemini 版本已做过一些 UI 重构尝试，但目前只能作为问题来源和 patch source。

已看到的可参考改动：

- CSS 部分模块化：`css/main.css`、`variables.css`、`reset.css`、`components.css`。
- 主题切换：localStorage + `data-theme`。
- 模型供应商下拉框改为自定义组件。
- profile 面板返回逻辑和打开逻辑修正。
- Archive 下拉框升级曾经可用。

主要问题：

- CSS 处于“单体 `styles.css` + 新 `css/` 目录”并存状态，容易产生层叠冲突。
- 自定义下拉框在折叠面板里可能被 `overflow` 裁剪。
- 部分 select 未升级或升级时机不稳定。
- Wake 按钮高度仍有不一致风险。
- Cloudflare Pages + VPS 后端方案涉及 CORS、API_BASE_URL 和鉴权风险，不能在本地 V0.2 阶段直接推进。
- AGY 的补丁脚本有写源码行为，不能执行。

V0.2 处理结论：

- 可吸收“拆分方向”和少量已验证实现思路。
- 不吸收未经验证的整套代码。
- 不把远程部署方案前置。

## 14. CC 问题清单摘要

来源：

- `docs/imported-antigravity/问题清单/current_status.md`
- `docs/imported-antigravity/问题清单/implementation_plan.md`
- `docs/imported-antigravity/问题清单/unresolved_issues.md`

可收编的问题：

- 自定义下拉框在 Wake / Moments 折叠面板内无法展开。
- Wake 两个操作按钮高度不一致。
- provider 下拉框在折叠或布局状态下可能不可见。
- 部分聊天/时间线/路由 select 未统一样式。
- Cloudflare Pages 前端无法连接 VPS 后端：前端 API 路径写死、后端缺 CORS。
- 公网后端暴露会带来数据读取风险，必须先有鉴权策略。

状态判断：

- UI 下拉框和按钮问题：有问题需修，但必须先在 V0.2 当前运行基准复现。
- 云端部署/CORS：暂缓。
- API_BASE_URL：后续后端边界阶段讨论，不作为第一批任务。
- AGY 已修项：仅作为参考，不直接合并。

## 15. 用户人工改进方案摘要

来源：

- `abyssal-letter-ui-overhaul.md`
- `autonomous-agent-integration.md`
- `backend-monolith-refactor.md`
- `blueprint-vs-pdf-gap-analysis.md`
- `data-structure-and-processing-analysis.md`
- `frontend-architecture-plan.md`
- `ui-design-concept.md`

可收编方向：

- UI 翻新：降低幼态感，减少厚重阴影和大圆角，提升文字密度、纸感、磨砂质感、细线分割、移动端精致感。
- 前端架构：`styles.css` 和 `script.js` 都需要分阶段拆分，但必须先建边界和测试清单。
- 后端架构：`server.py` 单体过重，后续考虑路由、模型调用、记忆检索、资产管理分层。
- 数据结构：JSONL/CSV 先保留为原始记录和回滚基础；后续用 SQLite + FTS5 做索引层，再评估向量库。
- 时间标准化：时间线、热力图、RAG 和事件聚合需要稳定 timestamp / ISO 时间。
- 自主唤醒：作为长期方向，先保留“醒醒收件箱”和候选确认，不做后台自主调度器。
- 真 App / Supabase / React Native：作为长期路线，不进入当前 V0.2 第一批执行。

需要纠偏的点：

- 不把 V0.1 根目录蓝图降级为“愿望清单”。
- 不把纯本地 JSONL 直接废弃；它们是当前可追溯记录和迁移源。
- 不把 Supabase / 云端同步作为当前默认路线。
- 不为了 UI 好看直接替换当前原型。

## 16. UI 模板的正确用途

`docs/imported-antigravity/ui模板` 是视觉和交互参考，不是源码来源。

可以参考：

- 移动端单页壳结构。
- 菜单层级、设置页密度、聊天页排版。
- PWA / service worker / manifest 的文档经验。
- 主题变量和材质感。
- 轻量交互组件，例如胶囊、分段控件、通话浮层。

不能做：

- 不能直接把模板 `index.html` 合并到 Lunette。
- 不能直接复制模板的 `sw.js` 或 `manifest.webmanifest` 作为当前运行代码。
- 不能把 Tidal Echo 的后端契约当成 Lunette 的后端契约。
- 不能把模板中的占位功能误认为 Lunette 已有功能。

## 17. V0.2 后续开发任务总表

| 任务 | 来源 | 状态 | 说明 |
|---|---|---|---|
| 保护 V0.1 根目录蓝图、记忆库索引、隔离规则 | V0.1 蓝图 | 已完成 | 已复制进 V0.2，后续改动必须继续保护 |
| 保持当前原型可启动 | 当前可运行原型 | 已完成 | `frontend` 是当前运行基准 |
| Archive 正式记忆卡、确认记忆列表 | 当前可运行原型 | 已完成 | 已写入 `confirmed-memory.jsonl` 副本 |
| Self 总开关和三子开关 | 当前可运行原型 | 已完成 | 请求包按开关带入 self |
| Moments 手动真实评论 | 当前可运行原型 | 已完成 | 三个住户可反复触发 |
| Moments 自动评论候选确认链路 | 当前可运行原型 | 半完成 | 有候选和确认，缺后台自动触发器 |
| Timeline 只读聚合查看 | 当前可运行原型 | 半完成 | 有分页、筛选、展开；仍是草稿层 |
| 确认记忆编辑/撤回/删除/审计 | V0.1 蓝图 | 后续功能 | Archive 下一批高价值任务 |
| 请求包 UI 化预览 | V0.1 蓝图 | 后续功能 | 当前仍偏文本/调试口径 |
| 聊天搜索空状态、分页、跳转定位优化 | V0.1 蓝图 / 当前可运行原型 | 后续功能 | 低风险小修池 |
| CSS 模块化拆分 | 用户人工改进方案 / AGY/Gemini 问题 | 后续功能 | 先审计边界，不本轮执行 |
| JS 模块化拆分 | 用户人工改进方案 | 后续功能 | 需要先列模块边界 |
| `server.py` 后端边界整理 | 用户人工改进方案 | 后续功能 | 不急着 FastAPI，先理 API 和数据边界 |
| AGY 自定义下拉框代码 | AGY/Gemini 问题 / CC 问题清单 | 禁止直接合并 | 可参考问题和思路，不能直接套 |
| AGY 主题切换代码 | AGY/Gemini 问题 | 禁止直接合并 | 需先确认是否符合当前 UI 方向 |
| Wake / Moments 下拉框展开问题 | CC 问题清单 | 有问题需修 | 先在 V0.2 当前代码复现 |
| Wake 按钮高度不齐 | CC 问题清单 | 有问题需修 | 先在 V0.2 当前代码复现 |
| Cloudflare/VPS CORS 和 API_BASE_URL | CC 问题清单 | 暂缓 | 需要鉴权和部署边界，不进入第一批 |
| SQLite + FTS5 索引草图 | V0.1 蓝图 / 用户人工改进方案 | 后续功能 | 先草图，不迁移原始 JSONL |
| 向量库 / RAG | V0.1 蓝图 / 用户人工改进方案 | 后续功能 | 必须保护“记忆是背景，不是表演”的原则 |
| 时间标准化和事件 schema | 当前可运行原型 / 用户人工改进方案 | 后续功能 | Timeline、SQLite、RAG 前置条件 |
| UI 模板风格吸收 | UI模板参考 / 用户人工改进方案 | 后续功能 | 只吸收视觉原则，不合并源码 |
| Abyssal Letter UI 翻新 | 用户人工改进方案 / UI模板参考 | 后续功能 | 应在结构边界更清楚后进行 |
| 自主唤醒后台调度器 | 用户人工改进方案 | 暂缓 | 先保留候选确认和收件箱 |
| React Native 真 App | 用户人工改进方案 | 暂缓 | 不进入 V0.2 本地阶段 |
| Supabase 云数据库 | 用户人工改进方案 | 暂缓 | 与当前本地隐私路线冲突，后续再评估 |
| 直接合并 `docs/imported-antigravity/ui模板` | UI模板参考 | 禁止直接合并 | 模板不是 Lunette 源码 |
| 执行 AGY patch/fix 脚本 | AGY/Gemini 问题 | 禁止直接合并 | 脚本会写源码，风险不可控 |

## 18. 第一批真正要执行的任务队列

本队列只定义下一轮真正执行的前置任务，完整细节见 `docs/v0.2-next-actions.md`。

1. 建立 V0.2 基线验证清单：确认当前原型能启动，关键链路仍可测。
2. 梳理 CSS 拆分边界，不改样式：列出 `styles.css` 可拆区块和 AGY CSS 可参考点。
3. 梳理 JS 模块边界，不改逻辑：列出 `script.js` 的状态、API、渲染、事件、数据写入模块。
4. 设计 SQLite + FTS5 事件索引草图：基于当前 `/api/timeline` 事件格式，不迁移数据。
5. Archive 确认记忆的编辑/撤回/删除/审计方案：先做数据模型和 UI 入口设计，不直接改代码。

第一批不做：

- 不做 CSS 拆分落地。
- 不做 JS 拆分落地。
- 不改 `server.py`。
- 不执行 AGY 补丁脚本。
- 不合并 UI 模板源码。
- 不碰真实 V0.1 数据。
