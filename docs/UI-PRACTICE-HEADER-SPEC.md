# 跟读页 PC 端顶部导航规范（方案 A：Slim Top Nav）

> 状态：**评审中**（尚未实现）。按用户 spec-first 偏好，先成文评审，再落地。
> 关联提交：`6d448cb`（去掉 DesktopShell 顶部导航，导致 PC 端无页头）。

## 1. 问题

`/video/:id` 去掉 DesktopShell 后，PC 端只剩跟读页内部 `.navbar--keep`（`← 返回 / 标题 / 生词本 / 设置齿轮`），
视觉上像浮在页面里的裸文字，没有"应用头部"的仪式感，也缺 **logo 品牌锚点 / 主题切换 / 用户身份** 三个常用入口。

## 2. 目标

- PC 端（≥900px）给跟读页一个 **~56px 的 slim 顶部导航**，包含：
  - 左：`Logo`（暖橙 tile + ShadowingMaster 字）→ 点击回首页；`← 返回列表`（分隔竖线）→ `视频标题`（自动省略）
  - 右：`生词本` / `设置`（齿轮，复用现有 popover）/ `主题切换` / `用户头像`（或登录）
- 移动端（<900px）**保持现状**：隐藏新 top nav，沿用既有 `.navbar--keep`，不破坏已调好的移动端布局。
- 浅/深色双主题随 `--bg` / `--border-soft` / `--text` / `--primary` 自适应。
- 顶栏 `position: sticky; top: 0`，滚动句子列表时始终吸顶。

## 3. 组件结构

### 新增 `frontend/src/components/PlayerPageTopNav.tsx`

```tsx
import { AppState } from "../useApp";
import { Icon } from "./Icon";
import { ThemeMode } from "../theme-mode";

export function PlayerPageTopNav({ p, theme, onToggleTheme }: {
  p: AppState;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <header className="playernav">
      <div className="playernav__left">
        <button className="playernav__brand" onClick={() => p.setPage("landing")} aria-label="返回首页">
          <img className="playernav__logo" src="/favicon.svg" alt="ShadowingMaster" width={26} height={26} />
          <span>Shadowing<span className="playernav__accent">Master</span></span>
        </button>
        <span className="playernav__sep" />
        <button className="playernav__back" onClick={() => p.setPage("list")} aria-label="返回视频列表">
          <Icon name="arrowLeft" size={18} /> 返回列表
        </button>
        <div className="playernav__title" title={p.currentVideo?.title}>
          {p.currentVideo?.title || "跟读"}
        </div>
      </div>

      <div className="playernav__actions">
        <button className="icon-btn icon-btn--plain" onClick={() => p.setPage("wordbook")} title="生词本" aria-label="生词本">
          <Icon name="book" size={18} />
        </button>
        <button className="icon-btn icon-btn--plain" onClick={onToggleTheme} aria-label="切换深浅色" title="切换深浅色">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
        </button>
        {p.user ? (
          <button className="playernav__avatar" onClick={() => p.setPage("profile")} aria-label="个人中心" title={p.user.email}>
            <Icon name="user" size={16} />
          </button>
        ) : (
          <button className="btn btn--sm btn--primary" onClick={() => p.setPage("login")}>
            <Icon name="user" size={16} /> <span>登录</span>
          </button>
        )}
      </div>
    </header>
  );
}
```

> **设置齿轮**：保留在跟读页内部（`PracticePage` 现有的 `navbar__actions` 里），不开到顶 nav，避免顶 nav 过挤。
> 实现时 `PracticePage` 去掉内部 `.navbar--keep`，改由 `PlayerPageTopNav` 统一承载头部。

### `App.tsx` 改法

```tsx
if (app.page === "wordbook") return withShell(<WordBookPage app={app} />);

// 跟读页：PC 用 slim 顶 nav（移动端用 CSS 隐藏，页面内部 .navbar--keep 仍渲染）
return (
  <div className="app practice">
    <PlayerPageTopNav p={app} theme={theme} onToggleTheme={onToggleTheme} />
    <PracticePage app={app} isMobile={isMobile} />
  </div>
);
```

