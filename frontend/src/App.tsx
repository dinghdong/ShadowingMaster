import { useState, useEffect } from "react";
import { useApp, AppState } from "./useApp";
import { tokenize, compareWords, mediaUrl } from "./shared";
import { color, font, space, radius, shadow } from "./theme";

const FF = font.family;
const FS = font.size;
const FW = font.weight;

function LoginPage(p: AppState) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: space.md + 2, borderRadius: radius.md, fontFamily: FF,
    border: `1px solid ${color.border}`, marginBottom: space.md, fontSize: FS.body, boxSizing: "border-box",
  };
  return (
    <div style={{ minHeight: "100vh", background: color.bg, fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: FS.brand, fontWeight: FW.heavy, color: color.primary, marginBottom: space.sm }}>ShadowingMaster</div>
      <div style={{ color: color.textLight, fontSize: FS.secondary, marginBottom: 40 }}>英语口语跟读训练</div>
      <div style={{ width: "100%", maxWidth: 360, background: color.card, borderRadius: radius.xl, padding: space.xxxl, boxShadow: shadow.float }}>
        <div style={{ display: "flex", gap: space.sm, marginBottom: space.xxl }}>
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: space.md, borderRadius: radius.md, border: "none", fontFamily: FF, background: mode === m ? color.primary : "transparent", color: mode === m ? "#fff" : color.textLight, fontWeight: FW.semibold, fontSize: FS.secondary, cursor: "pointer" }}>{m === "login" ? "登录" : "注册"}</button>
          ))}
        </div>
        <input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <input placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: space.lg }} />
        {p.error && <div style={{ color: color.hardWord, fontSize: FS.meta, marginBottom: space.md }}>{p.error}</div>}
        <button onClick={() => (mode === "login" ? p.handleLogin(email, password) : p.handleRegister(email, password))} style={{ width: "100%", padding: space.md + 2, borderRadius: radius.md, border: "none", fontFamily: FF, background: color.primary, color: "#fff", fontWeight: FW.bold, fontSize: FS.body, cursor: "pointer" }}>{mode === "login" ? "登 录" : "注 册"}</button>
        <button onClick={() => p.setPage("list")} style={{ width: "100%", marginTop: space.md, padding: space.md, background: "transparent", border: "none", fontFamily: FF, fontSize: FS.secondary, color: color.textLight, cursor: "pointer" }}>先逛逛 →</button>
      </div>
    </div>
  );
}

