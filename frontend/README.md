# Lunette 前端原型

这是当前可运行的本地手机壳原型。总蓝图、路线图和写入规则不在这里维护，统一看根目录 `docs/`。

## 启动

```powershell
cd D:\Aaa.项目\lunatte
.\start-lunatte.ps1
```

或双击：

```text
start-lunatte.bat
```

默认端口：`8877`。服务会读取和写入：

```text
D:\Aaa.项目\lunatte\data\sessions\prototype
```

## 当前可用页面

- Home：首页统计。
- Rooms：林絮、噔噔、客厅、Aimas 房间入口。
- Chat：会话列表、聊天页、聊天信息页、住户资料页。
- Archive：翻抽屉、留下这一件事、确认记忆列表。
- Timeline：只读事件时间线，支持人物/来源筛选和分页。
- More：个人设置、圈圈、醒醒、门牌和边界、模型供应商、Aimas、当前状态。
- Moments：圈圈流、发文字/图片、点赞、评论、手动住户回应。
- Wake：候选消息收件箱。

## 当前结构

- CSS 入口：`styles.css`
- CSS 模块：`css/`
- JS 启动：`script.js`
- JS 可复用层：`shared/`
- Web controller：`web/`

具体写入规则看：

```text
..\docs\engineering-rules.md
```

## 检查

```powershell
node --check script.js
```

涉及 `shared/`、`web/` 时，要扩大检查范围。后端检查看 `backend/` 和根目录写入规则。
