import { mediaUrl } from "../shared";
import { Icon } from "./Icon";

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
  return (
    <div onClick={onClick} className="video-card fade-up" style={{ marginBottom: "var(--sp-4)" }}>
      <div className="video-card__thumb">
        {video.thumbnail_url ? <img src={mediaUrl(video.thumbnail_url)} alt="" /> : <Icon name="film" size={28} />}
      </div>
      <div className="video-card__body">
        <div className="video-card__title">{video.title}</div>
        <div className="row" style={{ gap: "var(--sp-3)", fontSize: "var(--fs-meta)", color: "var(--text-2)", flexWrap: "nowrap" }}>
          <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="clock" size={13} /> {durationMin}:{durationSec}</span>
          <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="lines" size={13} /> {video.sentence_count}句</span>
          {lastSentenceIndex != null && (
            <span style={{ color: "var(--primary)", fontWeight: "var(--fw-semibold)", whiteSpace: "nowrap" }}>上次学到 第{lastSentenceIndex + 1}句</span>
          )}
        </div>
      </div>
    </div>
  );
}
