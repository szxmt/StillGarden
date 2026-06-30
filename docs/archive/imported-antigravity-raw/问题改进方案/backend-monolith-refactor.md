# 后端与前端逻辑单体大拆分方案 (Backend & Frontend Monolith Refactor)

> 本文档基于对 `memory-vault-starter` 目录的深度扫描（Deep Scan）得出，旨在解决极度膨胀的单体代码问题。

## 1. 深度扫描发现的最致命问题

通过遍历分析，我们发现了整个项目中最危险的几个“巨石文件”，以及一些过于臃肿的工具脚本：
- `frontend/stillgarden-prototype-v0.1/script.js` (体积高达 185KB)
- `frontend/stillgarden-prototype-v0.1/server.py` (体积高达 116KB)
- `tools/memory_search.py` (高达 14KB)
- `tools/memory_route.py` 等一系列本该属于后端的独立分散脚本。

在现代软件工程中，这种体量的单文件意味着：**极高的维护成本、牵一发而动全身的 Bug 率、以及协作开发的灾难。**

### 关于 `server.py` 与 `tools` 的架构痛点
当前后端采用了 Python 最原始的 `http.server`，而许多核心逻辑（如记忆检索、路由）又散落在 `tools/` 目录里的各个独立脚本中。
- **痛点**：所有的 API 路由（如 `/api/chat`, `/api/memory`）全是用极其丑陋的 `if/elif` 分支强行塞在 `do_GET` 和 `do_POST` 方法里的。外部工具调用松散且容易引发进程死锁。
- **改进方案**：引入 **FastAPI** 框架，将 `tools/` 里的脚本彻底吸收到服务端核心业务中。
  - **拆分逻辑**：
    - `main.py`：应用入口，仅负责启动和跨域配置（CORS）。
    - `api/routes_chat.py`：专门处理聊天相关的接口。
    - `api/routes_memory.py`：专门处理记忆存档、检索相关的接口（原本的 `memory_search.py` 将被重构后合并至此）。
    - `core/llm_engine.py`：封装所有与 Gemini / GPT 交互的代码，解耦业务逻辑与模型通信。

### 关于 `script.js` 的架构痛点
近 200KB 的原生 JavaScript，包含了所有的 DOM 操作、网络请求和状态管理。
- **改进方案**：引入 ES6 Modules，构建现代化前端结构。
  - `src/api.js`：封装所有 `fetch` 请求，统一处理错误和 URL 前缀。
  - `src/store.js`：单向数据流管理，统一管理当前的聊天上下文和用户偏好。
  - `src/ui/chat.js`：仅负责聊天气泡的渲染和动画滚动。
  - `src/ui/panels.js`：负责侧边栏、下拉框、记忆热力图的展开与交互。

## 2. 结论
在进行接下来的华丽 UI 改版（Abyssal Letter）之前，我们**必须（强烈建议）**先完成代码底层的模块化拆分。否则，在庞大的屎山上继续盖城堡，随时会轰然倒塌。
