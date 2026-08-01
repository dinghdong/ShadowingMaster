import { useState, useEffect, useRef } from "react";
import { login, register, getMe, fetchVideos, fetchVideo, getWordBook, addWord, getProgress, saveProgress, submitVideo, getParseJob, getAnnotations, toggleFavorite, saveNote } from "./api";
import { Video, Sentence, Page, compareWords, tokenize, WordDetail, WordMeaning, posLabel, translateEnToZh } from "./shared";

/**
 * 应用共享状态与交互逻辑（Slice 0 原型转正）。
 * 数据获取 / API 调用 / 状态管理集中在这里，App.tsx 只负责渲染。
 */
// 跟读录音评分（本地，无后端依赖）
export interface ShadowScore {
  overall: number;   // 综合分 0-100
  accuracy: number; // 准确度（逐词正确率）
  coverage: number; // 完整度（识别词数 / 原句词数）
  fluency: number;  // 流利度（录音时长 / 原句时长）
  recognizedText: string;
  perWord: { word: string; ok: boolean }[];
}

export interface ShadowRecording {
  url: string;            // 录音 blob 的 object url
  duration: number;       // 录音时长（秒）
  recognizedText: string; // 语音识别文本
  wordMatches: boolean[]; // 逐词是否正确
  score: ShadowScore | null;
}

// 跟读/听写/挖空 三种练习模式：均按「单句播放、句末自停」处理，方便逐句练习；
// 仅 view(原文/精听) 为整段连续自动播放。
const SINGLE_SENTENCE_MODES = new Set(["shadow", "dictation", "cloze"]);
const isSingleSentenceMode = (m: string) => SINGLE_SENTENCE_MODES.has(m);

