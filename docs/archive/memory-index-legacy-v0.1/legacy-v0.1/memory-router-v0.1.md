# 本地记忆检索入口 v0.1

这个入口暂时只是本地规则工具，不联网、不调用 API。

## 它能做什么

- 判断你要和 Alice / 林絮、噔噔，还是普通 AI 对话。
- 列出这次应该读取的文件。
- 列出禁止读取的文件。
- 标出 `self/` 是否需要你明确允许。
- 给出统一的记忆调用提示。

## 使用方式

在记忆库根目录运行：

```powershell
python tools\memory_route.py 林絮
python tools\memory_route.py 噔噔
python tools\memory_route.py shared
```

如果你这次允许读取 `self/`：

```powershell
python tools\memory_route.py 林絮 --allow-self
```

## 当前对象

- `林絮` / `Alice` / `GPT`：走 GPT / Alice / 林絮 路线。
- `噔噔` / `Gemini`：走 Gemini / 噔噔路线。
- `shared` / `普通`：只读共享和工具型信息。

## 重要限制

- 它现在只选文件，不做内容检索。
- 它不会自动读取敏感内容。
- 它不会自动连接 API。
- 它不会把 GPT 和 Gemini 的私有库混用。

下一步如果继续开发，可以做：

- 按关键词从索引里选 3 到 8 条相关记忆。
- 生成 API 请求上下文。
- 做一个“小手机”前端外壳。

