# 单词弹窗窄屏适配方案 v1

> 现状：`WordPopup`（`frontend/src/components/WordPopup.tsx`）的 `word-head` 横排（24px 单词 + 音标 + 喇叭按钮），弹窗 `.modal--md`（`frontend/src/components.css` L867–869、L755）`max-width: 340px`。在 ≤320px 的窄屏手机（iPhone SE 1代、Galaxy Fold 外屏 等）下：屏幕宽 320 − modal-backdrop padding 20 − modal 内 padding `var(--sp-6)`×2 ≈ 260px 的可用宽，长单词（如 `understanding` / `internationalization` / `characteristic` / `responsibility` 等 12+ 字母词）撞到音标 + 喇叭时会被截断、换行跳到第二行、或挤掉喇叭。
>
> 本文档是这次小改的事实源。评审通过后再动 TSX / CSS。

---

## 0. 目标 & 范围

- **目标**：在 ≤320px 窄屏下保证弹窗头部不挤、不截断、不换行失控；≥360px 主流手机 / 桌面 480px 居中栏保持现状视觉。
- **范围**：`WordPopup` 头部（`word-head`）和承载它的 `.modal--md`。**不动** `.word-head` 之外的弹窗结构（按钮、释义、例句均保持不变）。

---

## 1. 问题定位

| 维度 | 当前 | 痛点 |
|---|---|---|
| `word-head` 布局 | `display: flex; align-items: center; gap: var(--sp-2)` 横排 | 长词 + 音标 + 喇叭同横排 → 窄屏挤压 |
| `word-head__text` | `font-size: 24px; font-weight: var(--fw-heavy)`，无宽度约束 | 13字母词 ≈ 156px 起跳 |
| `word-head__phon` | `font-size: var(--fs-secondary); color: var(--text-2)`，无宽度约束、无换行控制 | 多个音标词 / 长音标容易溢出 |
| `__icon-btn` 喇叭 | `margin-left: auto` 固定在右 | 单词顶到喇叭时喇叭会被推走 / 单词断行 |
| `.modal--md` | `max-width: 340px` | 320px 屏 → 实际容器 ≈ 300px（已包含 `--sp-6` 内 padding），头部可用 ≈ 252px |

---

## 2. 设计方案（推荐）

### 2.1 布局：保持结构不变，仅加保护

> **不换结构**（仍单行：单词 + 音标 + 喇叭）。这避免改 TSX 树，CSS 即可修复。

#### CSS（增量，附在 `components.css` 当前 `.word-head` 区块后）

```css
/* 单词弹窗头部（窄屏保护） */
.word-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
  min-width: 0;              /* 允许 flex 子项收缩 */
}
.word-head__text {
  font-size: 24px;
  font-weight: var(--fw-heavy);
  color: var(--text);
  min-width: 0;
  max-width: 100%;           /* 不超过容器 */
  overflow-wrap: anywhere;   /* 长单词可断行（极窄屏兜底） */
  word-break: break-word;
  line-height: 1.15;
}
.word-head__phon {
  font-size: var(--fs-secondary);
  color: var(--text-2);
  min-width: 0;
  flex: 0 1 auto;
  overflow-wrap: anywhere;
  white-space: normal;
}
.word-head > .icon-btn {
  flex-shrink: 0;            /* 喇叭按钮不可被压缩到看不见 */
}
```

#### 在窄屏再降字号（≤360px，渐进降级）

```css
/* 窄屏（iPhone SE 1代、Galaxy Fold 外屏等）下整体收紧 */
@media (max-width: 360px) {
  .word-head__text  { font-size: 22px; }
  .word-head__phon  { font-size: var(--fs-meta); }
  .modal--md        { padding: var(--sp-5); }
}
```

**为什么是 22px**：22px × 13字母 ≈ 142px；加音标约 110px + gap + 喇叭 32px ≈ 300px。在 320 屏下装得下，不至于断行。视觉损失 < 1 个字号档，从产品重要性看完全可接受。

**为什么不动 TSX**：本次只在头部 CSS 层面修，加 1 行媒体查询，0 改组件结构。后续如发现多数用户都是长词，再考虑上 `word-break: break-all` 兜底。

### 2.2 视觉对比表

| 屏幕宽度 | 单词 | 音标 | 喇叭 | 评估 |
|---|---|---|---|---|
| 375px（主流） | 24px 显示完整 | 14px 显示完整 | 32px | ✅ 不变 |
| 360px（Android 中小屏） | 24px | 14px | 32px | ✅ 不变（媒体查询临界） |
| 320px（iPhone SE 1代） | 22px 自动收缩 | 元字号缩小 | 32px | ✅ 收紧 1 档 |
| 280px（极端） | 断行兜底（`overflow-wrap: anywhere`） | 断行 | 32px | ✅ 不溢出 |

### 2.3 不在本次范围（候选）

- 重排头部为两行（单词一行 / 音标+喇叭一行）—— 大改，组件结构变动，先不做。
- 弹窗标题字号自适应 `clamp()` —— 现有规范未引入，引入需补设计令牌，超出本次范围。
- `.modal--md` 改 360px —— 桌面 480 居中栏策略不变，避免。

---

## 3. 验收

**手动测试矩阵**
- [ ] iPhone SE 1代（320×568 Safari、Chrome）— `working.` / `understanding` / `internationalization` 三词截图比对
- [ ] iPhone 12/13/14（390px）—— 单词头不变化
- [ ] 桌面 1280px（480 居中栏）—— 单词头不变化
- [ ] 浅 / 深模式各跑一次

**断言（Playwright 选做）**
- [ ] 弹窗头部 `getBoundingClientRect` 在 320 视窗下，宽度 ≤ 弹窗容器宽，无水平滚动
- [ ] 喇叭按钮仍可点击、未被遮挡

**回归**
- [ ] 跟读页点词 / 生词本页点词两个入口均正常
- [ ] 释义加载中 / 已加载 / 未找到三种文案下头部均不抖动

---

## 4. 改动清单（评审通过后）

| 文件 | 改动 |
|---|---|
| `frontend/src/components.css` | 改 `.word-head` / `.word-head__text` / `.word-head__phon`（加 min-width: 0 + 断行兜底 + 喇叭 `flex-shrink: 0`）；新增 `@media (max-width: 360px)` 一段 |
| `frontend/src/components/WordPopup.tsx` | 不改 |

变更量 ≈ 12 行 CSS。

---

## 5. Commit 建议

单一 commit：`fix(wordpopup): 窄屏（≤360px）下头部不挤 / 不截断（CSS only）`
