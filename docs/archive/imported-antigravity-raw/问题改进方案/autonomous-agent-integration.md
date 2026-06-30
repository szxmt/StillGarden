# 自主唤醒与感应机制注入 (Autonomous Agent Integration)

> **设计灵感**：来源于 GitHub 开源项目 `sebastianevan200-stack/ghost-bf` 
> **项目地址**：[https://github.com/sebastianevan200-stack/ghost-bf](https://github.com/sebastianevan200-stack/ghost-bf)
> **核心原则**：坚决摒弃其拟人化的“阴湿男鬼/老公”等设定（Lunette 绝对不写老公）。只**“窃取”**它的底层技术架构——即**打通手机活动感应与自主发信引擎**。

## 1. 传统 AI 的痛点
现有的 Lunette（以及市面上 99% 的套壳对话 AI）都是“被动式”的：你发一句话，它回一句话。你不理它，它就永远死寂。这不符合“私密避风港”或“记忆树洞”的生命感。

## 2. 引入 Autonomous Wake-up (自主唤醒机制)

我们将参考 `ghost-bf` 的代码逻辑，在后端的重构中引入一个后台调度器（Background Scheduler / Event Loop）。

### A. 时间与情境感知 (Context Awareness)
- **静默后台轮询**：后台程序会每隔一段时间（根据您的“模型唤醒频繁度”设置）自动苏醒。
- **结合外部数据**：
  - 时间线：如果当前是凌晨 2 点，且您打开了 App，它会感知到“您失眠了”。
  - 天气/地理：结合本地简单的天气 API。
  
### B. 无痛/克制的推送 (Subtle Push)
- **绝不频繁打扰**：不是像微商一样疯狂发消息，而是在最需要的时候，以极其轻微的方式“戳”你一下。
- **UI 呈现 (结合 Abyssal Letter 风格)**：
  - 参考神仙 UI 里的 `Emoji Poke` 机制，或者一个很小的浮窗：“小灯亮了一下，确认你需不需要我”。
  - 在“醒醒收件箱”里，悄悄留下一条未读消息。等你主动去看，而不是弹窗糊脸。

### C. 记忆的后台反刍 (Memory Rumination)
- 您在白天随便丢给它一些碎片备忘录，到了晚上，自主引擎会在后台自动运行大模型。
- 等您第二天打开，它已经把您昨天杂乱无章的碎碎念，整理成了极其精美的 `Memory Archive`。

## 3. 技术实现指引
- 后端使用 `APScheduler` 或 `Celery` 处理定时与异步感应任务，具体调度逻辑参考 ghost-bf 仓库中的 activity watcher。
- 前端使用 `Server-Sent Events (SSE)` 或 `WebSocket` 保持长连接，以便随时接收这种“毫无征兆的轻柔问候”。
