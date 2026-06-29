# 前端架构与重构计划 (Frontend Refactoring Plan)

## 调研结论与存在的问题 (基于源码分析)

通过查阅 `stillgarden-prototype-v0.1` 源码以及 `unresolved_issues.md` (遗留问题清单)，我发现当前前端架构存在严重的“巨石单体 (Monolith)”问题，这直接导致了样式冲突和维护困难。

### 1. CSS 骨架与逻辑混乱
- **双重样式表问题**：根目录下存在一个极其庞大、高达 4000 多行的 `styles.css` (77KB)，但同时又存在一个 `css/` 目录（内含 `components.css`, `variables.css` 等）。这种“一边写模块，一边写单体”的做法，会导致极大的层叠冲突。
- **与问题清单核对**：
  - 清单中提到的“两个按钮高度不对齐”问题，根本原因就是 `styles.css` 中的样式特异性覆盖了 `components.css` 中的统一样式。
  - 清单中提到的“自定义下拉框被遮挡”，暴露出布局骨架问题：过度滥用了 `overflow: hidden`，缺乏统一的层级（`z-index`）和弹窗池（Portal）管理。

### 2. 文件体积过大 (JavaScript 单体灾难)
- **核心文件过载**：`script.js` 高达 185KB！对于纯手写的 Vanilla JS 项目，这是一个极其危险的体量。所有的 API 请求、DOM 操作、状态管理全塞在一个文件里，后续如果做新版 UI 必将牵一发而动全身。

---

## 拆分与重构方案 (不改动当前代码，仅做蓝图规划)

### 阶段 1：CSS 模块化彻底拆分 (化整为零)
彻底废弃根目录的 `styles.css`，采用 BEM（Block Element Modifier）架构或按功能归类，将 `css/` 目录重构为：
- `css/base/` (基础层)
  - `variables.css` (仅存放我们在 UI 设计草案里定的颜色、极小字号、细边框变量)
  - `reset.css`
- `css/layout/` (骨架层)
  - `grid.css` (解决折叠面板和下拉框遮挡的层级问题)
  - `sidebar.css`
- `css/components/` (组件层)
  - `buttons.css` (解决按钮高度不齐的历史包袱)
  - `chat-bubble.css` (落实新版的高密度、无大圆角阴影的聊天气泡)
  - `dropdowns.css` (修复被隐藏的下拉框问题)

### 阶段 2：JavaScript 模块化拆分 (ES6 Modules)
将巨大的 `script.js` 按职责拆分为多个 ES6 模块：
- `js/api/`：统一处理 Fetch 请求，解决问题清单中“绝对路径 vs 相对路径”的云端部署 Bug。
- `js/ui/`：负责所有的交互动效、下拉框点击展开逻辑。
- `js/state/`：管理当前的记忆、对话记录。