export function useApp() {
  // ── History 路由（零依赖，无 #）：/ 落地页、/app 列表、/video/:id 跟读、/wordbook、/login ──
  const parsePath = (path?: string): { page: Page; videoId: number | null } => {
    const p = (path ?? window.location.pathname).replace(/\/+$/, "") || "/";
    const m = p.match(/^\/video\/(\d+)$/);
    if (m) return { page: "player", videoId: Number(m[1]) };
    if (p === "/wordbook") return { page: "wordbook", videoId: null };
    if (p === "/profile") return { page: "profile", videoId: null };
    if (p === "/add") return { page: "add", videoId: null };
    if (p === "/login") return { page: "login", videoId: null };
    if (p === "/app") return { page: "list", videoId: null };
    return { page: "landing", videoId: null };
  };

  // 解析当前 path 并回流 state（前进/后退、直达链接都走它）
  const applyPath = (path?: string) => {
    const r = parsePath(path);
    setPageState(r.page);
    if (r.videoId != null) setCurrentVideoId(r.videoId);
  };

  const [page, setPageState] = useState<Page>(() => parsePath().page);
  const [user, setUser] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(() => parsePath().videoId);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 进度恢复：进入页面时不自动滚动，改为浮条提示"继续学习第 N 句"，点击再跳
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const suppressScrollRef = useRef(false); // 恢复进页时抑制自动滚动
  // ── 全局偏好（持久化到 localStorage，跨会话保留）──
  const lsGet = (k: string, fb: string) => { try { const v = localStorage.getItem(k); return v == null ? fb : v; } catch { return fb; } };
  const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 忽略：隐私模式等 */ } };
  const PRACTICE_MODES = ["view", "shadow", "dictation", "cloze"] as const;
  const lsPracticeMode = (): "view" | "shadow" | "dictation" | "cloze" => {
    const v = lsGet("sm.practiceMode", "view");
    return (PRACTICE_MODES as readonly string[]).includes(v) ? (v as "view" | "shadow" | "dictation" | "cloze") : "view";
  };

  const [subtitleMode, setSubtitleMode] = useState<"both" | "english" | "chinese">(() => lsGet("sm.subtitleMode", "both") as "both" | "english" | "chinese");
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [wordMatches, setWordMatches] = useState<boolean[]>([]);
  const [wordBook, setWordBook] = useState<any[]>([]);
  // 学习记录：登录用户加载各视频进度；progressList 供个人中心逐条展示，
  // progressMap 供列表卡片快速显示"上次学到第N句"
  const [progressList, setProgressList] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // ── 用户提交 YouTube 链接 → 后端异步解析 ──
  const [parseInput, setParseInput] = useState("");
  const [parseJob, setParseJob] = useState<{ job_id: number; status: string; video_id?: number; error?: string } | null>(null);
  const [parseError, setParseError] = useState("");
  // 句子标注：收藏（sentence id 集合）/ 笔记（sentence id -> 内容）/ 当前打开的笔记编辑器 / 轻提示
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  // 跟读录音：每句本地录音（blob url）+ 识别评分；仅会话内有效（刷新即清空）
  const [recordings, setRecordings] = useState<Record<number, ShadowRecording>>({});
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [evalOpenId, setEvalOpenId] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recogRef = useRef<any>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const parseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ── 练习模式：view(原文/精听) / 跟读 / 听写 / 挖空 ──
  // 精听降级为单句「隐藏字幕」开关；view 模式默认隐藏字幕（即精听），可点击显示。
  const [practiceMode, setPracticeModeState] = useState<"view" | "shadow" | "dictation" | "cloze">(lsPracticeMode);
  const [playhead, setPlayhead] = useState(0);
  // 整段视频共用的「隐藏字幕」开关：默认隐藏（精听），开启后所有句子一起显示
  const [subtitleHidden, setSubtitleHidden] = useState(true);
  // 听写 / 挖空：每句独立状态（之前是整段共享，切句会互相覆盖 / token 索引跨句冲突）
  const [dictationTexts, setDictationTexts] = useState<Record<number, string>>({});
  const [dictationChecked, setDictationChecked] = useState<Record<number, boolean>>({});
  const [clozeAnswers, setClozeAnswers] = useState<Record<number, Record<number, string>>>({});
  const [clozeChecked, setClozeChecked] = useState<Record<number, boolean>>({});
  // 逐词高亮：全局开关，控制卡拉OK逐词点亮（默认开启）
  const [wordHighlight, setWordHighlight] = useState(() => lsGet("sm.wordHighlight", "true") === "true");

  // 切换练习模式 / 加载新视频时清空全部听写·挖空输入（每句独立，切句不互相覆盖）
  const clearExercises = () => {
    setDictationTexts({});
    setDictationChecked({});
    setClozeAnswers({});
    setClozeChecked({});
  };

  function resetSentenceState() {
    // 注意：听写/挖空/精听隐藏为每句独立状态，不在切句时清空——保留用户选择
    setPlayhead(0);
  }

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
    fetchVideos().then((v: Video[]) => { setVideos(v); setLoading(false); }).catch(() => setLoading(false));
    // 登录用户拉取学习进度，驱动列表"上次学到"与个人中心记录
    if (localStorage.getItem("token")) {
      getProgress().then((rows: any[]) => {
        setProgressList(rows);
        setProgressMap(Object.fromEntries(rows.map((r) => [r.video_id, r.last_sentence_index])) as Record<number, number>);
      }).catch(() => {});
      refreshWordBook();
    }
  }, []);

  // path 变化同步到 state（浏览器前进/后退、直达链接同样生效）
  useEffect(() => {
    const onPop = () => applyPath();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 页面导航统一走 History API；pushState + 显式回流 state（pushState 不触发 popstate）
  const setPage = (pg: Page) => {
    const path = pg === "landing" ? "/" : pg === "list" ? "/app" : `/${pg}`;
    window.history.pushState({}, "", path);
    applyPath(path);
  };

  // 位置记忆 / 生词跳原句：生词跳转优先于进度恢复
  const jumpTargetRef = useRef<{ videoId: number; sentenceId: number } | null>(null);

  useEffect(() => {
    if (currentVideoId && page === "player") {
      let cancelled = false;
      fetchVideo(currentVideoId).then(async (data: any) => {
        if (cancelled) return;
        setSentences(data.sentences);
        // 跟读录音为会话内本地数据，切换视频时清空避免串句
        setRecordings({});
        // 听写/挖空为每句本地作答，切换视频时一并清空
        clearExercises();
        setEvalOpenId(null);
        setRecordingId(null);
        // 登录用户拉取本视频各句的收藏/笔记状态
        if (localStorage.getItem("token")) {
          getAnnotations(currentVideoId).then((a: any) => {
            if (cancelled) return;
            setFavorites(new Set(a.favorites || []));
            setNotes(a.notes || {});
          }).catch(() => {});
        } else {
          setFavorites(new Set());
          setNotes({});
        }
        setRecognizedText("");
        setWordMatches([]);
        let idx = 0;
        let resumeIdx: number | null = null; // 进度恢复的目标句（有记录才非 null）
        const jump = jumpTargetRef.current;
        if (jump && jump.videoId === currentVideoId) {
          // 生词本跳原句：按 sentence_id 定位句序
          jumpTargetRef.current = null;
          const j = data.sentences.findIndex((s: any) => s.id === jump.sentenceId);
          idx = j >= 0 ? j : 0;
        } else if (localStorage.getItem("token")) {
          // 位置记忆：登录用户恢复上次句位，游客从头开始
          try {
            const progress = await getProgress();
            const rec = progress.find((r: any) => r.video_id === currentVideoId);
            if (rec) {
              idx = Math.max(0, Math.min(data.sentences.length - 1, rec.last_sentence_index));
              resumeIdx = idx;
            }
          } catch { /* 静默 */ }
        }
        if (!cancelled) {
          setResumeIndex(resumeIdx);
          setResumeDismissed(false);
          suppressScrollRef.current = true; // 进页不自动滚动，等用户点浮条
          setCurrentIndex(idx);
          // 进页默认连续自动播放：元数据已就绪（视频被缓存）时直接起播，
          // 否则等 onLoadedMetadata 触发；两条路径都走 tryStartPendingPlay，避免竞态
          pendingPlayRef.current = data.sentences[idx]?.start_time ?? 0;
          tryStartPendingPlay();
        }
      });
      return () => { cancelled = true; };
    }
  }, [currentVideoId, page]);

  useEffect(() => {
    if ((page === "wordbook" || page === "profile") && user) {
      refreshWordBook();
    }
  }, [page, user]);

  const currentSentence = sentences[currentIndex];
  const currentVideo = videos.find((v) => v.id === currentVideoId);

  const openVideo = (id: number) => {
    const path = `/video/${id}`;
    window.history.pushState({}, "", path);
    applyPath(path);
  };

  const setPracticeMode = (m: typeof practiceMode) => {
    setPracticeModeState(m);
    resetSentenceState();
    // 不再清空听写/挖空：同一句话可同时保留多种练习结果
    // 练习模式（跟读/听写/挖空）：切入即从头播当前句，句末自动暂停，方便逐句练习
    if (isSingleSentenceMode(m) && currentSentence) {
      playFrom(currentSentence.start_time, currentSentence.end_time);
    }
  };

  // 生词本 → 跳回原视频原句（无来源信息的词条不可跳）
  const openWordOrigin = (w: any) => {
    if (!w.video_id || !w.sentence_id) return;
    jumpTargetRef.current = { videoId: w.video_id, sentenceId: w.sentence_id };
    openVideo(w.video_id);
  };

  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 静默上报播放位置（防抖 800ms；未登录跳过）
  const reportPosition = (idx: number) => {
    const vid = currentVideoId;
    if (!vid || !localStorage.getItem("token")) return;
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
    reportTimerRef.current = setTimeout(() => {
      saveProgress(vid, idx).catch(() => {});
      // 乐观更新本地进度，列表"上次学到"与个人中心即时刷新
      setProgressMap((prev) => ({ ...prev, [vid]: Math.max(prev[vid] ?? 0, idx) }));
      setProgressList((prev) => {
        const found = prev.find((r: any) => r.video_id === vid);
        if (found) return prev.map((r: any) => r.video_id === vid ? { ...r, last_sentence_index: Math.max(r.last_sentence_index, idx) } : r);
        return [...prev, { video_id: vid, last_sentence_index: idx, practiced_sentences: 0 }];
      });
    }, 800);
  };

  const goSentence = (idx: number) => {
    const clamped = Math.max(0, Math.min(sentences.length - 1, idx));
    setCurrentIndex(clamped);
    setRecognizedText("");
    setWordMatches([]);
    resetSentenceState();
    reportPosition(clamped);
  };

  // 切句时清空各练习模式的临时输入（听写/挖空/精听揭示等）
  useEffect(() => { resetSentenceState(); }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 滚动到指定句：保证整句完整落在可见区域，不被上方/侧边栏遮挡。
  // 响应式布局差异：
  //  · 移动端(<900px)：.practice__left 不吸顶、堆叠在句子上方 → 需扣除其高度作为顶部偏移；
  //  · 桌面端(>=900px)：.practice__left 为 sticky 吸顶栏、位于左侧 → 不占纵向空间，偏移仅留 12px 间隙。
  // 之前用 scrollIntoView({block:"center"}) 在移动端会把较高卡片顶部顶到视频栏覆盖区外，
  // 导致"当前句只显示一部分"。
  const scrollToSentence = (idx: number) => {
    const el = document.getElementById(`sent-${idx}`);
    if (!el) return;
    const bar = document.querySelector(".player-bar");
    const leftCol = document.querySelector(".practice__left");
    const barOnTop = !leftCol || getComputedStyle(leftCol).position !== "sticky";
    // 移动端顶部遮挡 = 吸顶顶栏 + 吸顶视频播放器（两者都是 sticky，会盖住句子）
    let occluded = 0;
    if (barOnTop && bar) {
      occluded += bar.getBoundingClientRect().height;
      const frame = document.querySelector(".player-frame");
      if (frame && getComputedStyle(frame).position === "sticky") {
        occluded += frame.getBoundingClientRect().height;
      }
    }
    const offset = occluded ? occluded + 12 : 12;
    const rect = el.getBoundingClientRect();
    const elTop = rect.top + window.scrollY;
    const elHeight = rect.height;
    const avail = Math.max(160, window.innerHeight - offset);
    // 句卡顶部留 offset 间隙，再在剩余可用高度内尽量居中（过高卡片则贴顶，避免顶部被遮）
    const top = Math.max(0, elTop - offset - Math.max(0, (avail - elHeight) / 2));
    window.scrollTo({ top, behavior: "smooth" });
  };

  // 滚动到当前句：进页恢复时抑制自动滚动（改由"继续学习"浮条触发），会话内导航保持顺滑
  useEffect(() => {
    if (page !== "player") return;
    if (suppressScrollRef.current) { suppressScrollRef.current = false; return; }
    scrollToSentence(currentIndex);
  }, [page, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const jumpToResume = () => {
    if (resumeIndex != null) scrollToSentence(resumeIndex);
    setResumeDismissed(true);
  };
  const dismissResume = () => setResumeDismissed(true);

  // 后端英文异常 → 中文提示
  const localizeError = (msg: string): string => {
    if (!msg) return "操作失败，请重试";
    if (msg.includes("already registered")) return "该邮箱已注册";
    if (msg.includes("Incorrect email or password")) return "邮箱或密码错误";
    if (msg.includes("邮箱格式不正确")) return "邮箱格式不正确";
    if (msg.includes("密码至少")) return "密码至少需要 8 位";
    return msg;
  };

  const handleLogin = async (email: string, password: string) => {
    setError("");
    try { await login(email, password); setUser(await getMe()); refreshWordBook(); setPage("list"); }
    catch (e: any) { setError(localizeError(e.message) || "登录失败"); }
  };

  const handleRegister = async (email: string, password: string) => {
    setError("");
    try { await register(email, password); await login(email, password); setUser(await getMe()); refreshWordBook(); setPage("list"); }
    catch (e: any) { setError(localizeError(e.message) || "注册失败"); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); setUser(null); setPage("list"); };

  // ── 提交 YouTube 链接 → 后端异步解析 + 轮询 ──
  const refreshVideos = async () => {
    try { const v: Video[] = await fetchVideos(); setVideos(v); } catch { /* 静默 */ }
  };

  const stopParsePolling = () => {
    if (parseTimerRef.current) { clearInterval(parseTimerRef.current); parseTimerRef.current = null; }
  };

  useEffect(() => () => stopParsePolling(), []); // 卸载时清理轮询

  const submitVideoUrl = async (rawUrl: string) => {
    const url = (rawUrl || "").trim();
    setParseError("");
    if (!url) { setParseError("请输入 YouTube 链接"); return; }
    try {
      const res: any = await submitVideo(url);
      // 已存在 → 直接刷新并打开
      if (res.already_exists || (res.video_id && res.status === "done")) {
        await refreshVideos();
        if (res.video_id) openVideo(res.video_id);
        setParseInput("");
        return;
      }
      // 新任务 → 轮询进度，done 自动刷新列表并打开视频
      const jobId: number = res.job_id;
      setParseJob({ job_id: jobId, status: res.status });
      stopParsePolling();
      parseTimerRef.current = setInterval(async () => {
        try {
          const j: any = await getParseJob(jobId);
          if (j.status === "done") {
            stopParsePolling();
            setParseJob(null);
            setParseInput("");
            await refreshVideos();
            if (j.video_id) openVideo(j.video_id);
          } else if (j.status === "failed") {
            stopParsePolling();
            setParseError(j.error || "解析失败，请稍后重试");
            setParseJob(null);
          } else {
            setParseJob({ job_id: j.id, status: j.status });
          }
        } catch (e: any) {
          stopParsePolling();
          setParseError(e.message || "查询解析进度失败");
          setParseJob(null);
        }
      }, 2000);
    } catch (e: any) {
      setParseError(e.message || "提交失败，请检查链接或登录状态");
    }
  };

  // ── 播放控制（连续自动播放模型）──
  const playEndRef = useRef<number | null>(null);     // 单句播放的自动停点；null = 连续播放
  const suppressLoopRef = useRef(false);              // 跟读录音期间抑制单句循环
  const pendingPlayRef = useRef<number | null>(null); // 进页后待自动播放的起点（位置记忆/跳原句的句位）
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSingle, setLoopSingle] = useState(false);
  const loopSingleRef = useRef(false);
  useEffect(() => { loopSingleRef.current = loopSingle; }, [loopSingle]);
  const RATES = [1, 0.75, 1.25];
  const [rateIdx, setRateIdx] = useState(() => { const i = Number(lsGet("sm.rateIdx", "0")); return Number.isFinite(i) && i >= 0 && i < RATES.length ? i : 0; });
  const rate = RATES[rateIdx];
  const cycleRate = () => setRateIdx((i) => (i + 1) % RATES.length);
  const setRate = (r: number) => { const i = RATES.indexOf(r); if (i >= 0) setRateIdx(i); };

  // 全局偏好持久化：任一变化即写入 localStorage
  useEffect(() => {
    lsSet("sm.subtitleMode", subtitleMode);
    lsSet("sm.wordHighlight", String(wordHighlight));
    lsSet("sm.practiceMode", practiceMode);
    lsSet("sm.rateIdx", String(rateIdx));
  }, [subtitleMode, wordHighlight, practiceMode, rateIdx]);

  const playFrom = (start: number, end: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = start;
    playEndRef.current = end;
    v.play().catch(() => {});
  };

  // 单句播放：播放指定句、句末自停（高亮随播放头自然移动）
  const playSentenceAt = (idx: number) => {
    const s = sentences[idx];
    if (s) playFrom(s.start_time, s.end_time);
  };

  // 暂停/播放切换（连续模式；跟读模式下仍限定在当前句内，句末自停）
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (isSingleSentenceMode(practiceMode) && currentSentence) {
        // 已播到句末则从句首重来，否则从当前位置继续到句末
        if (v.currentTime >= currentSentence.end_time - 0.05) v.currentTime = currentSentence.start_time;
        playEndRef.current = currentSentence.end_time;
      } else {
        playEndRef.current = null;
      }
      v.play().catch(() => {});
    }
    else v.pause();
  };

  // 点句气泡：跳到该句播放（跟读模式只播这一句，句末自停；其余模式连续播放）
  const jumpToSentence = (idx: number) => {
    const s = sentences[idx];
    if (!s) return;
    goSentence(idx);
    const v = videoRef.current;
    if (!v) return;
    playEndRef.current = isSingleSentenceMode(practiceMode) ? s.end_time : null;
    v.currentTime = s.start_time;
    v.play().catch(() => {});
  };

  // 从待定起点（位置记忆/跳原句）开始默认连续自动播放；需元数据就绪
  const tryStartPendingPlay = () => {
    const v = videoRef.current;
    const start = pendingPlayRef.current;
    if (!v || start == null || v.readyState < 1) return;
    pendingPlayRef.current = null;
    playEndRef.current = null;
    v.playbackRate = rate;
    v.currentTime = start;
    v.play().catch(() => {});
  };

  // 视频元数据就绪时尝试起播（覆盖"元数据后于数据就位"的情况）
  const onVideoLoaded = () => tryStartPendingPlay();

  // 播放头驱动：单句自停/循环 + 高亮跟随 + 位置上报
  const handleTimeUpdate = (t: number, paused: boolean) => {
    const v = videoRef.current;
    setPlayhead(t);
    if (!v || paused) return;
    const end = playEndRef.current;
    if (end != null && t >= end) {
      // 单句播放（每句▶/跟读重播）到句末：循环或自停
      if (loopSingleRef.current && !suppressLoopRef.current && currentSentence) {
        v.currentTime = currentSentence.start_time;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
      return;
    }
    if (end == null && loopSingleRef.current && !suppressLoopRef.current && currentSentence && t >= currentSentence.end_time) {
      // 连续模式下的单句循环：到当前句末回起点
      v.currentTime = currentSentence.start_time;
      return;
    }
    if (end == null && isSingleSentenceMode(practiceMode) && currentSentence && t >= currentSentence.end_time) {
      // 练习模式兜底：即使从连续播放进入，也在当前句末暂停，不自动跳下一句
      v.pause();
      return;
    }
    // 连续播放：当前句高亮跟随播放头
    const idx = sentences.findIndex((s) => t >= s.start_time && t < s.end_time);
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
      reportPosition(idx);
    }
  };

  const handleWordClick = async (word: string) => {
    setSelectedWord(word);
    setWordDetail(null); // 进入加载态
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0] || {};
        const phonetic =
          entry.phonetic ||
          (entry.phonetics || []).find((p: any) => p?.text)?.text ||
          "";
        const meanings: WordMeaning[] = [];
        for (const m of entry.meanings || []) {
          for (const d of m.definitions || []) {
            meanings.push({ partOfSpeech: m.partOfSpeech, definition: d.definition, example: d.example });
            if (meanings.length >= 3) break;
          }
          if (meanings.length >= 3) break;
        }
        // 并行翻译每个释义与例句为中文（失败则缺省，回退英文）
        const meaningsZh = await Promise.all(
          meanings.map(async (m) => ({
            ...m,
            definitionZh: (await translateEnToZh(m.definition)) || undefined,
            exampleZh: m.example ? (await translateEnToZh(m.example)) || undefined : undefined,
          }))
        );
        setWordDetail({ phonetic, meanings: meaningsZh });
      } else {
        setWordDetail({ meanings: [], notFound: true });
      }
    } catch {
      setWordDetail({ meanings: [], notFound: true });
    }
  };

  const addToWordBook = async () => {
    if (!selectedWord) return;
    // 未登录：明确提示并引导登录，而不是静默无反应
    if (!user || !localStorage.getItem("token")) {
      showToast("请先登录");
      closeWord();
      setPage("login");
      return;
    }
    const w = selectedWord;
    const first = wordDetail?.meanings?.[0];
    const def = first ? `${posLabel(first.partOfSpeech)} ${first.definition}` : "";
    try {
      const res: any = await addWord(w, {
        definition: def,
        // 中文释义优先存 definition_zh；英文释义留作对照/回退
        definitionZh: first?.definitionZh || undefined,
        example: first?.example,
        exampleZh: first?.exampleZh,
        videoId: currentVideoId || undefined,
        sentenceId: currentSentence?.id || undefined,
      });
      // 乐观更新：立即把新词并入列表（含来源信息），生词本与角标实时刷新，
      // 不再依赖跳转到生词本页时的重新拉取（该拉取若失败会静默留空）
      const newItem: any = {
        id: res?.id,
        word: w,
        definition: def || null,
        definition_zh: first?.definitionZh || null,
        example: first?.example || null,
        example_zh: first?.exampleZh || null,
        video_id: currentVideoId || null,
        sentence_id: currentSentence?.id || null,
        video_title: currentVideo?.title || null,
        sentence_index: currentSentence?.sentence_index ?? null,
      };
      setWordBook((prev: any[]) => {
        if (prev.some((x) => x.word && x.word.toLowerCase() === w.toLowerCase())) return prev;
        return [newItem, ...prev];
      });
      showToast("已加入生词本");
      closeWord();
    } catch (e: any) {
      // 失败时给出明确反馈，而不是无提示、弹窗卡住
      showToast(e?.message || "加入失败，请重试");
    }
  };

  const closeWord = () => { setSelectedWord(null); setWordDetail(null); };

  // 浏览器原生语音合成朗读（零后端依赖；例句也可朗读）
  const speakWord = (text: string) => {
    try {
      if (typeof window === "undefined" || !(window as any).speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.9;
      (window as any).speechSynthesis.cancel();
      (window as any).speechSynthesis.speak(u);
    } catch { /* 不支持语音合成时静默 */ }
  };

  // ── 字幕显示/隐藏：整段共享开关 ──
  const revealIntensive = () => setSubtitleHidden((v) => !v);
  const setDictationText = (sentenceId: number, val: string) =>
    setDictationTexts((prev) => ({ ...prev, [sentenceId]: val }));
  const checkDictation = (sentenceId: number) =>
    setDictationChecked((prev) => ({ ...prev, [sentenceId]: true }));
  const redoDictation = (sentenceId: number) => {
    setDictationTexts((prev) => { const n = { ...prev }; delete n[sentenceId]; return n; });
    setDictationChecked((prev) => { const n = { ...prev }; delete n[sentenceId]; return n; });
  };
  const setClozeAnswer = (sentenceId: number, i: number, val: string) =>
    setClozeAnswers((prev) => ({ ...prev, [sentenceId]: { ...(prev[sentenceId] || {}), [i]: val } }));
  const checkCloze = (sentenceId: number) =>
    setClozeChecked((prev) => ({ ...prev, [sentenceId]: true }));
  const redoCloze = (sentenceId: number) => {
    setClozeAnswers((prev) => { const n = { ...prev }; delete n[sentenceId]; return n; });
    setClozeChecked((prev) => { const n = { ...prev }; delete n[sentenceId]; return n; });
  };

  // ── 句子标注：收藏 / 笔记 / 复制 ──
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  };
  // 重新拉取生词本（登录用户）；失败时给出可见提示，而非静默留空列表
  const refreshWordBook = async () => {
    if (!localStorage.getItem("token")) return;
    try {
      setWordBook(await getWordBook());
    } catch {
      showToast("生词本加载失败，请刷新重试");
    }
  };
  const requireLogin = () => {
    if (!localStorage.getItem("token")) { showToast("请先登录"); setPage("login"); return false; }
    return true;
  };
  const toggleFav = async (sentenceId: number) => {
    if (!requireLogin()) return;
    const willFav = !favorites.has(sentenceId);
    const next = new Set(favorites);
    if (willFav) next.add(sentenceId); else next.delete(sentenceId);
    setFavorites(next); // 乐观更新
    try {
      const r = await toggleFavorite(sentenceId);
      const s2 = new Set(favorites);
      if (r.is_favorite) s2.add(sentenceId); else s2.delete(sentenceId);
      setFavorites(s2);
    } catch { showToast("操作失败，请重试"); }
  };
  const saveNoteFor = async (sentenceId: number, content: string) => {
    if (!requireLogin()) return;
    try {
      const r = await saveNote(sentenceId, content);
      setNotes((prev) => ({ ...prev, [sentenceId]: r.content || "" }));
      if (!r.content) showToast("笔记已删除");
    } catch { showToast("保存失败，请重试"); }
  };
  const copySentence = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); showToast("已复制"); } catch { showToast("复制失败"); }
      document.body.removeChild(ta);
    }
  };
  const openNote = (sentenceId: number) => setOpenNoteId(sentenceId);
  const closeNote = () => setOpenNoteId(null);

  // ── 跟读录音 + 本地评分 ──
  // 评分：基于浏览器原生语音识别的逐词对比，给出 准确度/完整度/流利度 三项参考分。
  const computeScore = (s: Sentence, recognizedText: string, matches: boolean[], fluency?: number): ShadowScore => {
    const expected = tokenize(s.english_text).filter((t) => !t.space);
    const total = Math.max(1, expected.length);
    const correct = matches.filter(Boolean).length;
    const accuracy = Math.round((correct / total) * 100);
    const recWords = recognizedText.trim().split(/\s+/).filter(Boolean).length || 0;
    const coverage = Math.round(Math.min(1, recWords / total) * 100);
    const fl = fluency != null ? fluency : accuracy;
    const overall = Math.round(accuracy * 0.55 + coverage * 0.25 + fl * 0.2);
    const perWord = expected.map((t, i) => ({ word: t.text, ok: matches[i] ?? false }));
    return { overall, accuracy, coverage, fluency: fl, recognizedText, perWord };
  };

  const stopRecord = () => {
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop(); } catch { /* 忽略 */ }
    try { recogRef.current?.stop?.(); } catch { /* 忽略 */ }
    recogRef.current = null;
    mediaRecorderRef.current = null;
    suppressLoopRef.current = false;
    setRecordingId(null);
  };

  const startRecord = async (sentenceId: number) => {
    if (recordingId !== null) return;            // 一次只录一句
    if (isRecording) { showToast("正在跟读录音中，请稍候"); return; }
    const s = sentences.find((x) => x.id === sentenceId);
    if (!s) return;
    // 引导：先重播原句，让用户听清后再跟读（原底部"跟读"按钮的体验合并至此）
    setRecordingId(sentenceId);
    suppressLoopRef.current = true; // 录音期间抑制单句循环，避免干扰跟读
    showToast("🔊 听原句中…");
    if (s.end_time > s.start_time) playFrom(s.start_time, s.end_time);
    const prepMs = s.end_time > s.start_time ? (s.end_time - s.start_time) * 1000 + 400 : 400;
    await new Promise((r) => setTimeout(r, prepMs));
    if (recordingId !== sentenceId) return;       // 准备期间用户取消，则退出
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast("无法访问麦克风，请检查浏览器权限");
      setRecordingId(null);
      return;
    }
    recordStreamRef.current = stream;
    recordChunksRef.current = [];
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      showToast("当前浏览器不支持录音");
      return;
    }
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e: any) => { if (e.data && e.data.size) recordChunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        const dur = audio.duration || 0;
        const expected = Math.max(0.1, s.end_time - s.start_time);
        // 流利度：录音时长接近原句时长 → 高分；过短/过长都扣分
        const ratio = dur / expected;
        const fluency = Math.max(30, Math.min(100, Math.round((ratio <= 1 ? ratio : 1 / Math.max(0.2, ratio)) * 100)));
        setRecordings((prev) => {
          const ex = prev[sentenceId] || { url: "", duration: 0, recognizedText: "", wordMatches: [], score: null };
          if (ex.url && ex.url !== url) URL.revokeObjectURL(ex.url);
          const score = ex.score
            ? { ...ex.score, fluency, overall: Math.round(ex.score.accuracy * 0.55 + ex.score.coverage * 0.25 + fluency * 0.2) }
            : null;
          return { ...prev, [sentenceId]: { url, duration: dur, recognizedText: ex.recognizedText, wordMatches: ex.wordMatches, score } };
        });
      };
      stream.getTracks().forEach((t) => t.stop());
      showToast("录音完成");
    };
    mr.start();
    setRecordingId(sentenceId);

    // 同时跑语音识别用于评分（识别与原句逐词对比）
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        const m = compareWords(s.english_text, text);
        const score = computeScore(s, text, m.matches);
        setRecordings((prev) => {
          const ex = prev[sentenceId] || { url: "", duration: 0, recognizedText: "", wordMatches: [], score: null };
          if (ex.url) {
            // 已录到音：先用 duration 估算流利度，稍后 onstop 回填精确值
            const expected = Math.max(0.1, s.end_time - s.start_time);
            const est = Math.max(30, Math.min(100, Math.round((expected / expected) * 80)));
            score.fluency = est;
            score.overall = Math.round(score.accuracy * 0.55 + score.coverage * 0.25 + est * 0.2);
          }
          return { ...prev, [sentenceId]: { ...ex, recognizedText: text, wordMatches: m.matches, score } };
        });
      };
      rec.onerror = () => { /* 仅无识别分，录音仍保留 */ };
      try { rec.start(); recogRef.current = rec; } catch { /* 忽略 */ }
    }

    // 自动停止：原句时长 + 缓冲
    const autoMs = (s.end_time - s.start_time) * 1000 + 1500;
    window.setTimeout(() => stopRecord(), autoMs);
  };

  const playRecord = (sentenceId: number) => {
    const rec = recordings[sentenceId];
    if (!rec?.url) { showToast("还没有录音"); return; }
    const a = new Audio(rec.url);
    a.play().catch(() => showToast("播放失败"));
  };

  const openEval = (sentenceId: number) => {
    setEvalOpenId(sentenceId);
  };
  const closeEval = () => setEvalOpenId(null);

  return {
    page, setPage,
    user, videos, loading,
    progressList, progressMap,
    currentVideoId, currentVideo, sentences, currentIndex, goSentence,
    resumeIndex, resumeDismissed, jumpToResume, dismissResume,
    currentSentence,
    subtitleMode, setSubtitleMode,
    isRecording, recognizedText, wordMatches,
    wordBook, selectedWord, wordDetail,
    error,
    parseInput, setParseInput, parseJob, parseError, submitVideoUrl,
    openVideo, openWordOrigin, handleLogin, handleRegister, handleLogout,
    handleWordClick, addToWordBook, closeWord, speakWord,
    videoRef, playEndRef, loopSingleRef, suppressLoopRef,
    loopSingle, setLoopSingle, rate, cycleRate, setRate, RATES, playFrom, playSentenceAt,
    isPlaying, setIsPlaying, togglePlay, jumpToSentence, onVideoLoaded, handleTimeUpdate,
    practiceMode, setPracticeMode,
    playhead, subtitleHidden, revealIntensive,
    dictationTexts, setDictationText, dictationChecked, checkDictation, redoDictation,
    clozeAnswers, setClozeAnswer, clozeChecked, checkCloze, redoCloze,
    wordHighlight, setWordHighlight,
    favorites, notes, openNoteId, toast,
    toggleFav, saveNoteFor, copySentence, openNote, closeNote, showToast,
    recordings, recordingId, evalOpenId,
    startRecord, stopRecord, playRecord, openEval, closeEval,
  };
}

export type AppState = ReturnType<typeof useApp>;
