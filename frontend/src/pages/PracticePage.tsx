import { useState } from "react";
import { AppState } from "../useApp";
import { mediaUrl } from "../shared";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { ModeBar } from "../features/practice/ModeBar";
import { SentenceCard } from "../features/practice/SentenceCard";
import { SentenceRow } from "../features/practice/SentenceRow";
import { WordPopup } from "../components/WordPopup";

// 评分配色 / 文案（跟读评价）—— 用语义 CSS 变量，随深浅主题自适应
const scoreVar = (v: number) =>
  v >= 80 ? "var(--success)" : v >= 60 ? "var(--warning)" : "var(--danger)";
const scoreLabel = (v: number) =>
  v >= 90 ? "发音地道" : v >= 80 ? "很好" : v >= 60 ? "不错，继续练" : "多听多模仿";

// ─── 跟读页 ───
export default function PracticePage({ app, isMobile }: { app: AppState; isMobile: boolean }) {
  const p = app;
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 进页加载视频句子时：展示双栏骨架占位，消除「句子为空 → 整页白屏」的最严重缺口
  if (p.playerLoading) {
    return (
      <div className="app practice">
        <div className="practice-skeleton">
          <div className="practice-skeleton__left">
            <div className="practice-skeleton__player skeleton" />
            <div className="skeleton-line skeleton" style={{ width: "55%" }} />
            <div className="skeleton-line skeleton" style={{ width: "38%" }} />
          </div>
          <div className="practice-skeleton__right">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="practice-skeleton__row skeleton" />
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          <Spinner size="sm" label="加载中…" />
        </div>
      </div>
    );
  }

  return (
    <div className="app practice">
      <div className="practice__left">
      {/* PC 端页面标题区：返回 + 居中标题 + 生词本/设置（移动端由 .navbar--keep 内部 lead 提供，互斥显示） */}
      {!isMobile && (
        <div className="practice__page-header">
          <button className="practice__back" onClick={() => p.setPage("list")} aria-label="返回视频列表">
            <Icon name="arrowLeft" size={18} /> 返回列表
          </button>
          <h1 className="practice__title" title={p.currentVideo?.title}>
            {p.currentVideo?.title || "跟读"}
          </h1>
          <div className="practice__actions">
            <button className="icon-btn" onClick={() => p.setPage("wordbook")} title="生词本" aria-label="生词本">
              <Icon name="book" size={18} />
            </button>
            <div className="practice__settings" style={{ position: "relative", zIndex: "var(--z-popover)" }}>
              <button
                aria-label="settings"
                onClick={() => setSettingsOpen((o) => !o)}
                className={`icon-btn ${settingsOpen ? "icon-btn--on" : ""}`}
                title="偏好设置"
              ><Icon name="gear" size={18} /></button>
              {settingsOpen && (
                <>
                  <div aria-label="settings-backdrop" onClick={() => setSettingsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1200 }} />
                  <div onClick={(e) => e.stopPropagation()} className="popover">
                    <div className="section-label" style={{ marginBottom: "var(--sp-3)" }}>偏好设置</div>

                    <div style={{ marginBottom: "var(--sp-3)" }}>
                      <div className="setting-row__label" style={{ marginBottom: 6 }}>字幕显示</div>
                      <div className="segmented">
                        {(["both", "english", "chinese"] as const).map((mode) => (
                          <button key={mode} onClick={() => p.setSubtitleMode(mode)}
                            className={`segmented__btn ${p.subtitleMode === mode ? "segmented__btn--active" : ""}`}>
                            {mode === "both" ? "英中" : mode === "english" ? "英文" : "中文"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="setting-row">
                      <span className="setting-row__label">逐词高亮</span>
                      <button onClick={() => p.setWordHighlight(!p.wordHighlight)} aria-label="toggle-word-highlight"
                        className={`toggle ${p.wordHighlight ? "toggle--on" : ""}`}>
                        <span className="toggle__knob" />
                      </button>
                    </div>

                    <div className="setting-row">
                      <span className="setting-row__label">单句循环</span>
                      <button onClick={() => p.setLoopSingle(!p.loopSingle)} aria-label="toggle-loop-single"
                        className={`toggle ${p.loopSingle ? "toggle--on" : ""}`}>
                        <span className="toggle__knob" />
                      </button>
                    </div>

                    <div style={{ marginTop: "var(--sp-3)" }}>
                      <div className="setting-row__label" style={{ marginBottom: 6 }}>播放速度</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {p.RATES.map((r) => (
                          <button key={r} onClick={() => p.setRate(r)}
                            className={`btn btn--sm ${p.rate === r ? "btn--primary" : "btn--outline"}`}
                            style={{ flex: 1, padding: "7px 0" }}>{r}x</button>
                        ))}
                      </div>
                    </div>

                    <div className="meta" style={{ marginTop: "var(--sp-3)", opacity: 0.8 }}>设置已自动保存</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="player-bar">
        <div className="navbar navbar--keep">
          <div className="navbar__lead">
            <button className="icon-btn icon-btn--plain navbar__back" onClick={() => p.setPage("list")} aria-label="返回"><Icon name="arrowLeft" size={22} /></button>
            <div className="navbar__title" style={{ fontSize: "calc(var(--fs-body) - 1px)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.currentVideo?.title || "跟读"}</div>
            <button className="icon-btn navbar__wordbook" onClick={() => p.setPage("wordbook")} title="生词本" aria-label="生词本"><Icon name="book" size={18} /></button>
          </div>
          <div className="navbar__settings" style={{ position: "relative", zIndex: "var(--z-popover)" }}>
            <button
              aria-label="settings"
              onClick={() => setSettingsOpen((o) => !o)}
              className={`icon-btn ${settingsOpen ? "icon-btn--on" : ""}`}
            ><Icon name="gear" size={18} /></button>
            {settingsOpen && (
              <>
                <div aria-label="settings-backdrop" onClick={() => setSettingsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1200 }} />
                <div onClick={(e) => e.stopPropagation()} className="popover">
                  <div className="section-label" style={{ marginBottom: "var(--sp-3)" }}>偏好设置</div>

                  <div style={{ marginBottom: "var(--sp-3)" }}>
                    <div className="setting-row__label" style={{ marginBottom: 6 }}>字幕显示</div>
                    <div className="segmented">
                      {(["both", "english", "chinese"] as const).map((mode) => (
                        <button key={mode} onClick={() => p.setSubtitleMode(mode)}
                          className={`segmented__btn ${p.subtitleMode === mode ? "segmented__btn--active" : ""}`}>
                          {mode === "both" ? "英中" : mode === "english" ? "英文" : "中文"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setting-row">
                    <span className="setting-row__label">逐词高亮</span>
                    <button onClick={() => p.setWordHighlight(!p.wordHighlight)} aria-label="toggle-word-highlight"
                      className={`toggle ${p.wordHighlight ? "toggle--on" : ""}`}>
                      <span className="toggle__knob" />
                    </button>
                  </div>

                  <div className="setting-row">
                    <span className="setting-row__label">单句循环</span>
                    <button onClick={() => p.setLoopSingle(!p.loopSingle)} aria-label="toggle-loop-single"
                      className={`toggle ${p.loopSingle ? "toggle--on" : ""}`}>
                      <span className="toggle__knob" />
                    </button>
                  </div>

                  <div style={{ marginTop: "var(--sp-3)" }}>
                    <div className="setting-row__label" style={{ marginBottom: 6 }}>播放速度</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {p.RATES.map((r) => (
                        <button key={r} onClick={() => p.setRate(r)}
                          className={`btn btn--sm ${p.rate === r ? "btn--primary" : "btn--outline"}`}
                          style={{ flex: 1, padding: "7px 0" }}>{r}x</button>
                      ))}
                    </div>
                  </div>

                  <div className="meta" style={{ marginTop: "var(--sp-3)", opacity: 0.8 }}>设置已自动保存</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="page-pad">
          <div className={`player-frame ${p.isPlaying ? "player-frame--playing" : ""}`}>
            {p.currentVideo?.video_path ? (
              <video
                ref={p.videoRef}
                src={mediaUrl(p.currentVideo.video_path)}
                poster={mediaUrl(p.currentVideo.thumbnail_url)}
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onClick={p.togglePlay}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  // 跟随视频真实宽高比：横屏/竖屏/方屏都自然适配，不再被 16:9 容器压窄
                  const w = v.videoWidth || 16;
                  const h = v.videoHeight || 9;
                  const frame = v.closest(".player-frame") as HTMLElement | null;
                  if (frame) frame.style.setProperty("--video-aspect", String(w / h));
                  p.onVideoLoaded();
                }}
                onPlay={() => p.setIsPlaying(true)}
                onPause={() => p.setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  p.handleTimeUpdate(v.currentTime, v.paused);
                }}
              />
            ) : (
              <div style={{ color: "#fff", fontSize: "var(--fs-secondary)" }}>暂无视频文件</div>
            )}
            <button
              aria-label="play-pause"
              onClick={(e) => { e.stopPropagation(); p.togglePlay(); }}
              className="play-fab"
            ><Icon name={p.isPlaying ? "pause" : "play"} size={18} /></button>
          </div>
        </div>

        <div className="practice__divider" />

        {/* PC 端：模式控件 + 当前句练习台常驻左栏；手机端下移到列表中的当前句 */}
        {!isMobile && (
          <>
            <ModeBar p={p} />
            {p.currentSentence && (
              <SentenceCard p={p} s={p.currentSentence} idx={p.currentIndex} />
            )}
          </>
        )}
      </div>
      </div>

      <div className="page-pad practice__right">
        {p.sentences.map((s, idx) =>
          isMobile && idx === p.currentIndex ? (
            <div key={s.id} id={`sent-${idx}`} className="practice__expanded">
              <ModeBar p={p} />
              <SentenceCard p={p} s={s} idx={idx} />
            </div>
          ) : (
            <SentenceRow key={s.id} p={p} s={s} idx={idx} />
          )
        )}
      </div>

      {p.resumeIndex != null && !p.resumeDismissed && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "var(--sp-2)", background: "var(--primary)", color: "var(--on-primary)", padding: "9px 9px 9px 16px", borderRadius: "var(--r-pill)", boxShadow: "var(--shadow-float)", fontFamily: "var(--ff)", fontSize: "var(--fs-secondary)", fontWeight: "var(--fw-semibold)", zIndex: "var(--z-toast)", maxWidth: "90vw" }}>
          <button onClick={p.jumpToStart} style={{ background: "none", border: "none", color: "var(--on-primary)", fontFamily: "var(--ff)", fontSize: "var(--fs-secondary)", fontWeight: "var(--fw-bold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
            <span style={{ fontSize: "var(--fs-body)" }}>▶</span> 从头开始
          </button>
          <button onClick={p.dismissStart} aria-label="dismiss-start" title="不再提示" style={{ background: "rgba(255,255,255,0.22)", border: "none", color: "var(--on-primary)", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      )}

      {p.toast && (
        <div className="toast">{p.toast}</div>
      )}

      {p.evalOpenId != null && (() => {
        const rec = p.recordings[p.evalOpenId];
        const sc = rec?.score;
        if (!sc) {
          return (
            <div className="modal-backdrop" onClick={p.closeEval}>
              <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
                <div className="empty__icon"><Icon name="mic" size={40} /></div>
                <div className="title-strong" style={{ marginBottom: "var(--sp-1)" }}>还没有录音</div>
                <div className="hint">点击本句的「录音」按钮，完成跟读后会自动生成评价。</div>
                <button className="btn btn--primary btn--block" style={{ marginTop: "var(--sp-4)" }} onClick={p.closeEval}>知道了</button>
              </div>
            </div>
          );
        }
        return (
          <div className="modal-backdrop" onClick={p.closeEval}>
            <div className="modal modal--md" onClick={(e) => e.stopPropagation()}>
              <div className="row" style={{ marginBottom: "var(--sp-4)" }}>
                <div className="score-circle" style={{ background: scoreVar(sc.overall) }}>
                  <span className="score-circle__num">{sc.overall}</span>
                  <span className="score-circle__unit">分</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="title-strong" style={{ fontSize: "var(--fs-secondary)" }}>跟读评价</div>
                  <div className="meta" style={{ marginTop: 2 }}>{scoreLabel(sc.overall)}</div>
                </div>
                <button className="modal__close" onClick={p.closeEval} aria-label="close-eval"><Icon name="close" size={24} /></button>
              </div>

              {([["准确度", sc.accuracy], ["完整度", sc.coverage], ["流利度", sc.fluency]] as const).map(([label, val]) => (
                <div key={label} style={{ marginBottom: "var(--sp-2)" }}>
                  <div className="row row--between" style={{ fontSize: "var(--fs-meta)", color: "var(--text-2)", marginBottom: 4 }}>
                    <span>{label}</span><span style={{ color: "var(--text)" }}>{val}</span>
                  </div>
                  <div className="bar">
                    <div className="bar__fill" style={{ width: `${val}%`, background: scoreVar(val) }} />
                  </div>
                </div>
              ))}

              <div className="meta" style={{ margin: "calc(var(--sp-2) * 1px) 0 6px" }}>逐词对照</div>
              <div className="scroll-y" style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ fontSize: "calc(var(--fs-body) - 1px)", lineHeight: "var(--lh-body)", display: "flex", flexWrap: "wrap", gap: "4px 6px" }}>
                  {sc.perWord.map((w, i) => (
                    <span key={i} className={w.ok ? "word-ok" : "word-bad"}>{w.word}</span>
                  ))}
                </div>
                {sc.recognizedText && (
                  <div className="meta" style={{ marginTop: "var(--sp-3)", lineHeight: "var(--lh-body)" }}>
                    识别文本：{sc.recognizedText}
                  </div>
                )}
              </div>

              <div className="meta" style={{ marginTop: "var(--sp-3)", opacity: 0.75 }}>
                评分为本地语音识别的参考结果，仅供参考
              </div>
            </div>
          </div>
        );
      })()}

      {p.selectedWord && <WordPopup p={p} />}
    </div>
  );
}
