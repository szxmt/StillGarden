# 工具说明

## memory_route.py

本地记忆检索入口。

用途：

- 输入想对话的对象。
- 输出本次应该读取哪些文件。
- 标出哪些文件需要用户明确允许。
- 标出禁止读取的区域。
- 不联网。
- 不调用 API。
- 不读取聊天原文。

示例：

```powershell
python tools\memory_route.py 林絮
python tools\memory_route.py 噔噔
python tools\memory_route.py shared
python tools\memory_route.py 林絮 --allow-self
```

## memory_search.py

本地关键词记忆检索。

用途：

- 先按对象选择允许检索的索引。
- 再用关键词找 3 到 8 条相关记忆候选。
- 默认跳过敏感/成人标记内容。
- 不联网。
- 不调用 API。
- 不读取完整原文。

示例：

```powershell
python tools\memory_search.py 林絮 记忆
python tools\memory_search.py 噔噔 四月后
python tools\memory_search.py 林絮 人格 --limit 5
python tools\memory_search.py 噔噔 记忆库 --include-sensitive
```

## memory_context.py

API 上下文草稿生成器。

用途：

- 合并读取路线、关键词检索结果和记忆调用提示。
- 生成一份可人工检查的上下文草稿。
- 不联网。
- 不调用 API。

示例：

```powershell
python tools\memory_context.py 林絮 人格
python tools\memory_context.py 噔噔 "记忆库 四月后"
python tools\memory_context.py 林絮 日常 --allow-self
```

