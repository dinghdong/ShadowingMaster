import { useEffect, useState } from "react";
import { getWordBook, addWord, toggleFavorite, saveNote } from "../api";
import { Page, Sentence, Video, WordDetail, WordMeaning, posLabel, translateEnToZh, cleanWordForLookup } from "../shared";
import { BASE } from "../api";
import { JumpTarget } from "./useRouting";

export interface WordBookDeps {
  page: Page;
  user: any;
  setPage: (pg: Page) => void;
  showToast: (msg: string) => void;
  currentVideoId: number | null;
  currentVideo: Video | undefined;
  currentSentence: Sentence;
  openVideo: (id: number) => void;
  jumpTargetRef: { current: JumpTarget | null };
  videoRef: { current: HTMLVideoElement | null };
}

/**
 * 生词本 + 句子标注（收藏 / 笔记 / 复制）+ 生词释义弹窗。
 * 从原 useApp 原样搬出；favorites / notes 的初始加载仍由 useVideos 的进页 effect 写入
 * （见 useApp 的延迟绑定），此处只负责后续交互。
 */
export function useWordBook(deps: WordBookDeps) {
  const { page, user, setPage, showToast, currentVideoId, currentVideo, currentSentence, openVideo, jumpTargetRef, videoRef } = deps;

  const [wordBook, setWordBook] = useState<any[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null);
  // 生词本弹窗的来源（点击生词本条目时记录），用于在弹窗中显示"回到原句"
  const [wordPopupOrigin, setWordPopupOrigin] = useState<{ videoId: number; sentenceId: number; definition?: string; definitionZh?: string } | null>(null);
  // 点词时锁定的来源句（句尾标点清理前的那一刻）。视频在弹窗打开期间会继续播放，
  // currentSentence 会推进到后句；这里固化点击瞬间所在的句，确保加入生词本存的是正确的 sentence_id。
  const [wordSentence, setWordSentence] = useState<{ id: number | null; index: number | null } | null>(null);
  // 弹窗打开前视频是否在播：打开时暂停，关闭时仅当原本在播才恢复，避免打断用户手动暂停
  const [wasPlaying, setWasPlaying] = useState(false);
  // 句子标注：收藏（sentence id 集合）/ 笔记（sentence id -> 内容）/ 当前打开的笔记编辑器
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  // 生词本拉取加载态：用于生词本/个人中心展示骨架，消除「还没收藏」空态闪现
  const [loading, setLoading] = useState(false);

  // 重新拉取生词本（登录用户）；失败时给出可见提示，而非静默留空列表
  const refreshWordBook = async () => {
    if (!localStorage.getItem("token")) return;
    setLoading(true);
    try {
      setWordBook(await getWordBook());
    } catch {
      showToast("生词本加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("token")) {
      refreshWordBook();
    }
  }, []);

  useEffect(() => {
    if ((page === "wordbook" || page === "profile") && user) {
      refreshWordBook();
    }
  }, [page, user]);

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

  const handleWordClick = async (word: string, sentenceId?: number | null, sentenceIndex?: number | null) => {
    const clean = cleanWordForLookup(word) || word;
    setSelectedWord(clean);
    // 锁定点词瞬间的来源句，避免弹窗打开期间视频继续播放导致 currentSentence 推进、sentence_id 变大
    setWordSentence(sentenceId != null ? { id: sentenceId, index: sentenceIndex ?? null } : null);
    // 打开弹窗时暂停视频，方便阅读释义（关闭时若原本在播再恢复）
    const playing = !!(videoRef.current && !videoRef.current.paused);
    setWasPlaying(playing);
    if (playing) videoRef.current?.pause();
    setWordDetail(null); // 进入加载态
    try {
      // 改走自家后端代理（/api/dictionary），规避浏览器直连 dictionaryapi.dev
      // 在国内超时/被重置、且缺词返回 502 的问题。后端已规范化为 {found, phonetic, meanings}。
      const res = await fetch(`${BASE}/api/dictionary?word=${encodeURIComponent(clean.toLowerCase())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          const meanings: WordMeaning[] = (data.meanings || []).map((m: any) => ({
            partOfSpeech: m.partOfSpeech,
            definition: m.definition,
            example: m.example || undefined,
          }));
          // 并行翻译每个释义与例句为中文（失败则缺省，回退英文）
          const meaningsZh = await Promise.all(
            meanings.map(async (m) => ({
              ...m,
              definitionZh: (await translateEnToZh(m.definition)) || undefined,
              exampleZh: m.example ? (await translateEnToZh(m.example)) || undefined : undefined,
            }))
          );
          setWordDetail({ phonetic: data.phonetic || "", meanings: meaningsZh });
        } else {
          setWordDetail({ meanings: [], notFound: true });
        }
      } else {
        setWordDetail({ meanings: [], notFound: true });
      }
    } catch {
      setWordDetail({ meanings: [], notFound: true });
    }
  };

  const closeWord = () => {
    // 关闭弹窗时，若打开前视频在播则恢复播放
    if (wasPlaying) { videoRef.current?.play().catch(() => {}); setWasPlaying(false); }
    setSelectedWord(null); setWordDetail(null); setWordPopupOrigin(null); setWordSentence(null);
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
    // 来源句：优先用点词瞬间锁定的句（弹窗打开期间视频仍在播放，currentSentence 会推进），
    // 其次回退到弹窗来源（生词本页）或当前的 currentSentence，保证 sentence_id 始终是词真实所在的句。
    const srcSentenceId = wordSentence?.id ?? wordPopupOrigin?.sentenceId ?? currentSentence?.id ?? null;
    const srcSentenceIndex = wordSentence?.index ?? currentSentence?.sentence_index ?? null;
    try {
      const res: any = await addWord(w, {
        definition: def,
        // 中文释义优先存 definition_zh；英文释义留作对照/回退
        definitionZh: first?.definitionZh || undefined,
        example: first?.example,
        exampleZh: first?.exampleZh,
        videoId: currentVideoId || undefined,
        sentenceId: srcSentenceId || undefined,
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
        sentence_id: srcSentenceId,
        video_title: currentVideo?.title || null,
        sentence_index: srcSentenceIndex,
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

  // 生词本 → 跳回原视频原句（无来源信息的词条不可跳）
  const openWordOrigin = (w: any) => {
    if (!w.video_id || !w.sentence_id) return;
    jumpTargetRef.current = { videoId: w.video_id, sentenceId: w.sentence_id };
    openVideo(w.video_id);
  };

  // 生词本条目点击 → 打开释义弹窗（而非直接跳转），弹窗内提供"回到原句"
  const openWordDetail = (w: any) => {
    setWordPopupOrigin({
      videoId: w.video_id,
      sentenceId: w.sentence_id,
      definition: w.definition || undefined,
      definitionZh: w.definition_zh || undefined,
    });
    handleWordClick(w.word);
  };

  return {
    wordBook, refreshWordBook, loading,
    selectedWord, wordDetail, wordPopupOrigin, handleWordClick, addToWordBook, closeWord, speakWord, openWordOrigin, openWordDetail,
    favorites, setFavorites, notes, setNotes, openNoteId,
    toggleFav, saveNoteFor, copySentence, openNote, closeNote,
  };
}
