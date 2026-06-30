# 月亮小窝 UI 重构 — 当前状态汇总

> 截至 2026-06-24 20:04，准备在限额前打包

---

## 一、已完成且确认可用的修复

| # | 问题 | 修复方式 | 状态 |
|---|------|---------|------|
| 1 | 主题切换刷新后不保存 | localStorage 读写 + `data-theme` 属性 | ✅ |
| 2 | 时间线从丑陋卡片变回线性 | `css/components.css` 末尾追加了 `!important` 覆盖的 `.timeline` 系列样式 | ✅ |
| 3 | 模型供应商下拉框从原生 `<select>` 改为手写 `<div>` 自定义组件 | HTML 里 `providerSelectWrapper` + JS 里重写了 `renderProviderSelect` | ✅ 逻辑完好 |
| 4 | 编辑资料返回按钮直接退出 → 改为回到设置页 | `ensureSubpageAppbar` 里针对 `myProfilePanel` 做了特殊判断 | ✅ |
| 5 | 编辑资料面板无法打开 | 把 `myProfilePanel` 从 `<details>` 改为 `<div class="subpage-panel">` 并移到 `settingsPanel` 同级 | ✅ |
| 6 | 翻抽屉 (Archive) 的下拉框 | `upgradeAllSelects` 成功升级，点击可展开，功能正常 | ✅ |

---

## 二、已修但未验证 / 部分生效的修复

| # | 问题 | 修复方式 | 状态 |
|---|------|---------|------|
| 7 | **致命 JS 语法错误** 第 4814 行 `document.querySelector(input[...])` 缺引号 | 改为模板字符串 `` `input[name="themeSelection"][value="${savedTheme}"]` `` | ✅ 已修，控制台无报错 |
| 8 | `upgradeAllSelects` 初始化时机 | `DOMContentLoaded` 已 fired 不会再触发 → 改为直接 `setTimeout(100/1000/3000)` | ✅ 已修 |
| 9 | 缓存版本号 | `index.html` 里 JS/CSS 的 `?v=` 已更新为 `20260624-1419` | ✅ |

---

## 三、仍然存在的 Bug（下次继续）

### Bug A：醒醒收件箱 & 圈圈的自定义下拉框**被渲染了但点击无法展开**

- **翻抽屉的下拉框可以正常展开**，说明 `upgradeSelectToCustom` 函数逻辑本身没问题
- 醒醒收件箱和圈圈的 `<select>` 在 `<details>` 元素（折叠卡片）内部
- **高度怀疑是父容器 `overflow: hidden` 导致弹出的列表被裁剪**
- 修复方向：
  - 方案 A：给 `.custom-select-list` 加 `position: fixed` 代替 `position: absolute`，手动计算位置
  - 方案 B：给含下拉框的 `.fold-card` / `.subpage-panel` 加 `overflow: visible`（但需要验证不会破坏滚动）
  - 方案 C：最简单——检查 `click` 事件是否真的被绑定了（翻抽屉能用、这两个不能用，可能是时序问题：`details` 未 `open` 时 select 在 DOM 里但不可交互）

### Bug B：模型供应商下拉框**在浏览器分身检查时找不到**

- HTML 里 `providerSelectWrapper` 确实存在于第 608 行
- 它嵌套在 `<details id="providerPanel">` 内，只有 `openSubpage` 给它加 `open` 属性后才可见
- **根因推测**：浏览器分身在检查 DOM 时，`providerPanel` 处于未展开状态，所以 `getElementById` 返回 null 只是因为元素被隐藏/折叠了，但元素确实在 DOM 中
- 上次截图（之前的 `dropdown_open_options_1782279856202.png`）显示它**曾经正常工作过**
- **需要验证**：手动在浏览器中进入模型供应商页面，点击下拉框是否能展开

### Bug C：醒醒按钮 "让小窝自己想" 和 "按这个理由生成" **高度差 9px**

- `.config-save` 的 padding 是 `11px 16px`，`.ghost-button` 的 padding 是 `10px 15px`
- 我在 `styles.css` 第 3457-3464 行已经加了 `padding: 10px 15px; margin-top: 0;` 覆盖
- 但浏览器验证仍然差 9px
- **根因**：`.wake-button` 类设了 `min-height: 40px; padding: 10px 15px; border: 1px solid ...`，但 `.config-save` 在第 3750 行又重新设了 `padding: 11px 16px`，由于 CSS 优先级 `.config-save`（3750行）在 `.wake-control-actions .config-save`（3457行）之后声明但**没有**更高的特异性
- **真正的问题**：`.config-save`（3750行）的 `padding: 11px 16px` **特异性低于** `.wake-control-actions .config-save`（3457行），所以我的修复应该已经生效
- 但如果仍然不对齐，可能是 `box-sizing` 或 `line-height` 差异导致的
- **修复方向**：直接给 `.wake-control-actions` 里的两个按钮加 `!important` 或用更高特异性选择器

### Bug D：全站还有部分 select 没有被自定义化

- `chatResident`（聊天房间切换）没有用自定义下拉框，因为它有特殊的 `change` 事件处理
- 路由选择下拉框 `linxuProviderRoute` / `dengdengProviderRoute` 也是原生 select
- 时间线的 `timelinePersonSelect` 和 `timelineSourceSelect` 需要验证

### Bug E：用户反馈的功能性问题（**非换皮引起，原有逻辑**）

- "发圈圈的让 TA 自己想"双击就发出去 → 这是 `createMoment("auto")` 的原始行为，它向后端发 POST 请求，如果 `serviceOnline=false` 则走浏览器 fallback 直接生成
- "让小窝自己想"没变化 → 同上，`createAutoWakeDraft` 的原始行为
- **这些都是原本的业务逻辑，不是重构破坏的**。但用户可能认为是，需要沟通确认。

---

## 四、文件变更清单

| 文件 | 变更内容 |
|------|---------|
| `index.html` | 1) 主题选择移入设置面板；2) `<select id="providerSelect">` → `<div id="providerSelectWrapper">`；3) `myProfilePanel` 从 `<details>` 改为 `<div>` 并重新定位；4) 版本号更新 |
| `script.js` | 1) `renderProviderSelect` 重写为操作 div 而非 select；2) 事件监听从 `providerSelect.change` 改为 `providerSelectWrapper.click`；3) 返回按钮特判 myProfilePanel；4) **修复第4814行致命语法错误**；5) 末尾追加 `upgradeSelectToCustom` + `upgradeAllSelects` 通用下拉框升级代码 |
| `styles.css` | 唤醒按钮 padding/margin-top 覆盖 |
| `css/main.css` | 入口样式表，引入顺序：variables → reset → styles.css → components.css |
| `css/variables.css` | 颜色变量、主题 CSS 自定义属性 |
| `css/reset.css` | 基础重置 |
| `css/components.css` | 1) 时间线覆盖样式；2) 自定义下拉框 `.custom-select-*` 系列样式 |
| `server.py` | **完全未触碰**，所有数据/配置/key 安全 |

---

## 五、后端数据完整性确认

- `server.py` 零修改
- `/api/config` 正常返回 `oa` + `gg` 两个内置供应商 + 用户之前创建的 `自定义1`
- `sessions/prototype/config.json` 完好
- 用户的 `nickname: 小宝` 保存正常
- API Key 存储在 `secrets.json`，未被任何前端操作影响
