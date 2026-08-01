import { AppState } from "../useApp";
import { Icon, IconName } from "./Icon";
import { ThemeMode } from "../theme-mode";

// ─── 桌面端外壳：左侧导航栏 + 主内容区 ───
const SHELL_NAV: { key: AppState["page"]; label: string; icon: IconName }[] = [
  { key: "list", label: "视频列表", icon: "film" },
  { key: "wordbook", label: "生词本", icon: "book" },
  { key: "profile", label: "个人中心", icon: "user" },
  { key: "add", label: "添加视频", icon: "plus" },
];

export function DesktopShell({ p, theme, onToggleTheme, children }: {
  p: AppState;
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <button className="sidebar__brand" onClick={() => p.setPage("landing")} aria-label="返回首页">ShadowingMaster</button>
          <div className="sidebar__sub">英语口语跟读训练</div>
        </div>

        <nav className="sidebar__nav">
          {SHELL_NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => p.setPage(n.key)}
              className={`nav-item ${p.page === n.key ? "nav-item--active" : ""}`}
              aria-current={p.page === n.key ? "page" : undefined}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__foot">
          <button className="icon-btn icon-btn--plain" onClick={onToggleTheme} aria-label="切换主题" title="切换深色模式">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
          </button>
          {p.user ? (
            <div className="sidebar__user">
              <div className="sidebar__email" title={p.user.email}>{p.user.email}</div>
              <button className="nav-item nav-item--ghost" onClick={p.handleLogout}>
                <Icon name="logout" size={18} /><span>退出</span>
              </button>
            </div>
          ) : (
            <button className="btn btn--sm btn--primary btn--block" onClick={() => p.setPage("login")}>登录</button>
          )}
        </div>
      </aside>

      <main className="shell__main">{children}</main>
    </div>
  );
}
