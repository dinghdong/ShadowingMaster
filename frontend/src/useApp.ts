import { useState, useEffect, useRef } from "react";
import { login, register, getMe, fetchVideos, fetchVideo, getWordBook, addWord, getProgress, saveProgress } from "./api";
import { Video, Sentence, Page, compareWords } from "./shared";

/**
 * 应用共享状态与交互逻辑（Slice 0 原型转正）。
 * 数据获取 / API 调用 / 状态管理集中在这里，App.tsx 只负责渲染。
 */
export function useApp() {
  const [page, setPage] = useState<Page>("list");
  const [user, setUser] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
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

  useEffect(() => {
    if (currentVideoId && page === "player") {
      let cancelled = false;
      fetchVideo(currentVideoId).then(async (data: any) => {
        if (cancelled) return;
        setSentences(data.sentences);
        setRecognizedText("");
        setWordMatches([]);
        // 位置记忆：登录用户恢复上次句位，游客从头开始
        let idx = 0;
        if (localStorage.getItem("token")) {
          try {
            const progress = await getProgress();
            const rec = progress.find((r: any) => r.video_id === currentVideoId);
            if (rec) idx = Math.max(0, Math.min(data.sentences.length - 1, rec.last_sentence_index));
          } catch { /* 静默 */ }
        }
        if (!cancelled) setCurrentIndex(idx);
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
    setCurrentVideoId(id);
    setPage("player");
  };

  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goSentence = (idx: number) => {
    const clamped = Math.max(0, Math.min(sentences.length - 1, idx));
    setCurrentIndex(clamped);
    setRecognizedText("");
    setWordMatches([]);
    // 静默上报播放位置（防抖 800ms；未登录跳过）
    if (currentVideoId && localStorage.getItem("token")) {
      if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
      reportTimerRef.current = setTimeout(() => {
        saveProgress(currentVideoId, clamped).catch(() => {});
      }, 800);
    }
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

  // ── 播放控制（精修片）──
  const playEndRef = useRef<number | null>(null);     // 本次播放应在何时自动停（句末）
  const suppressLoopRef = useRef(false);              // 跟读录音期间抑制单句循环
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

  // 单句播放：播放指定句但不改变当前句高亮
  const playSentenceAt = (idx: number) => {
    const s = sentences[idx];
    if (s) playFrom(s.start_time, s.end_time);
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
    openVideo, handleLogin, handleRegister, handleLogout,
    startShadowing, handleWordClick, addToWordBook, closeWord,
    videoRef, playEndRef, loopSingleRef, suppressLoopRef,
    loopSingle, setLoopSingle, rate, cycleRate, playFrom, playSentenceAt,
  };
}

export type AppState = ReturnType<typeof useApp>;
