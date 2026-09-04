# Loading 交互优化规范 · UI-LOADING-SPEC

> 事实源：`tokens.css`(色彩/间距/圆角/动效) + `components.css`(组件类) + `Icon.tsx`(spinner 图标)。
> 原则：所有视觉值只引用 `var(--xxx)`，禁止硬编码；尊重 `prefers-reduced-motion`（已全局支持）。
> 关联：`../frontend/docs/UI-DESIGN-SPEC.md`（通用视觉语言）。

---

## 1. 现状与问题（已排查）

| 场景 | 当前表现 | 问题 |
|---|---|---|
| 全局启动 (`App.tsx:24`) | 居中纯文本 `Loading…` | 无品牌感、无旋转器 |
| **打开视频进跟读页** (`useVideos` 播放器 effect 无 flag) | 句子为空 → 整页**白屏**，无任何提示 | **最严重缺口**：用户以为卡死 |
| 生词本 / 个人中心列表 (`useWordBook`) | 先闪「还没收藏」空态 → 数据到才填充 | 空态误闪、数据到才现 |
| 登录 / 注册 (`useAuth`) | 按钮无禁用、无转圈 | 可重复提交，无任何提交反馈 |
| 单词弹层 (`WordPopup:22`) | 普通文本 `加载中…` | 视觉弱，与品牌不符 |
| 添加视频解析 (`AddVideoPage`) | 进度条 + spinner + 禁用按钮 | 较完整；`pct` 为硬编码假进度（保留，本期不动） |

**结论**：缺一个统一的「旋转器 + 加载态容器 + 骨架屏」基础件，且 4 处关键 surface 完全没有 loading 态。

---

## 2. 设计目标

1. **统一语言**：所有加载都用同一套品牌橙旋转器（`.spinner`），禁止散落 `Loading…`/`加载中…` 裸文本。
2. **结构占位优先**：列表 / 卡片 / 双栏页用**骨架屏**（形状贴合真实布局），消除「白屏」「空态闪现」。
3. **操作可感知**：任何提交类按钮（登录/注册/解析）在请求中必须 `disabled` + spinner + 变文案。
4. **失败可重试**：loading 与 error 分离，失败保留 toast 同时提供显式重试入口（不本期强制，至少不回退）。

---

## 3. 基础件（一次性基建）

### 3.1 旋转器 CSS（`components.css` 新增）
```css
/* —— 加载态 / 品牌旋转器（描边环，色取 token） —— */
.spinner {
  display: inline-block;
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 2.5px solid color-mix(in srgb, var(--primary) 24%, transparent);
  border-top-color: var(--primary);
  animation: sm-spin 0.7s linear infinite;
  flex-shrink: 0;
}
.spinner--sm { width: 14px; height: 14px; border-width: 2px; }
.spinner--lg { width: 32px; height: 32px; border-width: 3px; }

/* 整块区域的居中加载态（跟读页 / 列表 / 弹层 / 全局复用） */
.loading-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--sp-3); padding: var(--sp-7) var(--sp-4);
  color: var(--text-2);
}
.loading-state__text { font-size: var(--fs-secondary); color: var(--text-2); }
```

### 3.2 `Spinner` 组件（`frontend/src/components/Spinner.tsx` 新增）
```tsx
type Props = { size?: "sm" | "md" | "lg"; label?: string; center?: boolean };
// center=true → 渲染 .loading-state 包裹（用于整块区域）
// 默认 → 内联 .spinner（用于按钮内 / 行内）
// label 非空 → 文案显示在 spinner 下方 / 右侧
```
> 替代零散的 `<Icon name="spinner" spin />` 用法，统一品牌色与尺寸档位。

### 3.3 骨架屏 CSS（复用现有 `.skeleton` shimmer，补充形状类）
```css
/* 行 / 块占位（背景沿用 .skeleton 的流光渐变） */
.skeleton-line { height: 12px; border-radius: var(--r-pill); }
.skeleton-block { border-radius: var(--r-md); }

/* 卡片占位（网格复用：视频卡 / 生词卡） */
.skeleton-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-3);
  box-shadow: var(--shadow-sm);
}
.skeleton-card .skeleton-thumb { aspect-ratio: 16/9; border-radius: var(--r-md); }
```

### 3.4 跟读页双栏骨架（关键：形状贴合真实 `.practice` 两栏，避免布局跳动）
```css
.practice-skeleton {
  display: grid; gap: var(--sp-6);
  max-width: 1240px; margin: 0 auto;
  padding: var(--sp-6) clamp(var(--sp-4), 4vw, var(--sp-7));
}
.practice-skeleton__left {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-3);
}
.practice-skeleton__player { aspect-ratio: 16/9; border-radius: var(--r-md); }
.practice-skeleton__right { display: flex; flex-direction: column; gap: 10px; }
@media (min-width: 900px) { .practice-skeleton { grid-template-columns: 1fr 1fr; } }
```
> 与 `components.css` 中 `.practice` 桌面双栏规则保持一致。

