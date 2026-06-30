# 后端云服务器搬家及前后端分离计划

为了让部署在 Cloudflare Pages 的纯前端页面能够顺利与你部署在韩国云服务器（VPS）上的 Python 核心数据库进行通信，我们需要对代码进行**跨域支持（CORS）改造**和**接口地址解耦**。

## User Review Required

> [!WARNING]
> 后端搬迁到公网后，你的 Python 数据库接口将暴露在互联网上。目前的 `server.py` 没有强健的身份验证机制（Prototype 阶段特性）。在公网暴露存在一定的数据被他人读取的风险。如果非常在意隐私，建议后续在后端增加简单的鉴权 Token 或在 Caddy 层配置 Basic Auth。

## Proposed Changes

### 后端 API (server.py)

为了允许 Cloudflare Pages (HTTPS) 请求你的 VPS API，后端必须明确返回跨域允许请求头。

#### [MODIFY] [server.py](file:///d:/A月亮啊 - agy/memory-vault-starter/frontend/stillgarden-prototype-v0.1/server.py)
- **拦截 OPTIONS 预检请求**：新增 `do_OPTIONS` 方法，直接返回 `200 OK`，并附带 CORS 必需的 Headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`)。
- **全局 Header 注入**：修改现有的 `end_headers` 拦截器，在所有 `/api/` 路由的返回中自动注入 `Access-Control-Allow-Origin: *` 和 `Access-Control-Allow-Headers: Content-Type` 等允许头。

### 前端 UI (index.html & script.js)

前端必须能知道它应该往哪里发请求，而不是死板地往当前域名（`/api/...`）发。

#### [MODIFY] [index.html](file:///d:/A月亮啊 - agy/memory-vault-starter/frontend/stillgarden-prototype-v0.1/index.html)
- 在“设置”页面的底部（高级设置区域）新增一个输入框：**「远程核心地址 (Backend API URL)」**。

#### [MODIFY] [script.js](file:///d:/A月亮啊 - agy/memory-vault-starter/frontend/stillgarden-prototype-v0.1/script.js)
- 增加全局逻辑，启动时从 `localStorage.getItem("stillgarden_backend_url")` 读取 API 根地址。如果为空，则默认留空（即 localhost 同源模式）。
- 批量替换所有 `fetch("/api/...")` 为 `fetch(getApiBaseUrl() + "/api/...")`。
- 监听「远程核心地址」输入框的保存事件，更新缓存并刷新数据。

---

## 你的服务器搬家指南 (Caddy 部署参考)

在你批准并等我改完代码后，你在韩国服务器上需要做这几步：

1. **上传核心**：把整个项目（包含 `sessions/` 文件夹和 `server.py`）传到服务器。
2. **运行后端**：在服务器上运行 `python3 server.py --port 8877`（可以用 `tmux` 或写个 systemd 服务让它后台运行）。
3. **配置 Caddy**：你的 Caddyfile 只需要加这么一段反向代理，Caddy 会自动帮你搞定 HTTPS 证书：

```caddyfile
# 把 api.yourdomain.com 换成你的韩国服务器域名
api.yourdomain.com {
    reverse_proxy 127.0.0.1:8877
}
```

配置好后，只需打开你的 Cloudflare 网页，在设置里填入 `https://api.yourdomain.com`，天涯海角你的数据都跟随着你！
