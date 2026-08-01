import { useState, useEffect } from "react";
import { useApp, AppState } from "./useApp";
import { tokenize, compareWords, mediaUrl, Sentence, posLabel } from "./shared";
import { Icon, IconName } from "./components/Icon";
import { getStoredTheme, toggleTheme, ThemeMode } from "./theme-mode";
import LandingPage from "./LandingPage";

// 评分配色 / 文案（跟读评价）—— 用语义 CSS 变量，随深浅主题自适应
const scoreVar = (v: number) =>
  v >= 80 ? "var(--success)" : v >= 60 ? "var(--warning)" : "var(--danger)";
const scoreLabel = (v: number) =>
  v >= 90 ? "发音地道" : v >= 80 ? "很好" : v >= 60 ? "不错，继续练" : "多听多模仿";

function LoginPage(p: AppState & { theme: ThemeMode; onToggleTheme: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localErr, setLocalErr] = useState("");
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const validate = (): string => {
    if (!EMAIL_RE.test(email.trim())) return "邮箱格式不正确";
    if (password.length < 8) return "密码至少需要 8 位";
    return "";
  };
  const submit = () => {
    setLocalErr("");
    const ve = validate();
    if (ve) { setLocalErr(ve); return; }
    if (mode === "login") p.handleLogin(email.trim(), password);
    else p.handleRegister(email.trim(), password);
  };
  const switchMode = (m: "login" | "register") => { setMode(m); setLocalErr(""); };
  const shownErr = localErr || p.error;
  return (
    <div className="app app--flush" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", position: "relative" }}>
      <button className="icon-btn icon-btn--plain" aria-label="切换主题" onClick={p.onToggleTheme}
        style={{ position: "absolute", top: 16, right: 16 }}>
        <Icon name={p.theme === "dark" ? "sun" : "moon"} size={22} />
      </button>

      <div style={{ fontSize: "var(--fs-brand)", fontWeight: "var(--fw-heavy)", color: "var(--primary)", marginBottom: "var(--sp-2)" }}>ShadowingMaster</div>
      <div className="meta" style={{ marginBottom: 40 }}>英语口语跟读训练</div>

      <div className="auth-card fade-up">
        <div className="auth-head segmented">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`segmented__btn ${mode === m ? "segmented__btn--active" : ""}`}>
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <input className="input" placeholder="邮箱" value={email}
            onChange={(e) => { setEmail(e.target.value); if (localErr) setLocalErr(""); }} />
          <input className="input" placeholder="密码（至少 8 位）" type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); if (localErr) setLocalErr(""); }} />
          {shownErr && <div className="hint--box">{shownErr}</div>}
          <button className="btn btn--primary btn--block" onClick={submit}>{mode === "login" ? "登 录" : "注 册"}</button>
          <button className="link-btn" style={{ width: "100%", justifyContent: "center", marginTop: "var(--sp-1)" }}
            onClick={() => p.setPage("list")}>先逛逛 →</button>
        </div>
      </div>
    </div>
  );
}

