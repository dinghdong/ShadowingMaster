import { AppState } from "../useApp";
import { Icon } from "./Icon";
import { ThemeMode } from "../theme-mode";

// 跟读页 PC 端 slim 顶部导航（方案 A）：logo→首页 / 返回列表 / 标题 / 生词本 / 主题 / 用户
// 移动端由 CSS (@media max-width:900px) 隐藏，沿用 PracticePage 内部的 .navbar--keep
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
