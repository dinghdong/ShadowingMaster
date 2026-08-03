import { AppState } from "../../useApp";
import { Sentence } from "../../shared";
import { ProgChips } from "./ProgChips";

// ─── 右侧全句滚动列表行 ───
export function SentenceRow({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const isCurrent = idx === p.currentIndex;
  return (
    <div
      id={`sent-${idx}`}
      onClick={() => p.jumpToSentence(idx)}
      className={`sentence-row ${isCurrent ? "sentence-row--current" : ""} ${idx < p.currentIndex ? "sentence-row--read" : ""}`}
    >
      <span className="sentence-row__wm" aria-hidden="true">{idx + 1}</span>
      <div className="sentence-row__main">
        <div className="sentence-row__text">
          <div className="sentence-row__en">{s.english_text}</div>
          {s.chinese_text && <div className="sentence-row__cn">{s.chinese_text}</div>}
        </div>
      </div>
      <ProgChips p={p} s={s} />
    </div>
  );
}