// ─── 个人中心页（学习记录 / 账户）───
function ProfilePage(p: AppState) {
  const [redirected, setRedirected] = useState(false);
  useEffect(() => {
    if (!p.user) { p.setPage("login"); setRedirected(true); }
  }, [p.user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p.user || redirected) {
    return (
      <div className="app" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="meta">请先登录</span>
      </div>
    );
  }

  const records = (p.progressList || [])
    .map((r: any) => ({ ...r, video: p.videos.find((v: any) => v.id === r.video_id) }))
    .filter((r: any) => r.video);
  const learnedSentences = records.reduce((acc: number, r: any) => acc + (r.last_sentence_index + 1), 0);
  const wordCount = (p.wordBook || []).length;

  const stat = (label: string, value: number | string) => (
    <div className="stat-card fade-up">
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );

  return (
    <div className="app">
      <div className="navbar">
        <button className="icon-btn icon-btn--plain" onClick={() => p.setPage("list")} aria-label="返回"><Icon name="arrowLeft" size={22} /></button>
        <div className="navbar__title">个人中心</div>
      </div>

      <div className="page-pad">
        <div className="list-card" style={{ marginBottom: "var(--sp-4)" }}>
          <div className="row">
            <div className="avatar"><Icon name="user" size={22} /></div>
            <div>
              <div className="title-strong" style={{ fontSize: "var(--fs-body)" }}>{p.user.email}</div>
              <div className="meta">已登录</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
          {stat("学习视频", records.length)}
          {stat("学习句数", learnedSentences)}
          {stat("生词", wordCount)}
        </div>

        <div className="section-label" style={{ marginBottom: "var(--sp-2)" }}>学习记录</div>
        {records.length === 0 ? (
          <div className="empty">还没有学习记录，去跟读一个视频吧</div>
        ) : (
          records.map((r: any) => (
            <div key={r.video_id} onClick={() => p.openVideo(r.video_id)}
              className="list-card list-card--click list-card--sm fade-up" style={{ marginBottom: "var(--sp-3)" }}>
              <div className="row row--between">
                <div style={{ minWidth: 0 }}>
                  <div className="title-strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.video.title}</div>
                  <div className="meta" style={{ marginTop: 4 }}>上次学到 第{r.last_sentence_index + 1}句 / 共{r.video.sentence_count}句</div>
                </div>
                <div className="link-btn" style={{ flexShrink: 0, marginLeft: "var(--sp-3)" }}>继续 →</div>
              </div>
            </div>
          ))
        )}

        <button className="btn btn--danger btn--block" style={{ marginTop: "var(--sp-4)" }} onClick={p.handleLogout}>退出登录</button>
      </div>
    </div>
  );
}

// ─── 添加视频页 ───
function AddVideoPage(p: AppState) {
  const backBtn = (
    <button className="icon-btn icon-btn--plain" onClick={() => p.setPage("list")} aria-label="返回"><Icon name="arrowLeft" size={22} /></button>
  );
  const header = (
    <div className="navbar">
      {backBtn}
      <div className="navbar__title">添加视频</div>
    </div>
  );

  if (!p.user) {
    return (
      <div className="app">
        {header}
        <div className="locked-state">
          <span className="locked-state__icon"><Icon name="lock" size={48} /></span>
          <div>登录后即可提交 YouTube 视频自动解析跟读</div>
          <button className="btn btn--primary" onClick={() => p.setPage("login")}>登录</button>
        </div>
      </div>
    );
  }

  const status = p.parseJob?.status;
  const pct = status === "processing" ? 55 : status === "done" ? 100 : 10;
  const statusText =
    status === "done" ? "解析完成"
      : status === "processing" ? "正在下载视频并解析中英文字幕…"
        : "任务已提交，排队中…";

  return (
    <div className="app">
      {header}
      <div className="page-pad" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="card card--pad fade-up">
          <div className="title-strong" style={{ marginBottom: "var(--sp-1)" }}>粘贴 YouTube 链接，自动解析成跟读视频</div>
          <div className="hint" style={{ marginBottom: "var(--sp-4)" }}>
            提交后系统会自动下载视频、解析中英文字幕并入库，完成后直接打开跟读页。解析通常需几十秒到几分钟，请耐心等待。
          </div>

          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <input
              className="input"
              value={p.parseInput}
              onChange={(e) => p.setParseInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !p.parseJob) p.submitVideoUrl(p.parseInput); }}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={!!p.parseJob}
              style={{ opacity: p.parseJob ? 0.7 : 1 }}
            />
            <button
              className="btn btn--primary"
              onClick={() => p.submitVideoUrl(p.parseInput)}
              disabled={!!p.parseJob || !p.parseInput.trim()}
            >{p.parseJob ? "解析中…" : "解析"}</button>
          </div>

          {p.parseJob && (
            <div style={{ marginTop: "var(--sp-4)" }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="meta" style={{ marginTop: "var(--sp-2)" }}>
                {status === "processing" ? <Icon name="spinner" size={13} spin /> : status === "done" ? <Icon name="checkCircle" size={13} /> : null} {statusText}
              </div>
            </div>
          )}

          {p.parseError && <div className="hint--box">{p.parseError}</div>}
        </div>

        <div className="meta" style={{ marginTop: "var(--sp-4)", textAlign: "center" }}>
          支持 youtube.com/watch?v=…、youtu.be/… 等格式（含列表参数亦可）
        </div>
      </div>
    </div>
  );
}

