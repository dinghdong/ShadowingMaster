import { AppState } from "../useApp";
import { mediaUrl } from "../shared";
import { Icon } from "../components/Icon";

// ─── 视频列表页 ───
export default function VideoListPage({ app }: { app: AppState }) {
  const p = app;
  return (
    <div className="app">
      <div className="navbar">
        <div className="navbar__brand">ShadowingMaster</div>
        <div className="navbar__spacer" />
        <div className="navbar__actions">
          {p.user ? (
            <>
              <button className="icon-btn" onClick={() => p.setPage("wordbook")} title="生词本" aria-label="生词本">
                <Icon name="book" size={20} />
                {p.wordBook && p.wordBook.length > 0 && (
                  <span className="badge">{p.wordBook.length > 99 ? "99+" : p.wordBook.length}</span>
                )}
              </button>
              <button className="icon-btn" onClick={() => p.setPage("add")} title="添加视频" aria-label="添加视频"><Icon name="plus" size={20} /></button>
              <button className="icon-btn icon-btn--accent" onClick={() => p.setPage("profile")} title="个人中心" aria-label="个人中心"><Icon name="user" size={20} /></button>
            </>
          ) : (
            <button className="btn btn--sm btn--primary" onClick={() => p.setPage("login")}>登录</button>
          )}
        </div>
      </div>

      <div className="page-pad list-grid">
        {p.videos.map((v) => (
          <div key={v.id} onClick={() => p.openVideo(v.id)} className="video-card fade-up" style={{ marginBottom: "var(--sp-4)" }}>
            <div className="video-card__thumb">
              {v.thumbnail_url ? <img src={mediaUrl(v.thumbnail_url)} alt="" /> : <Icon name="film" size={28} />}
            </div>
            <div className="video-card__body">
              <div className="title-strong" style={{ marginBottom: 6 }}>{v.title}</div>
              <div className="row" style={{ gap: "var(--sp-3)", fontSize: "var(--fs-meta)", color: "var(--text-2)", flexWrap: "nowrap" }}>
                <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="clock" size={13} /> {Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, "0")}</span>
                <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="lines" size={13} /> {v.sentence_count}句</span>
                {p.progressMap && p.progressMap[v.id] != null && (
                  <span style={{ color: "var(--primary)", fontWeight: "var(--fw-semibold)", whiteSpace: "nowrap" }}>上次学到 第{p.progressMap[v.id] + 1}句</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
