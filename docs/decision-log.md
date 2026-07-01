# 决策记录

## 2026-06-30：文档收口

- 根目录只保留一个 `README.md`。
- 当前真源文档放在 `docs/`。
- 旧 v0.1 记忆索引类文档单独放进 `docs/archive/memory-index-legacy-v0.1/`。
- 旧项目计划和审计报告进入 `docs/archive/`。
- Antigravity 原文只作为归档参考，不当源码和当前真源。
- UI 模板只吸收原则，不直接合并源码。

## 2026-06-30：工程边界

- `script.js` 只做启动。
- `server.py` 只做 HTTP/static 入口。
- JSONL/assets/config IO 进入 `repositories/`。
- 全局视觉走 token/components。

## 2026-06-30：App 路线

- 长期目标是真 App / APK，不是网页套壳。
- React Native / Expo 作为后续验证方向。
- VPS 可用，但先作为轻量 API / 同步桥评估。