// ─── 单句操作按钮（复制 / 收藏 / 笔记）───
function ActionBtn({ children, onClick, active, badge, label }: { children: React.ReactNode; onClick: () => void; active?: boolean; badge?: boolean; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`action-btn ${active ? "action-btn--active" : ""}`}
    >
      {children}
      {badge && <span className="action-btn__dot" />}
    </button>
  );
}

// 听写 / 挖空：每句独立的「检查 / 重做」按钮
function CheckBtn({ checked, onCheck, onRedo, label }: { checked: boolean; onCheck: () => void; onRedo: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={checked ? onRedo : onCheck}
      className="btn btn--sm btn--primary"
    >
      {checked ? <><Icon name="redo" size={13} /> 重做</> : <><Icon name="check" size={13} /> 检查</>}
    </button>
  );
}

// ─── 笔记内联编辑器 ───
function NoteEditor({ s, p }: { s: Sentence; p: AppState }) {
  const [val, setVal] = useState(p.notes[s.id] || "");
  return (
    <div onClick={(e) => e.stopPropagation()} className="card card--pad" style={{ marginTop: "var(--sp-2)" }}>
      <textarea
        className="input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="写点笔记…"
        rows={3}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-1)" }}>
        <button className="btn btn--sm btn--ghost" onClick={() => p.closeNote()}>取消</button>
        <button className="btn btn--sm btn--primary" onClick={() => { p.saveNoteFor(s.id, val); p.closeNote(); }}>保存</button>
      </div>
    </div>
  );
}