export default function App() {
  const p = useApp();

  // （连续播放模型）进页自动播放由 video onLoadedMetadata → p.onVideoLoaded 完成；
  // 切句/跳句由 p.jumpToSentence 显式 seek；高亮跟随播放头（p.handleTimeUpdate）

  // 倍速同步到 video 元素
  useEffect(() => {
    if (p.videoRef.current) p.videoRef.current.playbackRate = p.rate;
  }, [p.rate, p.page, p.currentVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切句时把当前句气泡滚动到视口中部
  useEffect(() => {
    if (p.page !== "player") return;
    document.getElementById(`sent-${p.currentIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [p.page, p.currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (p.loading) return <div style={{ minHeight: "100vh", background: color.bg, fontFamily: FF, display: "flex", alignItems: "center", justifyContent: "center", color: color.textLight }}>Loading...</div>;

  if (p.page === "login") return <LoginPage {...p} />;

  // ─── 视频列表页 ───
  if (p.page === "list") {
    return (
      <div style={{ minHeight: "100vh", background: color.bg, fontFamily: FF, paddingBottom: 80 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${space.lg}px ${space.xl}px` }}>
          <div style={{ fontSize: FS.pageTitle, fontWeight: FW.heavy, color: color.primary }}>ShadowingMaster</div>
          <div style={{ display: "flex", gap: space.md, alignItems: "center" }}>
            {p.user ? (
              <>
                <span style={{ color: color.textLight, fontSize: FS.secondary }}>{p.user.email}</span>
                <button onClick={() => p.setPage("wordbook")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>📖</button>
                <button onClick={p.handleLogout} style={{ background: color.card, border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: "6px 12px", fontFamily: FF, fontSize: FS.meta, color: color.text, cursor: "pointer" }}>退出</button>
              </>
            ) : (
              <button onClick={() => p.setPage("login")} style={{ background: color.primary, color: "#fff", border: "none", borderRadius: radius.pill, padding: "8px 20px", fontFamily: FF, fontSize: FS.secondary, fontWeight: FW.semibold, cursor: "pointer" }}>登录</button>
            )}
          </div>
        </div>
        <div style={{ padding: `0 ${space.pagePadding}px` }}>
          {p.videos.map((v) => (
            <div key={v.id} onClick={() => p.openVideo(v.id)} style={{ background: color.card, borderRadius: radius.lg, marginBottom: space.lg, overflow: "hidden", boxShadow: shadow.card, cursor: "pointer" }}>
              <div style={{ height: 180, background: "linear-gradient(135deg, #FFE5D9, #FFD6BA)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {v.thumbnail_url ? <img src={mediaUrl(v.thumbnail_url)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ color: color.primary }}>🎬</span>}
              </div>
              <div style={{ padding: space.lg }}>
                <div style={{ fontWeight: FW.bold, fontSize: FS.body, color: color.text, marginBottom: 6 }}>{v.title}</div>
                <div style={{ display: "flex", gap: space.md, fontSize: FS.meta, color: color.textLight }}>
                  <span>⏱ {Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, "0")}</span>
                  <span>📝 {v.sentence_count}句</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── 生词本页 ───
  if (p.page === "wordbook") {
    return (
      <div style={{ minHeight: "100vh", background: color.bg, fontFamily: FF, paddingBottom: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.md, padding: `${space.lg}px ${space.xl}px` }}>
          <button onClick={() => p.setPage("list")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>←</button>
          <div style={{ fontSize: FS.title, fontWeight: FW.bold, color: color.text }}>我的生词本</div>
        </div>
        <div style={{ padding: `0 ${space.pagePadding}px` }}>
          {!p.user ? <div style={{ textAlign: "center", padding: 60, color: color.textLight, fontSize: FS.secondary }}>请登录后查看生词本</div> :
           p.wordBook.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: color.textLight, fontSize: FS.secondary }}>还没有收藏生词</div> :
           p.wordBook.map((w: any) => (
            <div key={w.id} onClick={() => p.openWordOrigin(w)} style={{ background: color.card, borderRadius: radius.lg - 2, padding: space.lg, marginBottom: space.md, boxShadow: shadow.card, cursor: w.video_id && w.sentence_id ? "pointer" : "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space.xs }}>
                <div style={{ fontSize: FS.title, fontWeight: FW.bold, color: color.text }}>{w.word}</div>
                {w.video_id && w.sentence_id && <div style={{ fontSize: FS.meta, color: color.primary, fontWeight: FW.semibold }}>↩ 回到原句</div>}
              </div>
              <div style={{ fontSize: FS.secondary, color: color.textLight, lineHeight: font.lineHeight.body }}>{w.definition || "暂无释义"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── 跟读页 ───
  return (
    <div style={{ minHeight: "100vh", background: color.bg, fontFamily: FF, paddingBottom: 110 }}>
      {/* 头部 + 播放器吸顶固定：字幕滚动时播放器不滚走 */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: color.bg, paddingBottom: space.sm }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.md, padding: `${space.md}px ${space.lg}px` }}>
          <button onClick={() => p.setPage("list")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>←</button>
          <div style={{ fontSize: FS.body - 1, fontWeight: FW.semibold, color: color.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.currentVideo?.title || "跟读"}</div>
          <button onClick={() => p.setPage("wordbook")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>📖</button>
        </div>

        <div style={{ padding: `0 ${space.pagePadding}px`, marginBottom: space.sm }}>
          <div style={{ borderRadius: radius.lg, overflow: "hidden", background: "#000", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {p.currentVideo?.video_path ? (
              <video
                ref={p.videoRef}
                src={mediaUrl(p.currentVideo.video_path)}
                poster={mediaUrl(p.currentVideo.thumbnail_url)}
                playsInline
                style={{ width: "100%", height: "100%" }}
                onClick={p.togglePlay}
                onLoadedMetadata={p.onVideoLoaded}
                onPlay={() => p.setIsPlaying(true)}
                onPause={() => p.setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  p.handleTimeUpdate(v.currentTime, v.paused);
                }}
              />
            ) : (
              <div style={{ color: "#fff", fontSize: FS.secondary }}>▶ 暂无视频文件</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: space.sm, padding: `0 ${space.pagePadding}px`, marginBottom: space.md }}>
        {(["both", "english", "chinese", "none"] as const).map((m) => (
          <button key={m} onClick={() => p.setSubtitleMode(m)} style={{ padding: "6px 14px", borderRadius: radius.pill, border: "none", fontFamily: FF, background: p.subtitleMode === m ? color.primary : color.card, color: p.subtitleMode === m ? "#fff" : color.textLight, fontSize: FS.meta, cursor: "pointer" }}>{m === "both" ? "英中" : m === "english" ? "仅英文" : m === "chinese" ? "仅中文" : "盲听"}</button>
        ))}
      </div>

      <div style={{ padding: `0 ${space.pagePadding}px`, display: "flex", flexDirection: "column", gap: 10 }}>
        {p.sentences.map((s, idx) => {
          const isCurrent = idx === p.currentIndex;
          const tokens = tokenize(s.english_text);
          return (
            <div key={s.id} id={`sent-${idx}`} onClick={() => p.jumpToSentence(idx)} style={{ background: isCurrent ? color.primarySoft : idx < p.currentIndex ? color.readBg : color.card, borderRadius: radius.lg, padding: space.md + 2, border: isCurrent ? `2px solid ${color.primary}` : `1px solid ${color.border}`, cursor: "pointer" }}>
              {(p.subtitleMode === "english" || p.subtitleMode === "both") && (
                <div style={{ fontSize: FS.sentence, color: color.text, lineHeight: font.lineHeight.sentence, marginBottom: s.chinese_text && p.subtitleMode === "both" ? 6 : 0 }}>
                  {tokens.map((t, i) => (
                    <span key={i} onClick={(e) => { if (t.isHard) { e.stopPropagation(); p.handleWordClick(t.text); } }} style={{ color: t.isHard ? color.hardWord : color.text, fontWeight: t.isHard ? FW.bold : FW.regular, cursor: t.isHard ? "pointer" : "default", background: t.isHard ? "rgba(231,76,60,0.08)" : "transparent", borderRadius: space.xs, padding: t.isHard ? "0 2px" : 0 }}>{t.text}</span>
                  ))}
                </div>
              )}
              {s.chinese_text && (p.subtitleMode === "chinese" || p.subtitleMode === "both") && (
                <div style={{ fontSize: FS.secondary, color: color.textLight, lineHeight: font.lineHeight.body }}>{s.chinese_text}</div>
              )}
              {p.subtitleMode === "none" && isCurrent && (
                <div style={{ fontSize: FS.secondary, color: color.textLight, textAlign: "center", padding: `${space.sm}px 0` }}>🎧 盲听中…</div>
              )}
              {/* 句号 + 单句播放（不切换当前句） */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                <span style={{ fontSize: FS.tiny, color: color.textLight }}>{idx + 1}</span>
                <button aria-label={`play-sentence-${idx}`} onClick={() => p.playSentenceAt(idx)} style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${color.border}`, background: color.card, color: color.primary, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", paddingLeft: 2 }}>▶</button>
              </div>
              {isCurrent && p.recognizedText && (
                <div style={{ marginTop: 10, padding: 10, background: color.card, borderRadius: radius.md - 2, border: `1px dashed ${color.border}` }}>
                  <div style={{ fontSize: FS.tiny, color: color.textLight, marginBottom: space.xs }}>🎤 你的跟读：</div>
                  <div style={{ fontSize: FS.body - 1, lineHeight: font.lineHeight.body }}>
                    {compareWords(s.english_text, p.recognizedText).originalWords.map((w, i) => (
                      <span key={i} style={{ color: p.wordMatches[i] ? color.correct : color.hardWord, fontWeight: p.wordMatches[i] ? FW.regular : FW.bold, textDecoration: p.wordMatches[i] ? "none" : "line-through", marginRight: 4 }}>{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: space.sm, padding: `10px ${space.md}px`, background: "rgba(255,248,240,0.95)", backdropFilter: "blur(8px)", borderTop: `1px solid ${color.border}` }}>
        <button aria-label="play-pause" onClick={p.togglePlay} style={{ width: 44, height: 40, borderRadius: radius.md, border: `1px solid ${color.border}`, background: color.card, fontFamily: FF, fontSize: FS.body, color: color.text, cursor: "pointer" }}>{p.isPlaying ? "⏸" : "▶"}</button>
        <button onClick={p.startShadowing} disabled={p.isRecording} style={{ padding: "10px 22px", borderRadius: radius.pill, border: "none", fontFamily: FF, background: p.isRecording ? color.hardWord : color.primary, color: "#fff", fontSize: FS.secondary, fontWeight: FW.bold, cursor: p.isRecording ? "not-allowed" : "pointer" }}>{p.isRecording ? "🎙 录音中..." : "🎤 跟读"}</button>
        <button aria-label="loop-single" onClick={() => p.setLoopSingle(!p.loopSingle)} style={{ width: 44, height: 40, borderRadius: radius.md, border: "none", background: p.loopSingle ? color.primary : color.card, color: p.loopSingle ? "#fff" : color.textLight, fontFamily: FF, fontSize: FS.tiny, fontWeight: FW.semibold, cursor: p.loopSingle ? "pointer" : "pointer", outline: p.loopSingle ? "none" : `1px solid ${color.border}` }}>单句</button>
        <button aria-label="rate-toggle" onClick={p.cycleRate} style={{ width: 52, height: 40, borderRadius: radius.md, border: `1px solid ${color.border}`, background: color.card, fontFamily: FF, fontSize: FS.tiny, fontWeight: FW.semibold, color: p.rate === 1 ? color.textLight : color.primary, cursor: "pointer" }}>{p.rate}x</button>
      </div>

      {p.selectedWord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: space.xl, fontFamily: FF }} onClick={p.closeWord}>
          <div style={{ background: color.card, borderRadius: radius.xl, padding: space.xxl, width: "100%", maxWidth: 320, boxShadow: shadow.card }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 24, fontWeight: FW.heavy, color: color.text, marginBottom: space.sm }}>{p.selectedWord}</div>
            <div style={{ fontSize: FS.secondary, color: color.textLight, lineHeight: font.lineHeight.body, marginBottom: space.xl }}>{p.wordDef}</div>
            {p.user && <button onClick={p.addToWordBook} style={{ width: "100%", padding: space.md + 2, borderRadius: radius.md, border: "none", fontFamily: FF, background: color.primary, color: "#fff", fontWeight: FW.bold, fontSize: FS.body - 1, cursor: "pointer" }}>✚ 加入生词本</button>}
            <button onClick={p.closeWord} style={{ width: "100%", marginTop: 10, padding: space.md, background: "transparent", border: "none", fontFamily: FF, fontSize: FS.secondary, color: color.textLight, cursor: "pointer" }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