## 4. CSS（写入 `frontend/src/components.css`）

```css
/* ─── 跟读页 PC 顶部导航（方案 A）─── */
.playernav {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  height: 56px;
  padding: 0 var(--sp-5);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(180%) blur(8px);
  -webkit-backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--border-soft);
}
.playernav__left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.playernav__brand {
  display: inline-flex; align-items: center; gap: 8px;
  background: none; border: none; cursor: pointer;
  font-family: var(--ff); font-size: var(--fs-body); font-weight: var(--fw-heavy);
  color: var(--text); padding: 0;
}
.playernav__logo { border-radius: var(--r-sm); display: block; }
.playernav__accent { color: var(--primary); }
.playernav__sep { width: 1px; height: 22px; background: var(--border-soft); }
.playernav__back {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: none; cursor: pointer;
  font-family: var(--ff); font-size: var(--fs-secondary); font-weight: var(--fw-medium);
  color: var(--text-soft); padding: 6px 8px; border-radius: var(--r-sm);
}
.playernav__back:hover { background: var(--surface-2); color: var(--text); }
.playernav__title {
  font-size: var(--fs-body); font-weight: var(--fw-semibold); color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.playernav__actions { display: flex; align-items: center; gap: var(--sp-2); flex-shrink: 0; }
.playernav__avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border-soft);
  cursor: pointer;
}
.playernav__avatar:hover { background: var(--primary-soft); color: var(--primary); }

/* 移动端：隐藏 PC 顶 nav，沿用页面内部 .navbar--keep */
@media (max-width: 900px) {
  .playernav { display: none; }
}
```

## 5. 移动端兼容

- `@media (max-width: 900px)` 下 `.playernav { display: none }`，跟读页内部 `.navbar--keep` 仍渲染，保持现有移动端体验不变。
- `App.tsx` 在移动端仍渲染 `<PlayerPageTopNav>` 组件（只是 CSS 隐藏），无需按 `isMobile` 条件分支——减少 JS 复杂度。

## 6. 涉及文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/components/PlayerPageTopNav.tsx` | **新增** 顶部导航组件 |
| `frontend/src/App.tsx` | 跟读页分支：包 `<PlayerPageTopNav>` + 去掉 `withShell` |
| `frontend/src/pages/PracticePage.tsx` | 删除内部 `.navbar--keep`（改由 `PlayerPageTopNav` 承载） |
| `frontend/src/components.css` | 新增 `.playernav*` 样式 + 移动端 `@media` 隐藏 |

## 7. 验证

- `npm run build` 通过（类型 + 构建）
- 手动验收：
  - PC（≥900px）：顶 nav 吸顶、logo 点击回首页、返回列表、标题省略、生词本/主题/用户均可点
  - 移动端（<900px）：无顶 nav，沿用既有 `.navbar--keep`
  - 深浅主题各截一张，确认 `--bg` / `--border-soft` / `--primary` 自适应无误
- `npx playwright test` 现有用例不回归（尤其 `slice5-resume-position`）

## 8. 待评审点（请确认）

1. **设置齿轮**放顶 nav 还是留页面内部？本规范选"留页面内部"避免顶 nav 过挤——如果你想要齿轮也在顶 nav，告诉我。
2. **视频级收藏（★）**：当前仅有单句收藏（`p.favorites` / `p.toggleFav` 按 sentence id），无视频级收藏 API。本规范**不含**视频级收藏按钮，避免引入后端改动。若需要，单独立项。
3. 顶 nav 高度 56px 是否合适？可降到 52px 更紧凑。

## 9. 风险

- `PracticePage` 删除 `.navbar--keep` 后，移动端若 CSS 媒体查询失效会丢头部——需在移动端确认 `.navbar--keep` 仍渲染（组件未删，仅 PC 隐藏新 nav）。
- `--z-sticky` 需高于 `.player-bar` / `.player-frame` 的 sticky 层级，避免滚动时顶 nav 被视频盖住（当前 `--z-sticky` 应已满足，部署前目检）。
