# App 与部署策略

## 目标

最终目标是真 App，可以安装 APK，不是 WebView 套壳网页。

## APK 和商店

APK 安装不等于上架商店。

- 早期可以做 Android APK 侧载。
- 暂不进入应用商店发布。
- 暂不处理 iOS 上架。

## 推荐技术路线

候选：React Native / Expo。

原因：

- 可打包 Android APK。
- 可做原生手势、震动、通知、后台能力。
- 不必把当前网页直接套壳。
- 可以复用现有 API 协议、状态模型、设计 token 思想。

## VPS 角色

VPS 可以用，但不要一开始承担全部数据压力。

可选角色：

- 轻量 API 网关。
- 同步桥。
- 模型代理。
- 远程备份入口。

暂不建议：

- 直接把所有 JSONL / SQLite 放 VPS 作为唯一真源。
- 未设计鉴权就开放公网 API。

## 免费/低成本优先级

1. 本地原型继续跑通。
2. SQLite/FTS5 本地副本索引。
3. React Native/Expo APK 技术验证。
4. VPS 只做小服务验证。
5. 评估 Supabase / 云同步。

## 暂缓

- Cloudflare Pages 正式部署。
- Supabase 正式迁移。
- VPS 公网正式服务。
- 商店发布。