// ─── 跟读模式：每句录音 / 播放录音 / 评价分数 ───
function ShadowActions({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const rec = p.recordings[s.id];
  const isRec = p.recordingId === s.id;
  return (
    <>
      <button
        aria-label={`record-${idx}`}
        onClick={() => (isRec ? p.stopRecord() : p.startRecord(s.id))}
        title={isRec ? "停止录音" : "录音"}
        className="action-btn"
        style={isRec ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" } : undefined}
      >
        <Icon name={isRec ? "stop" : "mic"} size={15} />
      </button>
      <button
        aria-label={`play-record-${idx}`}
        onClick={() => p.playRecord(s.id)}
        title="播放录音"
        disabled={!rec?.url}
        className="action-btn"
        style={{ opacity: rec?.url ? 1 : 0.4 }}
      >
        <Icon name="volume" size={15} />
      </button>
      {rec?.score ? (
        <button
          aria-label={`eval-${idx}`}
          onClick={() => p.openEval(s.id)}
          title="评价详情"
          className="score-badge"
          style={{ height: 28, padding: "0 10px" }}
        >
          <Icon name="trophy" size={13} /> {rec.score.overall}
        </button>
      ) : (
        <button aria-label={`eval-${idx}`} onClick={() => p.openEval(s.id)} title="评价详情" className="action-btn">
          <Icon name="chart" size={15} />
        </button>
      )}
    </>
  );
}

// ─── 生词本条目：中文释义 / 例句 / 来源（视频·句序）───
function WordBookCard({ w, p }: { w: any; p: AppState }) {
  const zh = w.definition_zh || w.definition;
  const hasSource = w.video_id && w.sentence_id;
  return (
    <div
      key={w.id}
      onClick={() => p.openWordOrigin(w)}
      className={`list-card list-card--sm fade-up ${hasSource ? "list-card--click" : ""}`}
      style={{ marginBottom: "var(--sp-3)" }}
    >
      <div className="row row--between" style={{ marginBottom: "var(--sp-1)" }}>
        <div className="title-strong" style={{ fontSize: "var(--fs-title)" }}>{w.word}</div>
        {hasSource && (
          <div className="link-btn" style={{ color: "var(--primary)", flexShrink: 0, marginLeft: "var(--sp-2)" }}>
            <Icon name="reply" size={13} /> 回到原句
          </div>
        )}
      </div>
      <div className="wb-def">{zh || "暂无释义"}</div>
      {w.example && (
        <div className="wb-example">
          “{w.example}”
          {w.example_zh && <span className="wb-example-zh">“{w.example_zh}”</span>}
        </div>
      )}
      {hasSource && (
        <div className="wb-source">
          <Icon name="film" size={12} />
          <span className="wb-source__title">{w.video_title || "未知视频"}</span>
          <span className="wb-source__sep">·</span>
          <span>第{(w.sentence_index ?? 0) + 1}句</span>
        </div>
      )}
    </div>
  );
}

// ─── 句子进度小标签（右侧列表用）───
function ProgChips({ p, s }: { p: AppState; s: Sentence }) {
  const rec = p.recordings[s.id];
  const chips: React.ReactNode[] = [];
  if (rec?.score) chips.push(<span key="shadow" className="prog-chip prog-chip--score"><Icon name="trophy" size={11} /> {rec.score.overall}</span>);
  if (p.dictationChecked[s.id]) chips.push(<span key="dict" className="prog-chip prog-chip--ok"><Icon name="check" size={11} /> 听写</span>);
  if (p.clozeChecked[s.id]) chips.push(<span key="cloze" className="prog-chip prog-chip--ok"><Icon name="check" size={11} /> 挖空</span>);
  if (p.favorites.has(s.id)) chips.push(<span key="fav" className="prog-chip prog-chip--fav"><Icon name="starFill" size={11} /> 收藏</span>);
  if (p.notes[s.id]) chips.push(<span key="note" className="prog-chip prog-chip--note"><Icon name="note" size={11} /> 笔记</span>);
  return <div className="tag-row">{chips}</div>;
}

// ─── 右侧全句滚动列表行 ───
function SentenceRow({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const isCurrent = idx === p.currentIndex;
  return (
    <div
      id={`sent-${idx}`}
      onClick={() => p.jumpToSentence(idx)}
      className={`sentence-row ${isCurrent ? "sentence-row--current" : ""} ${idx < p.currentIndex ? "sentence-row--read" : ""}`}
    >
      <div className="sentence-row__main">
        <span className="sentence-row__idx">{idx + 1}</span>
        <div className="sentence-row__text">
          <div className="sentence-row__en">{s.english_text}</div>
          {s.chinese_text && <div className="sentence-row__cn">{s.chinese_text}</div>}
        </div>
      </div>
      <ProgChips p={p} s={s} />
    </div>
  );
}

// ─── 左侧当前句练习台 ───
function SentenceCard({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const isCurrent = idx === p.currentIndex;
  const tokens = tokenize(s.english_text);
  const isHidden = p.practiceMode === "view" && (p.intensiveHidden[s.id] ?? true);

  const showKaraoke = p.wordHighlight && isCurrent && ((p.practiceMode === "view" && !isHidden) || p.practiceMode === "shadow");
  const wordCount = tokens.filter((t) => !t.space).length;
  let activeWord = -1;
  if (showKaraoke) {
    const prog = (p.playhead - s.start_time) / Math.max(0.001, s.end_time - s.start_time);
    activeWord = Math.min(wordCount - 1, Math.max(0, Math.floor(prog * wordCount)));
  }

  let wi = -1;
  const renderEnglish = (withKaraoke: boolean) =>
    tokens.map((t, i) => {
      if (t.space) return <span key={i}>{t.text}</span>;
      wi++;
      const isSpoken = withKaraoke && wi < activeWord;
      const isActive = withKaraoke && wi === activeWord;
      const color = isSpoken
        ? "var(--on-primary)"
        : isActive
          ? "var(--primary)"
          : t.isHard ? "var(--danger)"
            : "var(--text)";
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); p.handleWordClick(t.text); }}
          className={t.isHard ? "word-token word-token--hard" : "word-token"}
          style={{
            color,
            fontWeight: (isActive || t.isHard) ? "var(--fw-bold)" : "var(--fw-regular)",
            cursor: "pointer",
            background: isSpoken ? "var(--primary)" : isActive ? "var(--primary-soft)" : "transparent",
            borderRadius: "var(--sp-1)",
            padding: (isSpoken || isActive) ? "1px 3px" : 0,
            textDecoration: isActive ? "underline" : "none",
            transition: "background 0.15s, color 0.15s",
          }}
        >{t.text}</span>
      );
    });

  const showEnglish = p.subtitleMode === "english" || p.subtitleMode === "both";
  const showChinese = !!s.chinese_text && (p.subtitleMode === "chinese" || p.subtitleMode === "both");

  const subtitleBlock = (
    <>
      {showEnglish && (
        <div style={{ fontSize: "var(--fs-sentence)", color: "var(--text)", lineHeight: "var(--lh-sentence)", marginBottom: s.chinese_text && showChinese ? 6 : 0 }}>
          {renderEnglish(showKaraoke)}
        </div>
      )}
      {showChinese && (
        <div style={{ fontSize: "var(--fs-secondary)", color: "var(--text-2)", lineHeight: "var(--lh-body)" }}>{s.chinese_text}</div>
      )}
    </>
  );

  const fullSubtitle = (
    <>
      <div style={{ fontSize: "var(--fs-sentence)", color: "var(--text)", lineHeight: "var(--lh-sentence)", marginBottom: s.chinese_text && showChinese ? 6 : 0 }}>
        {renderEnglish(showKaraoke)}
      </div>
      {s.chinese_text && showChinese && <div style={{ fontSize: "var(--fs-secondary)", color: "var(--text-2)", lineHeight: "var(--lh-body)" }}>{s.chinese_text}</div>}
    </>
  );

  let body: React.ReactNode = null;

  if (p.practiceMode === "view") {
    body = isHidden ? (
      <div style={{ position: "relative", borderRadius: "var(--r-md)", minHeight: 80 }}>
        <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none" }}>{fullSubtitle}</div>
        <div
          onClick={(e) => { e.stopPropagation(); p.revealIntensive(s.id); }}
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

  return (
    <div className="practice__panel sentence sentence--current" onClick={(e) => e.stopPropagation()}>
      {body}
      <div className="sentence__bar">
        <span className="sentence__idx">{idx + 1}</span>
        <button aria-label={`play-sentence-${idx}`} onClick={() => p.playSentenceAt(idx)} className="round-play"><Icon name="play" size={11} /></button>
        <div style={{ flex: 1 }} />
        {p.practiceMode === "dictation" && (
          <CheckBtn label={`check-dictation-${idx}`} checked={!!p.dictationChecked[s.id]} onCheck={() => p.checkDictation(s.id)} onRedo={() => p.redoDictation(s.id)} />
        )}
        {p.practiceMode === "cloze" && (
          <CheckBtn label={`check-cloze-${idx}`} checked={!!p.clozeChecked[s.id]} onCheck={() => p.checkCloze(s.id)} onRedo={() => p.redoCloze(s.id)} />
        )}
        {p.practiceMode === "shadow" && <ShadowActions p={p} s={s} idx={idx} />}
        <ActionBtn label="复制" onClick={() => p.copySentence(s.english_text)}><Icon name="copy" size={15} /></ActionBtn>
        <ActionBtn label="收藏" active={p.favorites.has(s.id)} onClick={() => p.toggleFav(s.id)}>
          <Icon name={p.favorites.has(s.id) ? "starFill" : "star"} size={15} />
        </ActionBtn>
        <ActionBtn label="笔记" badge={!!p.notes[s.id]} onClick={() => p.openNote(s.id)}><Icon name="note" size={15} /></ActionBtn>
      </div>
      {p.openNoteId === s.id && <NoteEditor s={s} p={p} />}
    </div>
  );
}

// ─── 桌面端外壳：左侧导航栏 + 主内容区 ───
const SHELL_NAV: { key: AppState["page"]; label: string; icon: IconName }[] = [
  { key: "list", label: "视频列表", icon: "film" },
  { key: "wordbook", label: "生词本", icon: "book" },
  { key: "profile", label: "个人中心", icon: "user" },
  { key: "add", label: "添加视频", icon: "plus" },
];

function DesktopShell({ p, theme, onToggleTheme, children }: {
  p: AppState;
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <button className="sidebar__brand" onClick={() => p.setPage("landing")} aria-label="返回首页">ShadowingMaster</button>
          <div className="sidebar__sub">英语口语跟读训练</div>
        </div>

        <nav className="sidebar__nav">
          {SHELL_NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => p.setPage(n.key)}
              className={`nav-item ${p.page === n.key ? "nav-item--active" : ""}`}
              aria-current={p.page === n.key ? "page" : undefined}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__foot">
          <button className="icon-btn icon-btn--plain" onClick={onToggleTheme} aria-label="切换主题" title="切换深色模式">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
          </button>
          {p.user ? (
            <div className="sidebar__user">
              <div className="sidebar__email" title={p.user.email}>{p.user.email}</div>
              <button className="nav-item nav-item--ghost" onClick={p.handleLogout}>
                <Icon name="logout" size={18} /><span>退出</span>
              </button>
            </div>
          ) : (
            <button className="btn btn--sm btn--primary btn--block" onClick={() => p.setPage("login")}>登录</button>
          )}
        </div>
      </aside>

      <main className="shell__main">{children}</main>
    </div>
  );
}

export default function App() {
  const p = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme());
  const onToggleTheme = () => setTheme(toggleTheme());

  useEffect(() => {
    if (p.videoRef.current) p.videoRef.current.playbackRate = p.rate;
  }, [p.rate, p.page, p.currentVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (p.loading) return <div className="app" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="meta">Loading…</span></div>;

  if (p.page === "landing") return <LandingPage {...p} theme={theme} onToggleTheme={onToggleTheme} />;

  if (p.page === "login") return <LoginPage {...p} theme={theme} onToggleTheme={onToggleTheme} />;

  const withShell = (node: React.ReactNode) => (
    <DesktopShell p={p} theme={theme} onToggleTheme={onToggleTheme}>{node}</DesktopShell>
  );

  if (p.page === "profile") return withShell(<ProfilePage {...p} />);

  if (p.page === "add") return withShell(<AddVideoPage {...p} />);

  // ─── 视频列表页 ───
  if (p.page === "list") {
    return withShell(
      <div className="app">
        <div className="navbar">
          <div className="navbar__brand">ShadowingMaster</div>
          <div className="navbar__spacer" />
          <div className="navbar__actions">
            {p.user ? (
              <>
                <button className="icon-btn" onClick={() => p.setPage("wordbook")} title="生词本" aria-label="生词本">
                  <Icon name="book" size={20} />
                  {p.wordBook && p.wordBook.length > 0 && (
                    <span className="badge">{p.wordBook.length > 99 ? "99+" : p.wordBook.length}</span>
                  )}
                </button>
                <button className="icon-btn" onClick={() => p.setPage("add")} title="添加视频" aria-label="添加视频"><Icon name="plus" size={20} /></button>
                <button className="icon-btn icon-btn--accent" onClick={() => p.setPage("profile")} title="个人中心" aria-label="个人中心"><Icon name="user" size={20} /></button>
              </>
            ) : (
              <button className="btn btn--sm btn--primary" onClick={() => p.setPage("login")}>登录</button>
            )}
          </div>
        </div>

        <div className="page-pad list-grid">
          {p.videos.map((v) => (
            <div key={v.id} onClick={() => p.openVideo(v.id)} className="video-card fade-up" style={{ marginBottom: "var(--sp-4)" }}>
              <div className="video-card__thumb">
                {v.thumbnail_url ? <img src={mediaUrl(v.thumbnail_url)} alt="" /> : <Icon name="film" size={28} />}
              </div>
              <div className="video-card__body">
                <div className="title-strong" style={{ marginBottom: 6 }}>{v.title}</div>
                <div className="row" style={{ gap: "var(--sp-3)", fontSize: "var(--fs-meta)", color: "var(--text-2)", flexWrap: "nowrap" }}>
                  <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="clock" size={13} /> {Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, "0")}</span>
                  <span className="row" style={{ gap: 4, whiteSpace: "nowrap" }}><Icon name="lines" size={13} /> {v.sentence_count}句</span>
                  {p.progressMap && p.progressMap[v.id] != null && (
                    <span style={{ color: "var(--primary)", fontWeight: "var(--fw-semibold)", whiteSpace: "nowrap" }}>上次学到 第{p.progressMap[v.id] + 1}句</span>
                  )}
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
    return withShell(
      <div className="app">
        <div className="navbar">
          <button className="icon-btn icon-btn--plain navbar__back" onClick={() => p.setPage("list")} aria-label="返回"><Icon name="arrowLeft" size={22} /></button>
          <div className="navbar__title">我的生词本</div>
        </div>
        <div className="page-pad wordbook-grid">
          {!p.user ? <div className="empty">请登录后查看生词本</div> :
           p.wordBook.length === 0 ? <div className="empty">还没有收藏生词</div> :
           p.wordBook.map((w: any) => <WordBookCard key={w.id} w={w} p={p} />)}
        </div>
      </div>
    );
  }

  // ─── 跟读页 ───
  return withShell(
    <div className="app practice">
      <div className="practice__left">
      <div className="player-bar">
        <div className="navbar navbar--keep">
          <button className="icon-btn icon-btn--plain navbar__back" onClick={() => p.setPage("list")} aria-label="返回"><Icon name="arrowLeft" size={22} /></button>
          <div className="navbar__title" style={{ fontSize: "calc(var(--fs-body) - 1px)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.currentVideo?.title || "跟读"}</div>
          <div className="navbar__actions">
            <button className="icon-btn navbar__wordbook" onClick={() => p.setPage("wordbook")} title="生词本" aria-label="生词本"><Icon name="book" size={18} /></button>
            <div style={{ position: "relative", zIndex: "var(--z-popover)" }}>
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

                    <div className="setting-row">
                      <span className="setting-row__label">深色模式</span>
                      <button onClick={onToggleTheme} aria-label="toggle-theme"
                        className={`toggle ${theme === "dark" ? "toggle--on" : ""}`}>
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

        <div className="page-pad" style={{ marginBottom: "var(--sp-2)" }}>
          <div className="player-frame">
            {p.currentVideo?.video_path ? (
              <video
                ref={p.videoRef}
                src={mediaUrl(p.currentVideo.video_path)}
                poster={mediaUrl(p.currentVideo.thumbnail_url)}
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
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
              <div style={{ color: "#fff", fontSize: "var(--fs-secondary)" }}>暂无视频文件</div>
            )}
            <button
              aria-label="play-pause"
              onClick={(e) => { e.stopPropagation(); p.togglePlay(); }}
              className="play-fab"
            ><Icon name={p.isPlaying ? "pause" : "play"} size={18} /></button>
          </div>
        </div>

        <div className="practice__modebar">
          {(["view", "shadow", "dictation", "cloze"] as const).map((m) => (
            <button key={m} onClick={() => p.setPracticeMode(m)}
              className={`chip ${p.practiceMode === m ? "chip--active" : ""}`}>
              {m === "view" ? "原文" : m === "shadow" ? "跟读" : m === "dictation" ? "听写" : "挖空"}
            </button>
          ))}
          {p.practiceMode === "view" && p.currentSentence && (
            <button
              className="practice__subtitle-toggle"
              onClick={() => p.revealIntensive(p.currentSentence.id)}
            >
              <Icon name={(p.intensiveHidden[p.currentSentence.id] ?? true) ? "eye" : "eyeOff"} size={14} />
              {(p.intensiveHidden[p.currentSentence.id] ?? true) ? "显示字幕" : "隐藏字幕"}
            </button>
          )}
        </div>

        {p.currentSentence && (
          <SentenceCard p={p} s={p.currentSentence} idx={p.currentIndex} />
        )}

        {p.currentVideo?.description && (
          <div style={{ paddingTop: "var(--sp-2)", paddingBottom: 0 }}>
            <p className="video-desc video-desc--full">{p.currentVideo.description}</p>
          </div>
        )}
      </div>
      </div>

      <div className="page-pad practice__right">
        {p.sentences.map((s, idx) => (
          <SentenceRow key={s.id} p={p} s={s} idx={idx} />
        ))}
      </div>

      {p.resumeIndex !== null && !p.resumeDismissed && p.currentIndex === p.resumeIndex && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "var(--sp-2)", background: "var(--primary)", color: "var(--on-primary)", padding: "9px 9px 9px 16px", borderRadius: "var(--r-pill)", boxShadow: "var(--shadow-float)", fontFamily: "var(--ff)", fontSize: "var(--fs-secondary)", fontWeight: "var(--fw-semibold)", zIndex: "var(--z-toast)", maxWidth: "90vw" }}>
          <button onClick={p.jumpToResume} style={{ background: "none", border: "none", color: "var(--on-primary)", fontFamily: "var(--ff)", fontSize: "var(--fs-secondary)", fontWeight: "var(--fw-bold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
            <span style={{ fontSize: "var(--fs-body)" }}>↓</span> 继续学习：第 {p.resumeIndex + 1} 句
          </button>
          <button onClick={p.dismissResume} aria-label="dismiss-resume" title="不再提示" style={{ background: "rgba(255,255,255,0.22)", border: "none", color: "var(--on-primary)", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
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

      {p.selectedWord && (
        <div className="modal-backdrop" onClick={p.closeWord}>
          <div className="modal modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="word-head">
              <div className="word-head__text">{p.selectedWord}</div>
              {p.wordDetail?.phonetic && <div className="word-head__phon">{p.wordDetail.phonetic}</div>}
              <button aria-label="speak-word" onClick={() => p.speakWord(p.selectedWord!)} className="icon-btn" style={{ marginLeft: "auto" }}><Icon name="volume" size={16} /></button>
            </div>

            <div className="scroll-y" style={{ overflowY: "auto", marginBottom: "var(--sp-4)" }}>
              {!p.wordDetail && <div className="hint">加载中…</div>}
              {p.wordDetail?.notFound && <div className="hint">未找到在线释义，仍可加入生词本自行备注。</div>}
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
                  {m.exampleZh && (
                    <div className="example-zh">“{m.exampleZh}”</div>
                  )}
                </div>
              ))}
            </div>

            {p.user && <button onClick={p.addToWordBook} className="btn btn--primary btn--block" style={{ marginBottom: 10 }}><Icon name="plus" size={16} /> 加入生词本</button>}
            <button onClick={p.closeWord} className="btn btn--ghost btn--block">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