---

## 4. 各场景落地

### 4.1 全局启动加载 · `App.tsx`
- 将 `App.tsx:24` 的纯文本替换为：
  ```tsx
  if (app.loading) return <div className="app"><Spinner size="lg" label="加载中…" center /></div>;
  ```
- 文案「加载中…」（中文，贴合产品语境）。

### 4.2 跟读页打开视频 · `useVideos` + `PracticePage`（**最高优先**）
- `useVideos.ts` 播放器 effect（约 62–119 行）新增 `const [playerLoading, setPlayerLoading] = useState(false)`；进入 effect 置 `true`，数据 set 后 `false`；`useApp` 暴露 `playerLoading`。
- `PracticePage`：当 `app.playerLoading` 为真时，渲染 `.practice-skeleton`（左：player 占位 + 2 行线；右：6 个 sentence-row 占位），**替代白屏**；否则渲染真实内容。
- 同时把 `sentences` 拉取失败也走 `playerLoading=false`（保持现状不卡死）。

### 4.3 生词本 / 个人中心列表 · `useWordBook` + 页面
- `useWordBook.ts` 的 `refreshWordBook` 增加 `loading` 状态（`setLoading(true)` 起步，`finally` 置 `false`）；`useApp` 暴露 `wordbookLoading`。
- `WordBookPage`：当 `wordbookLoading` 为真 → 渲染 `wordbook-grid` 内 N 个 `.skeleton-card`（而非空态）；失败仍 toast。
- `ProfilePage`：统计区 / 记录列表在 `wordbookLoading` 时渲染骨架占位。

### 4.4 登录 / 注册 · `useAuth` + `LoginPage`
- `useAuth.ts` 增加 `submitting` 状态；`handleLogin`/`handleRegister` 期间 `true`，`finally` 置 `false`；`useApp` 暴露。
- `LoginPage` 按钮：
  ```tsx
  <button className="btn btn--primary btn--block" disabled={submitting}>
    {submitting ? <><Spinner size="sm" /> 登录中…</> : "登 录"}
  </button>
  ```
  - 注册同理显示「注册中…」。
  - 文案用 `<Spinner size="sm" />` 内联（白底在 primary 按钮上需 `border-top-color: var(--on-primary)` —— 在 `.btn--primary .spinner` 中覆写为 `var(--on-primary)`）。

### 4.5 单词弹层 · `WordPopup`
- `WordPopup.tsx:22` 的 `加载中…` 普通文本 → `<Spinner size="sm" label="加载中…" />`（行内或小幅居中）。

---

## 5. 文件改动清单

| 文件 | 改动 |
|---|---|
| `frontend/src/components/Spinner.tsx` | **新增** 统一旋转器组件 |
| `frontend/src/components.css` | 新增 `.spinner*` / `.loading-state*` / `.skeleton-line` / `.skeleton-block` / `.skeleton-card` / `.practice-skeleton*` |
| `frontend/src/App.tsx` | 全局 loader 品牌化 |
| `frontend/src/hooks/useVideos.ts` | 新增 `playerLoading` 并暴露 |
| `frontend/src/hooks/useWordBook.ts` | 新增 `loading` 并暴露 |
| `frontend/src/hooks/useAuth.ts` | 新增 `submitting` 并暴露 |
| `frontend/src/pages/PracticePage.tsx` | 接入双栏骨架 |
| `frontend/src/pages/WordBookPage.tsx` | 接入网格骨架 |
| `frontend/src/pages/ProfilePage.tsx` | 统计/记录骨架 |
| `frontend/src/pages/LoginPage.tsx` | 提交态（禁用+spinner+文案） |
| `frontend/src/components/WordPopup.tsx` | 加载态换 spinner |

---

## 6. 验收标准
- [ ] 任意 surface 不再出现纯文本 `Loading…`/`加载中…`（统一 spinner）。
- [ ] 打开任意视频进跟读页：先显示双栏骨架，再淡入真实内容（无白屏、无布局跳动）。
- [ ] 生词本 / 个人中心：加载时显示卡片骨架，而非「还没收藏」空态闪现。
- [ ] 登录 / 注册：点击后按钮立即禁用并显示「登录中…/注册中…」，不可重复提交。
- [ ] 全量遵循 `prefers-reduced-motion`（旋转 / 流光自动降级）。
- [ ] 无新增硬编码色值 / 字号，全部走 token。

> 范围说明：添加视频解析进度（4.5 已较完整）本期**不改动**；如需把假进度改为真实百分比，可另立 slice。
