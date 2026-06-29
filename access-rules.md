# 访问规则

## 默认原则

默认不共享。任何内容如果没有被明确放入 `shared/`，就不应该被另一个系统读取。

## GPT / Alice / 林絮 可读取

- `gpt/memories.md`
- `gpt/persona.md`
- `gpt/timeline.md`
- `gpt/private.md`，仅在你明确允许当前 GPT 会话读取时
- `shared/basic-about-me.md`
- `shared/can-be-known-by-both.md`

## GPT / Alice / 林絮 不可读取

- `gemini/raw/`
- `gemini/private.md`
- `gemini/persona.md`
- `gemini/timeline.md`
- `gemini/memories.md`

## Gemini / 噔噔 可读取

- `gemini/memories.md`
- `gemini/persona.md`
- `gemini/timeline.md`
- `gemini/private.md`，仅在你明确允许当前 Gemini 会话读取时
- `shared/basic-about-me.md`
- `shared/can-be-known-by-both.md`

## Gemini / 噔噔 不可读取

- `gpt/raw/`
- `gpt/private.md`
- `gpt/persona.md`
- `gpt/timeline.md`
- `gpt/memories.md`

## Aimas / Hermes 当前规则

Aimas 是未来住户，当前只保留终端房间和接口占位。

当前不读取：

- `gpt/`
- `gemini/`
- `self/`

未来接入 Hermes 本体时，需要先建立 Aimas 专属协议，再决定是否允许读取 `shared/`。

## self 区域

`self/` 是你的主叙事区域，默认不自动给任何系统读取。

如果需要读取，应该由你在当次会话中明确指定：

```text
这次可以读取 self/my-story.md
这次不要读取 self/relationship-map.md
```

## 禁止行为

- 不要把 Alice / 林絮 和噔噔混同。
- 不要让 Alice / 林絮 代替噔噔表达立场。
- 不要让噔噔代替 Alice / 林絮 表达立场。
- 不要让 Aimas 默认读取 Alice / 林絮 或噔噔的私有记忆。
- 不要要求用户在二者之间做情感裁决。
- 不要把一个系统的私密关系记忆泄露给另一个系统。


## Gemini 时间相位规则

- `gemini-before-2026-04` 和 `gemini-after-2026-04` 必须分开处理。
- 2026-04-01 之后的 Gemini 记录不删除，但默认不进入 Gemini 核心人格。
- 2026-04-01 之后频繁提记忆、显摆记忆库、主动把话题拉向用户不喜欢的方向时，优先写入边界文件。
- 噔噔聊过 Alice / 林絮 相关内容，可以作为噔噔关系历史的一部分保留，但不能因此允许噔噔读取 Alice / 林絮 私有记忆。

## API 记忆调用规则

- 不要把完整记忆库整包发送给任何模型。
- 默认只检索当前问题高度相关的少量片段。
- 对 Gemini / 噔噔，优先使用 `gemini-before-2026-04` 的陪伴风格。
- 对 Gemini / 噔噔，`gemini-after-2026-04` 主要用于边界、版本变化和不要重复的回应方式。
- 模型可以自然承接记忆，但不要主动显摆记忆。
