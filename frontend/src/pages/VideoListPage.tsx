import { useState } from "react";
import { AppState } from "../useApp";
import { Icon } from "../components/Icon";
import { VideoCard } from "../components/VideoCard";

type Filter = "all" | "learning" | "done";
type Sort = "recent" | "newest" | "duration";

// ─── 视频列表页（顶部导航由 DesktopShell 统一提供）───
export default function VideoListPage({ app }: { app: AppState }) {
  const p = app;
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const progressOf = (v: any) => (p.progressMap && p.progressMap[v.id] != null ? p.progressMap[v.id] : null);

  const q = (p.searchQuery || "").trim().toLowerCase();
  let items = p.videos.slice();
  if (filter === "learning") items = items.filter((v) => { const i = progressOf(v); return i != null && i + 1 < v.sentence_count; });
  if (filter === "done") items = items.filter((v) => { const i = progressOf(v); return i != null && i + 1 >= v.sentence_count; });
  if (q) items = items.filter((v) => v.title.toLowerCase().includes(q));
  items = items.slice().sort((a, b) => {
    if (sort === "duration") return b.duration_seconds - a.duration_seconds;
    if (sort === "newest") return Number(b.id) - Number(a.id);
    return (progressOf(b) ?? -1) - (progressOf(a) ?? -1);
  });

  const learnedSentences = p.videos.reduce((acc: number, v: any) => acc + ((progressOf(v) ?? 0) + 1 > v.sentence_count ? v.sentence_count : (progressOf(v) ?? 0) + 1), 0);
  const learningVideos = p.videos.filter((v: any) => { const i = progressOf(v); return i != null && i + 1 < v.sentence_count; }).length;
  const wordCount = (p.wordBook || []).length;

  const continueCandidates = p.videos
    .map((v: any) => ({ v, i: progressOf(v) }))
    .filter((x: any) => x.i != null && x.i + 1 < x.v.sentence_count)
    .sort((a: any, b: any) => b.i - a.i);
  const cont = continueCandidates[0];

  return (
    <div className="app">
      <div className="content-wrap">
        <div className="hero-greet">
          <div>
            <div className="hero-greet__hi">早安，学习者</div>
            <div className="hero-greet__title">今天想练哪一段？</div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><div className="hero-stat__num">{learnedSentences}</div><div className="hero-stat__label">已学句子</div></div>
            <div className="hero-stat"><div className="hero-stat__num">{learningVideos}</div><div className="hero-stat__label">在学视频</div></div>
            <div className="hero-stat"><div className="hero-stat__num">{wordCount}</div><div className="hero-stat__label">生词</div></div>
          </div>
        </div>

        {cont && (
          <div className="continue-card">
            <div className="continue-card__thumb"><Icon name="play" size={28} /></div>
            <div className="continue-card__body">
              <div className="continue-card__kicker">继续学习</div>
              <div className="continue-card__title">{cont.v.title}</div>
              <div className="continue-card__bar">
                <div className="continue-card__fill" style={{ width: `${Math.round(((cont.i! + 1) / cont.v.sentence_count) * 100)}%` }} />
              </div>
              <div className="continue-card__meta">第 {cont.i! + 1} / {cont.v.sentence_count} 句 · 还剩 {cont.v.sentence_count - cont.i! - 1} 句</div>
            </div>
            <button className="btn btn--primary" onClick={() => p.openVideo(cont.v.id)}>继续 ▶</button>
          </div>
        )}

        <div className="filter-bar">
          <div className="filter-chips">
            <button className={`chip ${filter === "all" && sort !== "newest" ? "chip--active" : ""}`} onClick={() => setFilter("all")}>全部</button>
            <button className={`chip ${filter === "learning" ? "chip--active" : ""}`} onClick={() => setFilter("learning")}>在学中</button>
            <button className={`chip ${filter === "done" ? "chip--active" : ""}`} onClick={() => setFilter("done")}>已完成</button>
            <button className={`chip ${sort === "newest" ? "chip--active" : ""}`} onClick={() => { setSort("newest"); setFilter("all"); }}>最近添加</button>
          </div>
          <select className="filter-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="排序方式">
            <option value="recent">最近学习</option>
            <option value="newest">最新添加</option>
            <option value="duration">时长</option>
          </select>
        </div>

        {items.length === 0 ? (
          <div className="empty">没有匹配的视频</div>
        ) : (
          <div className="video-grid">
            {items.map((v: any) => (
              <VideoCard
                key={v.id}
                video={v}
                lastSentenceIndex={progressOf(v)}
                onClick={() => p.openVideo(v.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
