import { Icon } from "./Icon";
import { VideoThumb } from "./VideoThumb";

// ─── 视频卡片（与视频列表页一致）───
export function VideoCard({
  video,
  lastSentenceIndex,
  onClick,
}: {
  video: any;
  lastSentenceIndex?: number | null;
  onClick: () => void;
}) {
  const durationMin = Math.floor(video.duration_seconds / 60);
  const durationSec = String(video.duration_seconds % 60).padStart(2, "0");
  const total = video.sentence_count || 0;
  const pct = lastSentenceIndex != null && total > 0
    ? Math.round(((lastSentenceIndex + 1) / total) * 100)
    : 0;
  const done = lastSentenceIndex != null && total > 0 && lastSentenceIndex + 1 >= total;

  return (
    <div onClick={onClick} className="video-card fade-up" style={{ marginBottom: 0 }}>
      <div className="video-card__thumb">
        <VideoThumb video={video} placeholderIcon="film" />
        <span className="video-card__duration">{durationMin}:{durationSec}</span>
        {lastSentenceIndex != null && total > 0 && (
          <div className="video-card__progress">
            <div
              className="video-card__progress-fill"
              style={{ width: `${pct}%`, background: done ? "var(--success)" : "var(--primary)" }}
            />
          </div>
        )}
      </div>
      <div className="video-card__body">
        <div className="video-card__title">{video.title}</div>
        <div className="row" style={{ gap: "var(--sp-3)", fontSize: "var(--fs-meta)", color: "var(--text-2)", flexWrap: "nowrap" }}>
          <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="clock" size={13} /> {durationMin}:{durationSec}</span>
          <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="lines" size={13} /> {video.sentence_count}句</span>
          {lastSentenceIndex != null && (
            <span style={{ color: done ? "var(--success)" : "var(--primary)", fontWeight: "var(--fw-semibold)", whiteSpace: "nowrap" }}>
              {done ? "已完成" : `上次学到 第${lastSentenceIndex + 1}句`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
