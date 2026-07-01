# 关键词记忆检索 v0.1

这个工具接在 `memory_route.py` 后面。

它做的事情：

- 先判断对象是 Alice / 林絮、噔噔，还是普通 AI。
- 只搜索该对象允许访问的索引。
- 默认跳过敏感/成人标记。
- 返回少量相关候选。
- 不联网，不调用 API，不读取完整原文。

## 使用方式

在记忆库根目录运行：

```powershell
python tools\memory_search.py 林絮 记忆
python tools\memory_search.py 噔噔 四月后
python tools\memory_search.py 噔噔 "记忆库 四月后"
python tools\memory_search.py 林絮 人格 --limit 5
```

如果你明确要包含敏感标记：

```powershell
python tools\memory_search.py 林絮 亲密 --include-sensitive
```

## 当前限制

- 第一版只是关键词匹配，不是语义向量检索。
- 结果来自索引和本地预览，不代表完整原文。
- 对 Gemini / 噔噔，因为 Google 活动卡片很多，结果可能需要进一步降噪。
- 只搜“四月后”这种时间词时，结果会偏活动编号；最好加具体话题，比如“记忆库 四月后”。
- 之后可以升级成向量检索，再接小手机前端。
