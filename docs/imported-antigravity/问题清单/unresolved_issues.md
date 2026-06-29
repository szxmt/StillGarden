# 遗留问题与 Bug 清单 (Issue Tracker)

> 本清单记录了目前项目中遗留的未解决问题。基于你保护代码库安全的要求，目前已停止一切代码修改。所有代码已安全回滚至之前推送到 GitHub 的完好状态。你可以根据此清单在后续自行修复。

---

## 一、UI 与样式 Bug

### 1. 醒醒收件箱 & 圈圈：自定义下拉框点击无法展开
- **所在位置**：`index.html` 中的 `<details id="wakePanel">` (醒醒收件箱) 和 `<details id="momentsPanel">` (圈圈面板)。
- **表现**：原生 `<select>` 已经被成功替换成了自定义的 `<div>` 样式，但在点击下拉框时，选项列表没有弹出来。
- **根本原因排查思路**：
  - 这两个面板都使用了折叠卡片（`.fold-card` 或 `.subpage-panel`）。
  - 这些父级容器在 CSS 中可能设置了 `overflow: hidden` 或 `overflow: hidden auto`。
  - 自定义下拉框的列表 (`.custom-select-list`) 是通过 `position: absolute` 定位的。当父容器超出隐藏时，弹出的列表被裁切掉了。
- **建议修复方案**：排查 `css/components.css` 中对应的父级容器，或者将下拉列表的交互改为 fixed 定位配合 JS 计算位置。

### 2. 醒醒收件箱：两个操作按钮高度不对齐（差 9px）
- **所在位置**：`index.html` 第 586-587 行，"让小窝自己想" 和 "按这个理由生成" 两个按钮。
- **表现**：两个按钮水平排列时，高度不一致。
- **根本原因排查思路**：
  - "按这个理由生成" 使用了 `.ghost-button` 类（`padding: 10px 15px`）。
  - "让小窝自己想" 使用了 `.config-save` 类（`padding: 11px 16px`）。
  - 虽然它们都有 `.wake-button` 类试图统一高度（`min-height: 40px`），但 `.config-save` 在 `styles.css` 靠后位置声明，覆盖了统一的 padding。
- **建议修复方案**：在 `css/components.css` 中用高特异性选择器强制统一这两个按钮的 `box-sizing`、`padding` 和 `line-height`。

### 3. 模型供应商：下拉框在某些情况下不显示
- **所在位置**：`index.html` 第 602 行 `<details id="providerPanel">`。
- **表现**：在部分浏览器测试中，点击展开“模型供应商”面板时，顶部的下拉框元素（`#providerSelectWrapper`）不可见。
- **根本原因排查思路**：
  - 该元素实际上在 DOM 中是存在的，但在 `<details>` 的展开动画或者 flex 布局中，可能被挤出可视区域，或者 `display: none` 状态没有被正确清除。

### 4. 聊天界面：部分下拉框遗漏了自定义样式
- **所在位置**：`index.html` 中的聊天房间切换 (`#chatResident`)。
- **表现**：依然是原生的系统丑陋下拉框。
- **根本原因排查思路**：
  - 自动升级脚本 (`upgradeAllSelects`) 可能在这些动态生成的元素渲染之前就已经执行完毕，导致它们被遗漏。

---

## 二、架构与部署分离相关遗留问题

### 5. Cloudflare Pages 无法连接韩国 VPS 的 Python 后端
- **所在位置**：全局 `script.js` 以及后端的 `server.py`。
- **表现**：部署到 Cloudflare 上的前端完全变成了无数据的“静态空壳”。
- **根本原因排查思路**：
  - **前端写死路径**：`script.js` 中有 30 多处使用了类似 `fetch("/api/config")` 的相对路径。在 CF Pages 上运行时，它会向 `https://你的CF域名.pages.dev/api/...` 发起请求，导致 404。
  - **后端无跨域许可 (CORS)**：即便前端改成了绝对路径，云服务器上的 Python 后台目前没有配置跨域请求头（没有处理 `OPTIONS` 预检，也没有返回 `Access-Control-Allow-Origin`）。浏览器会出于安全机制拦截请求。
- **建议修复方案**：
  - 前端增加统一的 `API_BASE_URL` 配置选项，通过本地缓存读取。
  - 后端需要在 `server.py` 内部彻底重构 Header 响应部分，增加对跨域的全面支持。
  - **警告**：修改此处极易引发连锁 Bug，建议先本地全面跑通再上云。
