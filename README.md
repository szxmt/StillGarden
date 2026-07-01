# Lunette

Lunatte / 月亮小窝是 Stillgarden 清理重组后的 V0.3 当前工作区。当前仓库包含：

- 前端：`frontend/`
- 后端：`backend/`
- 本地私有记忆材料：`memory/`，不进 Git
- 本地运行数据：`data/sessions/prototype`，不进 Git
- 项目文档：`docs/`

## 先看哪里

- 当前状态：`docs/current-status.md`
- 全局总蓝图：`docs/全局总蓝图.md`
- 下一步计划：`docs/roadmap.md`
- 写入规则：`docs/engineering-rules.md`
- 当前架构：`docs/architecture.md`
- 产品蓝图：`docs/product-blueprint.md`
- UI 方向：`docs/ui-direction.md`
- 记忆系统：`docs/memory-system-plan.md`
- 真 App / VPS 路线：`docs/app-strategy.md`

`docs/README.md` 是完整文档索引。

## 启动原型

```powershell
cd D:\Aaa.项目\lunatte\v0.3
.\start-lunatte.ps1
```

也可以双击：

```text
start-lunatte.bat
```

默认端口：`8877`。测试后关闭服务窗口，不长期占用端口。

## 数据安全

当前开发只写 V0.3 自己的数据副本：

```text
D:\Aaa.项目\lunatte\v0.3\data\sessions\prototype
```

不要直接写旧 V0.1：

```text
D:\A月亮啊\memory-vault-starter\sessions\prototype
```

写入型测试产生的 `data/sessions/prototype` diff 默认不提交，除非明确要作为种子数据。

## 工程原则

- 结构重构和业务功能分开提交。
- 新功能先看 `docs/engineering-rules.md`，确认写入位置。
- UI 全局变化走 token/components，不逐页面复制主题。
- JSONL 仍是原型真源；SQLite / FTS5 先做副本索引。
- Antigravity 和本地参考资料只作为参考，不直接覆盖当前代码。

## 当前阶段

V0.3 的安全清理、目录地基和前后端拆分已经落地。后续按 `docs/全局总蓝图.md` 看全局方向，按 `docs/roadmap.md` 执行短期任务。
