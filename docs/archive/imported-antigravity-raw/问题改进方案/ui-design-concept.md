# 新版 Lunette UI 设计思路 (基于私密手账/文字AVG风格)

> ⚠️ 注意：本文档仅为设计思路探讨，绝对不修改任何源码。

## 1. 字体与留白问题
**【问题】**：之前的 UI 设计太像“现代软件 (SaaS)”，字号极大（类似老年机），气泡内边距过大，导致信息密度极低，显得臃肿且幼态。
**【改进】**：全面缩小基准字号，收紧行高与气泡的 padding，提升文字的紧凑感和精致感，使其更像精美的排版书册。
**【代码 (CSS 示例思路)】**：
```css
/* 原来的臃肿样式 */
.chat-bubble {
  padding: 20px 24px;
  font-size: 16px;
  line-height: 1.8;
}

/* 改进后的精致样式 */
.chat-bubble {
  padding: 10px 14px;
  font-size: 13px; /* 或者 14px */
  line-height: 1.5;
  letter-spacing: 0.5px;
}
```

## 2. 圆角与边框处理
**【问题】**：全息大阴影和 38px 的夸张大圆角让界面显得像玩具，缺乏高级感和锋利感。
**【改进】**：大幅削减圆角半径，取消厚重的外阴影。采用极细（1px）的半透明实线描边来勾勒气泡边缘，呈现出一种“纤细”的视觉体验。
**【代码 (CSS 示例思路)】**：
```css
/* 原来的玩具感圆角 */
.chat-bubble {
  border-radius: 20px;
  box-shadow: var(--shadow-soft);
  border: none;
}

/* 改进后的纤细感圆角 */
.chat-bubble {
  border-radius: 8px; /* 或者更具棱角的 10px */
  box-shadow: none;
  border: 1px solid rgba(0, 0, 0, 0.08); /* 极细描边 */
}
```

## 3. 背景与质感
**【问题】**：纯色径向渐变过于单调，无法提供沉浸式的私人空间感。
**【改进】**：引入极其轻薄的材质纹理（如 5% 透明度的复古暗纹或 ACG 风格的蕾丝底纹）作为大背景，取代生硬的纯色。
**【代码 (CSS 示例思路)】**：
```css
/* 原来的背景 */
body {
  background-image: var(--bg-gradient);
}

/* 改进后的材质背景 */
body {
  background-color: #faf9fb;
  background-image: url('assets/texture-lace.png'); /* 铺上暗纹 */
  background-repeat: repeat;
  background-size: 200px;
}
```

## 4. 特殊交互组件 (如“思考过程”)
**【问题】**：缺少打断纯文本流的修饰性小组件，长篇对话显得枯燥。
**【改进】**：在 AI 的回复气泡上方，增加一个小巧、粘连的“胶囊型折叠条”（如截图中的“💭 思考过程 [展开]”）。这能大幅增加界面的细节层级。
**【代码 (HTML 示例思路)】**：
```html
<!-- 改进后的特殊模块结构 -->
<div class="message-group">
  <div class="think-pill">
    <span class="icon">💭</span> 思考过程 <span class="action">展开</span>
  </div>
  <div class="chat-bubble ai-bubble">
    在这里输出实际的回复内容...
  </div>
</div>
```
