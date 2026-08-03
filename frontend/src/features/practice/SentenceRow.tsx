import { AppState } from "../../useApp";
import { Sentence } from "../../shared";
import { ProgChips } from "./ProgChips";
import { Icon } from "../../components/Icon";

// ─── 右侧全句滚动列表行 ───
export function SentenceRow({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const isCurrent = idx === p.currentIndex;
  const isRead = idx < p.currentIndex;
  const dur = Math.max(0, Math.round((s.end_time - s.start_time) * 10) / 10);
  const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}` : `${dur}s`;
  return (
    <div
      id={`sent-${idx}`}
      onClick={() => p.jumpToSentence(idx)}
      className={`sentence-row ${isCurrent ? "sentence-row--current" : ""} ${isRead ? "sentence-row--read" : ""}`}
    >
      <span className="sentence-row__bar" aria-hidden />
      <div className="sentence-row__main">
        <span className="sentence-row__idx">{idx + 1}</span>
        <div className="sentence-row__text">
          <div className="sentence-row__en">{s.english_text}</div>
          {s.chinese_text && <div className="sentence-row__cn">{s.chinese_text}</div>}
        </div>
        <button
          className="round-play sentence-row__play"
          aria-label={`播放第 ${idx + 1} 句`}
          title="单句播放"
          onClick={(e) => { e.stopPropagation(); p.playSentenceAt(idx); }}
        >
          <Icon name="play" size={12} />
        </button>
      </div>
      <div className="sentence-row__footer">
        <span className="sentence-row__time"><Icon name="clock" size={11} /> {durLabel}</span>
        <ProgChips p={p} s={s} />
      </div>
    </div>
  );
}
