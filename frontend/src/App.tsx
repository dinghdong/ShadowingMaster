import { useState, useEffect } from "react";
import { useApp } from "./useApp";
import { getStoredTheme, toggleTheme, ThemeMode } from "./theme-mode";
import { useIsMobile } from "./hooks/useIsMobile";
import { DesktopShell } from "./components/DesktopShell";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import AddVideoPage from "./pages/AddVideoPage";
import VideoListPage from "./pages/VideoListPage";
import WordBookPage from "./pages/WordBookPage";
import PracticePage from "./pages/PracticePage";

export default function App() {
  const app = useApp();
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme());
  const onToggleTheme = () => setTheme(toggleTheme());
  const isMobile = useIsMobile();

  useEffect(() => {
    if (app.videoRef.current) app.videoRef.current.playbackRate = app.rate;
  }, [app.rate, app.page, app.currentVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (app.loading) return <div className="app" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="meta">Loading…</span></div>;

  if (app.page === "landing") return <LandingPage {...app} theme={theme} onToggleTheme={onToggleTheme} />;

  if (app.page === "login") return <LoginPage app={app} theme={theme} onToggleTheme={onToggleTheme} />;

  const withShell = (node: React.ReactNode) => (
    <DesktopShell p={app} theme={theme} onToggleTheme={onToggleTheme}>{node}</DesktopShell>
  );

  if (app.page === "profile") return withShell(<ProfilePage app={app} theme={theme} onToggleTheme={onToggleTheme} />);

  if (app.page === "add") return withShell(<AddVideoPage app={app} />);

  if (app.page === "list") return withShell(<VideoListPage app={app} />);

  if (app.page === "wordbook") return withShell(<WordBookPage app={app} />);

  return withShell(<PracticePage app={app} isMobile={isMobile} />);
}
