import { useState, useEffect, useRef } from "react";
import { login, register, getMe, fetchVideos, fetchVideo, getWordBook, addWord } from "./api";
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
  const [subtitleMode, setSubtitleMode] = useState<"both" | "english" | "chinese">("both");
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
      fetchVideo(currentVideoId).then((data: any) => {
        setSentences(data.sentences);
        setCurrentIndex(0);
        setRecognizedText("");
        setWordMatches([]);
      });
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

  const goSentence = (idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(sentences.length - 1, idx)));
    setRecognizedText("");
    setWordMatches([]);
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

  const startShadowing = () => {
    if (!currentSentence) return;
    setRecognizedText(""); setWordMatches([]);
    // 先重播原句，播完再开始录音
    const v = videoRef.current;
    let delay = 500;
    if (v && currentSentence.end_time > currentSentence.start_time) {
      v.currentTime = currentSentence.start_time;
      v.play().catch(() => {});
      delay = (currentSentence.end_time - currentSentence.start_time) * 1000 + 400;
    }
    setTimeout(() => {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SR) { setRecognizedText("Speech recognition not supported"); return; }
      const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => setIsRecording(true);
      rec.onend = () => setIsRecording(false);
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setRecognizedText(text);
        setWordMatches(compareWords(currentSentence.english_text, text).matches);
      };
      rec.onerror = () => { setIsRecording(false); setRecognizedText("Recognition failed"); };
      rec.start();
    }, 500);
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
    videoRef,
  };
}

export type AppState = ReturnType<typeof useApp>;
