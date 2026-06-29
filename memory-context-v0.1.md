# API 上下文草稿生成 v0.1

这个工具把三件事合并：

- `memory_route.py` 的读取路线
- `memory_search.py` 的关键词命中结果
- API 记忆调用边界提示

它不会联网，不会调用 API，只生成“如果要调用模型，本次可以给它看的上下文草稿”。

## 使用方式

在记忆库根目录运行：

```powershell
python tools\memory_context.py 林絮 人格
python tools\memory_context.py 噔噔 "记忆库 四月后"
python tools\memory_context.py 林絮 日常 --allow-self
```

## 默认规则

- 默认不读取 `self/`。
- 默认不包含敏感/成人标记。
- 默认不跨读私有库。
- 默认只取 6 条记忆候选。

## 输出内容

- 记忆调用提示
- 基础人格/边界文件
- 关键词相关记忆候选
- 禁止读取列表
- 使用提醒

## 重要提醒

这不是最终 prompt。

实际给 API 前，仍然应该检查：

- 有没有不该出现的私密内容
- 有没有混入另一个人的私有库
- 有没有太长
- 当前是否允许读取 `self/`

