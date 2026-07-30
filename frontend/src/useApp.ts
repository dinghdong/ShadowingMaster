import { useState, useEffect, useRef } from "react";
import { login, register, getMe, fetchVideos, fetchVideo, getWordBook, addWord, getProgress, saveProgress } from "./api";
import { Video, Sentence, Page, compareWords } from "./shared";

/**
 * 应用共享状态与交互逻辑（Slice 0 原型转正）。
 * 数据获取 / API 调用 / 状态管理集中在这里，App.tsx 只负责渲染。
 */
export function useApp() {
  // ── Hash 路由（零依赖）：#/ 列表、#/video/:id 跟读、#/wordbook、#/login ──
  const parseHash = (): { page: Page; videoId: number | null } => {
    const h = window.location.hash.replace(/^#/, "");
    const m = h.match(/^\/video\/(\d+)$/);
    if (m) return { page: "player", videoId: Number(m[1]) };
    if (h === "/wordbook") return { page: "wordbook", videoId: null };
    if (h === "/login") return { page: "login", videoId: null };
    return { page: "list", videoId: null };
  };

  const [page, setPageState] = useState<Page>(() => parseHash().page);
  const [user, setUser] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(() => parseHash().videoId);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subtitleMode, setSubtitleMode] = useState<"both" | "english" | "chinese" | "none">("both");
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [wordMatches, setWordMatches] = useState<boolean[]>([]);
  const [wordBook, setWordBook] = useState<any[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDef, setWordDef] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
    fetchVideos().then((v: Video[]) => { setVideos(v); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // hash 变化同步到 state（浏览器前进/后退、直达链接同样生效）
  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setPageState(r.page);
      if (r.videoId != null) setCurrentVideoId(r.videoId);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 页面导航统一走 hash；hashchange 监听再回流 state，单一事实源
  const setPage = (pg: Page) => {
    window.location.hash = pg === "list" ? "/" : `/${pg}`;
  };

  // 位置记忆 / 生词跳原句：生词跳转优先于进度恢复
  const jumpTargetRef = useRef<{ videoId: number; sentenceId: number } | null>(null);

  useEffect(() => {
    if (currentVideoId && page === "player") {
      let cancelled = false;
      fetchVideo(currentVideoId).then(async (data: any) => {
        if (cancelled) return;
        setSentences(data.sentences);
        setRecognizedText("");
        setWordMatches([]);
        let idx = 0;
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
            if (rec) idx = Math.max(0, Math.min(data.sentences.length - 1, rec.last_sentence_index));
          } catch { /* 静默 */ }
        }
        if (!cancelled) {
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
    if (page === "wordbook" && user) {
      getWordBook().then(setWordBook).catch(console.error);
    }
  }, [page, user]);

  const currentSentence = sentences[currentIndex];
  const currentVideo = videos.find((v) => v.id === currentVideoId);

  const openVideo = (id: number) => {
    window.location.hash = `/video/${id}`;
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
    if (!currentVideoId || !localStorage.getItem("token")) return;
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
    reportTimerRef.current = setTimeout(() => {
      saveProgress(currentVideoId, idx).catch(() => {});
    }, 800);
  };

  const goSentence = (idx: number) => {
    const clamped = Math.max(0, Math.min(sentences.length - 1, idx));
    setCurrentIndex(clamped);
    setRecognizedText("");
    setWordMatches([]);
    reportPosition(clamped);
  };

  const handleLogin = async (email: string, password: string) => {
    setError("");
    try { await login(email, password); setUser(await getMe()); setPage("list"); }
    catch (e: any) { setError(e.message || "Login failed"); }
  };

  const handleRegister = async (email: string, password: string) => {
    setError("");
    try { await register(email, password); await login(email, password); setUser(await getMe()); setPage("list"); }
    catch (e: any) { setError(e.message || "Register failed"); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); setUser(null); setPage("list"); };

  // ── 播放控制（连续自动播放模型）──
  const playEndRef = useRef<number | null>(null);     // 单句播放的自动停点；null = 连续播放
  const suppressLoopRef = useRef(false);              // 跟读录音期间抑制单句循环
  const pendingPlayRef = useRef<number | null>(null); // 进页后待自动播放的起点（位置记忆/跳原句的句位）
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSingle, setLoopSingle] = useState(false);
  const loopSingleRef = useRef(false);
  useEffect(() => { loopSingleRef.current = loopSingle; }, [loopSingle]);
  const RATES = [1, 0.75, 1.25];
  const [rateIdx, setRateIdx] = useState(0);
  const rate = RATES[rateIdx];
  const cycleRate = () => setRateIdx((i) => (i + 1) % RATES.length);

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

  // 暂停/播放切换（继续播放 = 连续模式）
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { playEndRef.current = null; v.play().catch(() => {}); }
    else v.pause();
  };

  // 点句气泡：跳到该句并连续播放
  const jumpToSentence = (idx: number) => {
    const s = sentences[idx];
    if (!s) return;
    goSentence(idx);
    const v = videoRef.current;
    if (!v) return;
    playEndRef.current = null;
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
    // 连续播放：当前句高亮跟随播放头
    const idx = sentences.findIndex((s) => t >= s.start_time && t < s.end_time);
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
      reportPosition(idx);
    }
  };

  const startShadowing = () => {
    if (!currentSentence) return;
    setRecognizedText(""); setWordMatches([]);
    suppressLoopRef.current = true;
    // 先重播原句，播完再开始录音
    let delay = 500;
    if (currentSentence.end_time > currentSentence.start_time) {
      playFrom(currentSentence.start_time, currentSentence.end_time);
      delay = (currentSentence.end_time - currentSentence.start_time) * 1000 + 400;
    }
    setTimeout(() => {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SR) { setRecognizedText("Speech recognition not supported"); suppressLoopRef.current = false; return; }
      const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => setIsRecording(true);
      rec.onend = () => { setIsRecording(false); suppressLoopRef.current = false; };
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setRecognizedText(text);
        setWordMatches(compareWords(currentSentence.english_text, text).matches);
      };
      rec.onerror = () => { setIsRecording(false); setRecognizedText("Recognition failed"); suppressLoopRef.current = false; };
      rec.start();
    }, delay);
  };

  const handleWordClick = async (word: string) => {
    setSelectedWord(word);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      if (res.ok) { const data = await res.json(); setWordDef(data[0]?.meanings[0]?.definitions[0]?.definition || ""); }
      else setWordDef("No definition found");
    } catch { setWordDef("No definition found"); }
  };

  const addToWordBook = async () => {
    if (!selectedWord || !user) return;
    await addWord(selectedWord, wordDef, currentVideoId || undefined, currentSentence?.id || undefined);
    closeWord();
  };

  const closeWord = () => { setSelectedWord(null); setWordDef(""); };

  return {
    page, setPage,
    user, videos, loading,
    currentVideoId, currentVideo, sentences, currentIndex, goSentence,
    currentSentence,
    subtitleMode, setSubtitleMode,
    isRecording, recognizedText, wordMatches,
    wordBook, selectedWord, wordDef,
    error,
    openVideo, openWordOrigin, handleLogin, handleRegister, handleLogout,
    startShadowing, handleWordClick, addToWordBook, closeWord,
    videoRef, playEndRef, loopSingleRef, suppressLoopRef,
    loopSingle, setLoopSingle, rate, cycleRate, playFrom, playSentenceAt,
    isPlaying, setIsPlaying, togglePlay, jumpToSentence, onVideoLoaded, handleTimeUpdate,
  };
}

export type AppState = ReturnType<typeof useApp>;
