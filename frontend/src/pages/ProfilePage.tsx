import { AppState } from "../useApp";
import { Icon } from "../components/Icon";
import { LoginGate } from "../components/LoginGate";
import { VideoCard } from "../components/VideoCard";
import { ThemeMode } from "../theme-mode";

// ─── 个人中心页（学习记录 / 账户）───
export default function ProfilePage({ app, theme, onToggleTheme }: { app: AppState; theme: ThemeMode; onToggleTheme: () => void }) {
  const p = app;

  const records = (p.progressList || [])
    .map((r: any) => ({ ...r, video: p.videos.find((v: any) => v.id === r.video_id) }))
    .filter((r: any) => r.video);
  const learnedSentences = records.reduce((acc: number, r: any) => acc + (r.last_sentence_index + 1), 0);
  const wordCount = (p.wordBook || []).length;

  const stat = (label: string, value: number | string) => (
    <div className="stat-card fade-up">
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );

  return (
    <div className="app">
      <div className="content-wrap">
        {!p.user ? (
          <LoginGate app={p} title="个人中心" hint="登录后查看你的学习记录与账户" returnPage="profile" />
        ) : (
        <>
          <div className="profile-card">
            <div className="profile-card__avatar"><Icon name="user" size={30} /></div>
            <div className="profile-card__main">
              <div className="profile-card__email">{p.user.email}</div>
              <div className="profile-card__sub">已登录</div>
            </div>
            <div className="profile-card__theme">
              <span className="profile-card__theme-label">深色模式</span>
              <button
                className={`toggle ${theme === "dark" ? "toggle--on" : ""}`}
                onClick={onToggleTheme}
                aria-label="切换深色模式"
                aria-pressed={theme === "dark"}
              >
                <span className="toggle__knob" />
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-5)" }}>
            {stat("学习视频", records.length)}
            {stat("学习句数", learnedSentences)}
            {stat("生词", wordCount)}
          </div>

          <div className="section-label" style={{ marginBottom: "var(--sp-3)" }}>学习记录</div>
          {records.length === 0 ? (
            <div className="empty">还没有学习记录，去跟读一个视频吧</div>
          ) : (
            <div className="video-grid">
              {records.map((r: any) => (
                <VideoCard
                  key={r.video_id}
                  video={r.video}
                  lastSentenceIndex={r.last_sentence_index}
                  onClick={() => p.openVideo(r.video_id)}
                />
              ))}
            </div>
          )}

          <button className="btn btn--danger btn--block" style={{ marginTop: "var(--sp-5)" }} onClick={p.handleLogout}>退出登录</button>
        </>
        )}
      </div>
    </div>
  );
}
