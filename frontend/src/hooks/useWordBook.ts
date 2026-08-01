import { useEffect, useState } from "react";
import { getWordBook, addWord, toggleFavorite, saveNote } from "../api";
import { Page, Sentence, Video, WordDetail, WordMeaning, posLabel, translateEnToZh } from "../shared";
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
}

/**
 * 生词本 + 句子标注（收藏 / 笔记 / 复制）+ 生词释义弹窗。
 * 从原 useApp 原样搬出；favorites / notes 的初始加载仍由 useVideos 的进页 effect 写入
 * （见 useApp 的延迟绑定），此处只负责后续交互。
 */
export function useWordBook(deps: WordBookDeps) {
  const { page, user, setPage, showToast, currentVideoId, currentVideo, currentSentence, openVideo, jumpTargetRef } = deps;

  const [wordBook, setWordBook] = useState<any[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null);
  // 生词本弹窗的来源（点击生词本条目时记录），用于在弹窗中显示"回到原句"
  const [wordPopupOrigin, setWordPopupOrigin] = useState<{ videoId: number; sentenceId: number; definition?: string; definitionZh?: string } | null>(null);
  // 句子标注：收藏（sentence id 集合）/ 笔记（sentence id -> 内容）/ 当前打开的笔记编辑器
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);

  // 重新拉取生词本（登录用户）；失败时给出可见提示，而非静默留空列表
  const refreshWordBook = async () => {
    if (!localStorage.getItem("token")) return;
    try {
      setWordBook(await getWordBook());
    } catch {
      showToast("生词本加载失败，请刷新重试");
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

  const closeWord = () => { setSelectedWord(null); setWordDetail(null); setWordPopupOrigin(null); };

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
    wordBook, refreshWordBook,
    selectedWord, wordDetail, wordPopupOrigin, handleWordClick, addToWordBook, closeWord, speakWord, openWordOrigin, openWordDetail,
    favorites, setFavorites, notes, setNotes, openNoteId,
    toggleFav, saveNoteFor, copySentence, openNote, closeNote,
  };
}
