import { AppState } from "../useApp";
import { TopNav } from "./TopNav";
import { ThemeMode } from "../theme-mode";

// ─── 桌面端外壳：顶部全局导航 + 主内容区（替代左侧栏）───
export function DesktopShell({ p, theme, onToggleTheme, children }: {
  p: AppState;
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <TopNav p={p} theme={theme} onToggleTheme={onToggleTheme} />
      <main className="shell__main">{children}</main>
    </div>
  );
}
