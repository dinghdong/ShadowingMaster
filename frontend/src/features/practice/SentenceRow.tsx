import { AppState } from "../../useApp";
import { Sentence, tokenize } from "../../shared";
import { ProgChips } from "./ProgChips";

// ─── 右侧全句滚动列表行 ───
export function SentenceRow({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const isCurrent = idx === p.currentIndex;
  // 与左侧练习台一致的卡拉OK条件：开启逐词高亮 + 当前句 + 精听/跟读模式。
  // 精听模式下右列表英文恒定可见（左栏被隐藏字幕遮罩盖住），故卡拉OK落在此处。
  const showKaraoke =
    p.wordHighlight && isCurrent && (p.practiceMode === "view" || p.practiceMode === "shadow");

  const tokens = tokenize(s.english_text);
  const wordCount = tokens.filter((t) => !t.space).length;
  let activeWord = -1;
  if (showKaraoke) {
    const prog = (p.playhead - s.start_time) / Math.max(0.001, s.end_time - s.start_time);
    activeWord = Math.min(wordCount - 1, Math.max(0, Math.floor(prog * wordCount)));
  }

  const renderEn = () => {
    if (!showKaraoke) return s.english_text;
    let wi = -1;
    return tokens.map((t, i) => {
      if (t.space) return <span key={i}>{t.text}</span>;
      wi++;
      const isActive = wi === activeWord;
      const color = isActive ? "var(--primary)" : t.isHard ? "var(--danger)" : "var(--text)";
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); p.handleWordClick(t.text, s.id, s.sentence_index); }}
          className={t.isHard ? "word-token word-token--hard" : "word-token"}
          style={{
            color,
            fontWeight: (isActive || t.isHard) ? "var(--fw-bold)" : "var(--fw-regular)",
            background: isActive ? "var(--primary-soft)" : "transparent",
            borderRadius: "var(--sp-1)",
            padding: isActive ? "1px 3px" : 0,
            textDecoration: isActive ? "underline" : "none",
            transition: "background 0.15s, color 0.15s",
            cursor: "pointer",
          }}
        >{t.text}</span>
      );
    });
  };

  return (
    <div
      id={`sent-${idx}`}
      onClick={() => p.jumpToSentence(idx)}
      className={`sentence-row ${isCurrent ? "sentence-row--current" : ""} ${idx < p.currentIndex ? "sentence-row--read" : ""}`}
    >
      <span className="sentence-row__wm" aria-hidden="true">{idx + 1}</span>
      <div className="sentence-row__main">
        <div className="sentence-row__text">
          <div className="sentence-row__en">{renderEn()}</div>
          {s.chinese_text && <div className="sentence-row__cn">{s.chinese_text}</div>}
        </div>
      </div>
      <ProgChips p={p} s={s} />
    </div>
  );
}
