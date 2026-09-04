import { AppState } from "../../useApp";
import { Sentence, tokenize, compareWords, activeWordIndex } from "../../shared";
import { Icon } from "../../components/Icon";
import { ActionBtn } from "../../components/ActionBtn";
import { CheckBtn } from "../../components/CheckBtn";
import { ShadowActions } from "./ShadowActions";
import { NoteEditor } from "./NoteEditor";

// ─── 左侧当前句练习台 ───
export function SentenceCard({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const isCurrent = idx === p.currentIndex;
  const tokens = tokenize(s.english_text);
  const isHidden = p.practiceMode === "view" && p.subtitleHidden;

  const highlightCurrent = p.wordHighlight && isCurrent && (p.practiceMode === "view" || p.practiceMode === "shadow");
  const wordCount = tokens.filter((t) => !t.space).length;
  const activeWord = highlightCurrent ? activeWordIndex(s, p.playhead, wordCount) : -1;

  const renderEnglish = (withHighlight: boolean) => {
    let wi = -1;
    return tokens.map((t, i) => {
      if (t.space) return <span key={i}>{t.text}</span>;
      wi++;
      const isActive = withHighlight && wi === activeWord;
      const color = isActive
        ? "var(--primary)"
        : t.isHard ? "var(--danger)"
          : "var(--text)";
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); p.handleWordClick(t.text, s.id, s.sentence_index); }}
          className={t.isHard ? "word-token word-token--hard" : "word-token"}
          style={{
            color,
            fontWeight: (isActive || t.isHard) ? "var(--fw-bold)" : "var(--fw-regular)",
            cursor: "pointer",
            background: isActive ? "var(--primary-soft)" : "transparent",
            borderRadius: "var(--sp-1)",
            padding: isActive ? "1px 0" : 0,
            textDecoration: isActive ? "underline" : "none",
            transition: "background 0.15s, color 0.15s",
          }}
        >{t.text}</span>
      );
    });
  };

  const showEnglish = p.subtitleMode === "english" || p.subtitleMode === "both";
  const showChinese = !!s.chinese_text && (p.subtitleMode === "chinese" || p.subtitleMode === "both");

  // 用 .sentence__subtitle 容器包住"英文+中文"两个 div，
  // 让水印 span 以该容器为定位锚点，自然高度来自文字，top:50% 即字幕区垂直中点。
  const subtitleBlock = (
    <div className="sentence__subtitle">
      <span className="sentence__wm" aria-hidden="true">{idx + 1}</span>
      {showEnglish && (
        <div style={{ fontSize: "var(--fs-sentence)", color: "var(--text)", lineHeight: "var(--lh-sentence)", marginBottom: s.chinese_text && showChinese ? 6 : 0 }}>
          {renderEnglish(highlightCurrent)}
        </div>
      )}
      {showChinese && (
        <div style={{ fontSize: "var(--fs-secondary)", color: "var(--text-2)", lineHeight: "var(--lh-body)" }}>{s.chinese_text}</div>
      )}
    </div>
  );

  const fullSubtitle = (
    <div className="sentence__subtitle">
      <span className="sentence__wm" aria-hidden="true">{idx + 1}</span>
      <div style={{ fontSize: "var(--fs-sentence)", color: "var(--text)", lineHeight: "var(--lh-sentence)", marginBottom: s.chinese_text && showChinese ? 6 : 0 }}>
        {renderEnglish(highlightCurrent)}
      </div>
      {s.chinese_text && showChinese && <div style={{ fontSize: "var(--fs-secondary)", color: "var(--text-2)", lineHeight: "var(--lh-body)" }}>{s.chinese_text}</div>}
    </div>
  );

  let body: React.ReactNode = null;

  if (p.practiceMode === "view") {
    // 精听（字幕隐藏）→ 保持隐藏，逼用户靠听力；点击后显示字幕。
    // 显示字幕时，若开启逐词高亮则启用卡拉OK逐词点亮（见 highlightCurrent）。
    body = isHidden ? (
      <div style={{ position: "relative", borderRadius: "var(--r-md)", minHeight: 80 }}>
        <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none" }}>{fullSubtitle}</div>
        <div
          onClick={(e) => { e.stopPropagation(); p.revealIntensive(); }}
          className="intensive-mask"
        >
          <Icon name="lock" size={14} /> 字幕已隐藏 · 点击显示
        </div>
      </div>
    ) : fullSubtitle;
  } else if (p.practiceMode === "shadow") {
    body = subtitleBlock;
    if (isCurrent && p.recognizedText) {
      body = (
        <>
          {subtitleBlock}
          <div className="shadow-result">
            <div className="shadow-result__label">你的跟读：</div>
            <div style={{ fontSize: "calc(var(--fs-body) - 1px)", lineHeight: "var(--lh-body)" }}>
              {compareWords(s.english_text, p.recognizedText).originalWords.map((w, i) => (
                <span key={i} className={p.wordMatches[i] ? "word-ok" : "word-bad"} style={{ marginRight: 4 }}>{w}</span>
              ))}
            </div>
          </div>
        </>
      );
    }
  } else if (p.practiceMode === "dictation") {
    const showHint = !!s.chinese_text && (p.subtitleMode === "chinese" || p.subtitleMode === "both");
    const dm = compareWords(s.english_text, p.dictationTexts[s.id] || "");
    const checked = !!p.dictationChecked[s.id];
    body = (
      <div>
        {showHint && <div style={{ fontSize: "var(--fs-secondary)", color: "var(--text-2)", marginBottom: 8 }}>{s.chinese_text}</div>}
        <textarea
          className="input"
          value={p.dictationTexts[s.id] || ""}
          onChange={(e) => p.setDictationText(s.id, e.target.value)}
          placeholder="听写：写下你听到的英文"
          rows={2}
          disabled={checked}
          onClick={(e) => e.stopPropagation()}
          style={{ resize: "none", background: checked ? "color-mix(in srgb, var(--text) 3%, transparent)" : "transparent" }}
        />
        {checked && (
          <div style={{ marginTop: 8, fontSize: "calc(var(--fs-body) - 1px)", lineHeight: "var(--lh-body)" }}>
            {dm.originalWords.map((w, i) => (
              <span key={i} className={dm.matches[i] ? "word-ok" : "word-bad"} style={{ marginRight: 4 }}>{w}</span>
            ))}
          </div>
        )}
      </div>
    );
  } else if (p.practiceMode === "cloze") {
    const wordIdx = tokens.map((t, i) => ({ t, i })).filter((o) => !o.t.space);
    const hardIdx = wordIdx.filter((o) => o.t.isHard).map((o) => o.i);
    let blanks = hardIdx;
    if (blanks.length < Math.min(3, wordIdx.length)) {
      const others = wordIdx.filter((o) => !o.t.isHard && !blanks.includes(o.i)).map((o) => o.i);
      const need = Math.min(3, wordIdx.length) - blanks.length;
      for (let k = 0; k < need; k++) blanks.push(others[Math.floor((k * others.length) / Math.max(1, need))] ?? others[others.length - 1]);
    }
    const blankSet = new Set(blanks);
    const showHint = !!s.chinese_text && (p.subtitleMode === "chinese" || p.subtitleMode === "both");
    const checked = !!p.clozeChecked[s.id];
    const answers = p.clozeAnswers[s.id] || {};
    body = (
      <div>
        {showHint && <div style={{ fontSize: "var(--fs-secondary)", color: "var(--text-2)", marginBottom: 8 }}>{s.chinese_text}</div>}
        <div style={{ fontSize: "var(--fs-sentence)", color: "var(--text)", lineHeight: "var(--lh-sentence)" }}>
          {tokens.map((t, i) => {
            if (t.space) return <span key={i}>{t.text}</span>;
            if (blankSet.has(i)) {
              const target = t.text.toLowerCase().replace(/[^a-z']/g, "");
              const answer = (answers[i] || "").trim().toLowerCase();
              return (
                <input
                  key={i}
                  value={answers[i] || ""}
                  onChange={(e) => p.setClozeAnswer(s.id, i, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={checked}
                  style={{
                    fontFamily: "var(--ff)", fontSize: "var(--fs-sentence)", margin: "0 2px",
                    border: "none",
                    borderBottom: `2px solid ${checked ? (answer === target ? "var(--success)" : "var(--danger)") : "var(--border)"}`,
                    background: checked && answer !== target ? "color-mix(in srgb, var(--danger) 8%, transparent)" : "transparent",
                    color: "var(--text)", width: `${Math.max(3, t.text.length + 1)}ch`, textAlign: "center",
                  }}
                />
              );
            }
            return <span key={i} style={{ color: t.isHard ? "var(--danger)" : "var(--text)", fontWeight: t.isHard ? "var(--fw-bold)" : "var(--fw-regular)" }}>{t.text}</span>;
          })}
        </div>
        {checked && (
          <div className="meta" style={{ marginTop: 8 }}>
            答案：{wordIdx.filter((o) => blankSet.has(o.i)).map((o) => o.t.text).join(" / ")}
          </div>
        )}
      </div>
    );
  }

  // 是否走字幕分支（view/shadow 用 subtitleBlock/fullSubtitle，watermark 内嵌字幕容器）
  // dictation/cloze 走 textarea/inputs，把 watermark 放在卡片根（沿用旧的卡片居中）
  const inSubtitleMode = p.practiceMode === "view" || p.practiceMode === "shadow";

  return (
    <div className="practice__panel sentence sentence--current" onClick={(e) => e.stopPropagation()}>
      {!inSubtitleMode && <span className="sentence__wm" aria-hidden="true">{idx + 1}</span>}
      {body}
      <div className="sentence__bar">
        <button aria-label={`play-sentence-${idx}`} onClick={() => p.playSentenceAt(idx)} className="round-play"><Icon name="play" size={11} /></button>
        <div style={{ flex: 1 }} />
        {p.practiceMode === "dictation" && (
          <CheckBtn label={`check-dictation-${idx}`} checked={!!p.dictationChecked[s.id]} onCheck={() => p.checkDictation(s.id)} onRedo={() => p.redoDictation(s.id)} />
        )}
        {p.practiceMode === "cloze" && (
          <CheckBtn label={`check-cloze-${idx}`} checked={!!p.clozeChecked[s.id]} onCheck={() => p.checkCloze(s.id)} onRedo={() => p.redoCloze(s.id)} />
        )}
        {p.practiceMode === "shadow" && <ShadowActions p={p} s={s} idx={idx} />}
        {p.practiceMode === "view" && (
          <>
            <ActionBtn label="复制" onClick={() => p.copySentence(s.english_text)}><Icon name="copy" size={15} /></ActionBtn>
            <ActionBtn label="收藏" active={p.favorites.has(s.id)} onClick={() => p.toggleFav(s.id)}>
              <Icon name={p.favorites.has(s.id) ? "starFill" : "star"} size={15} />
            </ActionBtn>
            <ActionBtn label="笔记" badge={!!p.notes[s.id]} onClick={() => p.openNote(s.id)}><Icon name="note" size={15} /></ActionBtn>
          </>
        )}
      </div>
      {p.practiceMode === "view" && p.openNoteId === s.id && <NoteEditor s={s} p={p} />}
    </div>
  );
}
