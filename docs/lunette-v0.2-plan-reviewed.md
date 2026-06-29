# Lunette V0.2 Reviewed Initialization Plan

更新时间：2026-06-29  
状态：已完成只读审计，V0.2 进入独立工作区初始化阶段。

## 1. 审计摘要

本次审计确认了三个目录的角色：

- 当前稳定 V0.1：`D:\A月亮啊\memory-vault-starter`
- Antigravity 代码版本：`D:\Antigravity\Lunette\memory-vault-starter`
- Antigravity 规划文档：`D:\Antigravity\Lunette\Project-Docs`

结论：

- 当前稳定 V0.1 是唯一运行基准，不能删除、移动、覆盖，也不能直接改动原始 `sessions/prototype`。
- Antigravity 代码版本和当前 V0.1 内容不同，不能作为覆盖源。
- Antigravity 代码版本仍然有价值：它包含 CSS 拆分、主题切换、自定义下拉框、profile 面板修正和一些临时补丁脚本，可作为 patch source。
- Project-Docs 是规划资料源，应该导入 V0.2 的 `docs/imported-antigravity/`，但不能当源码执行。
- V0.2 应建立为独立工作区：`D:\A月亮啊\lunette-v0.2`。
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
    stillgarden-prototype-v0.1/
      index.html
      styles.css
      script.js
      server.py
      README.md
      start-stillgarden.bat
      start-stillgarden.ps1
```

运行入口：

- 前端入口：`frontend/stillgarden-prototype-v0.1/index.html`
- 样式入口：`frontend/stillgarden-prototype-v0.1/styles.css`
- 逻辑入口：`frontend/stillgarden-prototype-v0.1/script.js`
- 本地后端：`frontend/stillgarden-prototype-v0.1/server.py`
- 启动脚本：
  - `frontend/stillgarden-prototype-v0.1/start-stillgarden.bat`
  - `frontend/stillgarden-prototype-v0.1/start-stillgarden.ps1`

当前形态：

- CSS 仍是单文件 `styles.css`。
- JS 仍是单文件 `script.js`。
- 后端仍是单文件 `server.py`。
- `sessions/prototype` 是原型数据目录。
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
    stillgarden-prototype-v0.1/
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
- JS 没有真正模块化拆分，仍主要集中在 `script.js`。
- `server.py` 没有真正拆分。
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

- `frontend/stillgarden-prototype-v0.1/index.html`
- `frontend/stillgarden-prototype-v0.1/styles.css`
- `frontend/stillgarden-prototype-v0.1/script.js`
- `frontend/stillgarden-prototype-v0.1/server.py`

同名且内容一致：

- 根 `README.md`
- `tools/README.md`
- `frontend/stillgarden-prototype-v0.1/README.md`
- `frontend/stillgarden-prototype-v0.1/start-stillgarden.bat`
- `frontend/stillgarden-prototype-v0.1/start-stillgarden.ps1`

只存在于 Antigravity 的重点文件：

- `.gitignore`
- `core-design-principles.md`
- `frontend/stillgarden-prototype-v0.1/css/main.css`
- `frontend/stillgarden-prototype-v0.1/css/variables.css`
- `frontend/stillgarden-prototype-v0.1/css/reset.css`
- `frontend/stillgarden-prototype-v0.1/css/components.css`
- `frontend/stillgarden-prototype-v0.1/css/pages/`
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
D:\A月亮啊\lunette-v0.2
```

V0.2 初始原则：

- 以当前稳定 V0.1 作为运行基准。
- 不嵌套成 `lunette-v0.2/memory-vault-starter/...`。
- 直接保留当前记忆库根结构，便于和 V0.1 对比。
- Antigravity 代码版本只作为差异来源和 patch source。
- Project-Docs 只作为文档来源导入。
- V0.2 使用自己的 `sessions/prototype` 数据副本测试。
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
    stillgarden-prototype-v0.1/
      index.html
      styles.css
      script.js
      server.py
      README.md
      start-stillgarden.bat
      start-stillgarden.ps1
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

- 新建 `D:\A月亮啊\lunette-v0.2`。
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
- V0.1 的 `sessions/prototype` 不可直接写入。
- V0.2 必须使用复制后的 `D:\A月亮啊\lunette-v0.2\sessions\prototype` 测试。
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
   - `node --check frontend/stillgarden-prototype-v0.1/script.js`
   - `python -m py_compile frontend/stillgarden-prototype-v0.1/server.py`
7. 启动 V0.2 本地服务测试，不占用长期隐藏服务。
8. 验证 Archive、Self、Moments、Timeline、Auto Reply 基础链路。
9. 确认数据写入 V0.2 的 `sessions/prototype` 副本。
10. 每完成一个合并主题就提交一次。

## 10. 当前执行结论

- V0.2 应从 `D:\A月亮啊\memory-vault-starter` 作为运行基准初始化。
- Antigravity 代码有可用内容，但只能选择性合并。
- Antigravity CSS 已经部分拆分。
- Antigravity JS 尚未真正拆分。
- Project-Docs 应导入到 `docs/imported-antigravity/`。
- 下一步可以进入 Phase 2：选择性合并 Antigravity 的 CSS 拆分。
