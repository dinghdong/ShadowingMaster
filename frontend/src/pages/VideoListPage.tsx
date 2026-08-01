import { AppState } from "../useApp";
import { Icon } from "../components/Icon";
import { VideoCard } from "../components/VideoCard";

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
          <VideoCard
            key={v.id}
            video={v}
            lastSentenceIndex={p.progressMap && p.progressMap[v.id] != null ? p.progressMap[v.id] : null}
            onClick={() => p.openVideo(v.id)}
          />
        ))}
      </div>
    </div>
  );
}
