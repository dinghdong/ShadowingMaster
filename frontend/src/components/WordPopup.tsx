import { AppState } from "../useApp";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import { posLabel } from "../shared";

// 生词释义弹窗（跟读页 / 生词本共用）。
// - 跟读页：底部为「加入生词本」
// - 生词本（wordPopupOrigin 存在）：底部为「回到原句」，隐藏「加入生词本」
export function WordPopup({ p }: { p: AppState }) {
  if (!p.selectedWord) return null;
  const origin = p.wordPopupOrigin;
  const isWordbook = !!origin;
  return (
    <div className="modal-backdrop" onClick={p.closeWord}>
      <div className="modal modal--md" onClick={(e) => e.stopPropagation()}>
        <div className="word-head">
          <div className="word-head__text">{p.selectedWord}</div>
          {p.wordDetail?.phonetic && <div className="word-head__phon">{p.wordDetail.phonetic}</div>}
          <button aria-label="speak-word" onClick={() => p.speakWord(p.selectedWord!)} className="icon-btn" style={{ marginLeft: "auto" }}><Icon name="volume" size={16} /></button>
        </div>

        <div className="scroll-y" style={{ overflowY: "auto", marginBottom: "var(--sp-4)" }}>
          {!p.wordDetail && <div style={{ padding: "var(--sp-3) 0" }}><Spinner size="sm" label="加载中…" /></div>}
          {p.wordDetail?.notFound && (
            <div className="hint">
              未找到在线释义。
              {(origin?.definitionZh || origin?.definition) && (
                <div className="meaning" style={{ marginTop: "var(--sp-2)" }}>{origin?.definitionZh || origin?.definition}</div>
              )}
            </div>
          )}
          {p.wordDetail?.meanings?.map((m, i) => (
            <div key={i} style={{ marginBottom: "var(--sp-3)" }}>
              <div className="pos-tag">{posLabel(m.partOfSpeech)}</div>
              {/* 中文释义为主，英文释义作对照（翻译缺失时回退） */}
              <div className="meaning">{m.definitionZh || m.definition}</div>
              {m.definitionZh && m.definition && m.definitionZh !== m.definition && (
                <div className="meaning-en">{m.definition}</div>
              )}
              {m.example && (
                <div className="example">
                  “{m.example}”
                  <button aria-label={`speak-example-${i}`} onClick={() => p.speakWord(m.example!)} className="example__speak"><Icon name="volume" size={12} /></button>
                </div>
              )}
              {m.exampleZh && <div className="example-zh">“{m.exampleZh}”</div>}
            </div>
          ))}
        </div>

        {isWordbook ? (
          <>
            {origin && origin.videoId && origin.sentenceId && (
              <button
                onClick={() => { p.openWordOrigin({ video_id: origin.videoId, sentence_id: origin.sentenceId }); p.closeWord(); }}
                className="btn btn--primary btn--block"
                style={{ marginBottom: 10 }}
              >
                <Icon name="reply" size={16} /> 回到原句
              </button>
            )}
            <button onClick={p.closeWord} className="btn btn--ghost btn--block">关闭</button>
          </>
        ) : (
          <>
            {p.user && (
              <button onClick={p.addToWordBook} className="btn btn--primary btn--block" style={{ marginBottom: 10 }}>
                <Icon name="plus" size={16} /> 加入生词本
              </button>
            )}
            <button onClick={p.closeWord} className="btn btn--ghost btn--block">关闭</button>
          </>
        )}
      </div>
    </div>
  );
}
