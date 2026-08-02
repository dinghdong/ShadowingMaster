import { AppState } from "../useApp";
import { Icon } from "./Icon";
import { ThemeMode } from "../theme-mode";

// ─── 顶部全局导航（替代左侧栏）───
const NAV_TABS: { key: AppState["page"]; label: string }[] = [
  { key: "list", label: "视频列表" },
  { key: "wordbook", label: "生词本" },
  { key: "profile", label: "个人中心" },
];

export function TopNav({ p, theme, onToggleTheme }: {
  p: AppState;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const showSearch = p.page === "list" || p.page === "wordbook";
  return (
    <header className="topnav">
      <button className="topnav__brand" onClick={() => p.setPage("landing")} aria-label="返回首页">
        <img className="landing__brand-logo" src="/favicon.svg" alt="ShadowingMaster" width={28} height={28} />
        <span>Shadowing<span className="topnav__brand-accent">Master</span></span>
      </button>

      <nav className="topnav__tabs" aria-label="主导航">
        {NAV_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => p.setPage(t.key)}
            className={`topnav__tab ${p.page === t.key ? "topnav__tab--active" : ""}`}
            aria-current={p.page === t.key ? "page" : undefined}
          >{t.label}</button>
        ))}
      </nav>

      <div className="topnav__spacer" />

      {showSearch && (
        <div className="topnav__search">
          <Icon name="search" size={16} />
          <input
            className="topnav__search-input"
            placeholder={p.page === "list" ? "搜索视频、句子或单词" : "搜索生词"}
            value={p.searchQuery}
            onChange={(e) => p.setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <div className="topnav__actions">
        <button className="btn btn--primary btn--sm topnav__add" onClick={() => p.setPage("add")}>
          <Icon name="plus" size={16} /> <span className="topnav__add-text">添加视频</span>
        </button>

        <button className="icon-btn icon-btn--plain" onClick={onToggleTheme} aria-label="切换深浅色" title="切换深浅色">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
        </button>

        {p.user ? (
          <button className="topnav__avatar" onClick={() => p.setPage("profile")} aria-label="个人中心" title={p.user.email}>
            <Icon name="user" size={18} />
          </button>
        ) : (
          <button className="btn btn--sm btn--primary topnav__login" onClick={() => p.setPage("login")}>
            <Icon name="user" size={16} /> <span className="topnav__login-text">登录</span>
          </button>
        )}
      </div>
    </header>
  );
}
