import { useEffect, useRef, useState } from "react";
import { fetchVideos, fetchVideo, getProgress, saveProgress, submitVideo, getParseJob, getAnnotations } from "../api";
import { Video, Sentence, Page } from "../shared";
import { JumpTarget } from "./useRouting";
import { ShadowRecording } from "./useRecording";

export interface VideosDeps {
  page: Page;
  currentVideoId: number | null;
  jumpTargetRef: { current: JumpTarget | null };
  openVideo: (id: number) => void;
  // ── 以下为跨域回调，由 useApp 延迟绑定（调用点均在渲染提交之后，取值与拆分前的闭包一致）──
  resetSentenceState: () => void;
  setPendingPlay: (t: number, end?: number | null) => void;
  tryStartPendingPlay: () => void;
  clearExercises: () => void;
  setFavorites: (v: Set<number>) => void;
  setNotes: (v: Record<number, string>) => void;
  setRecordings: (v: Record<number, ShadowRecording>) => void;
  setRecordingId: (v: number | null) => void;
  setEvalOpenId: (v: number | null) => void;
  setRecognizedText: (v: string) => void;
  setWordMatches: (v: boolean[]) => void;
}

/**
 * 视频域：列表 / 详情（句子）/ 学习进度 / 当前句位 / 解析任务。
 * 从原 useApp 原样搬出，包含进页加载视频的主 effect、位置上报、滚动定位与解析轮询。
 */
export function useVideos(deps: VideosDeps) {
  const { page, currentVideoId, jumpTargetRef, openVideo } = deps;

  const [videos, setVideos] = useState<Video[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // 位置恢复：进入页面默认定位到上次学到的位置；resumeIndex 为该位置（无进度/游客为 null），
  // 同时浮条展示"从头开始"，点击跳回第 1 句并播放
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  // 学习记录：登录用户加载各视频进度；progressList 供个人中心逐条展示，
  // progressMap 供列表卡片快速显示"上次学到第N句"
  const [progressList, setProgressList] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  // ── 用户提交 YouTube 链接 → 后端异步解析 ──
  const [parseInput, setParseInput] = useState("");
  const [parseJob, setParseJob] = useState<{ job_id: number; status: string; video_id?: number; error?: string } | null>(null);
  const [parseError, setParseError] = useState("");
  // 进页加载视频句子的加载态：进入 effect 置 true，句子 set 后 false；
  // 用于跟读页展示双栏骨架，消除「句子为空 → 整页白屏」的最严重缺口。
  const [playerLoading, setPlayerLoading] = useState(false);
  const parseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchVideos().then((v: Video[]) => { setVideos(v); setLoading(false); }).catch(() => setLoading(false));
    // 登录用户拉取学习进度，驱动列表"上次学到"与个人中心记录
    if (localStorage.getItem("token")) {
      getProgress().then((rows: any[]) => {
        setProgressList(rows);
        setProgressMap(Object.fromEntries(rows.map((r) => [r.video_id, r.last_sentence_index])) as Record<number, number>);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (currentVideoId && page === "player") {
      let cancelled = false;
      setPlayerLoading(true);
      fetchVideo(currentVideoId).then(async (data: any) => {
        if (cancelled) return;
        setSentences(data.sentences);
        // 跟读录音为会话内本地数据，切换视频时清空避免串句
        deps.setRecordings({});
        // 听写/挖空为每句本地作答，切换视频时一并清空
        deps.clearExercises();
        deps.setEvalOpenId(null);
        deps.setRecordingId(null);
        // 登录用户拉取本视频各句的收藏/笔记状态
        if (localStorage.getItem("token")) {
          getAnnotations(currentVideoId).then((a: any) => {
            if (cancelled) return;
            deps.setFavorites(new Set(a.favorites || []));
            deps.setNotes(a.notes || {});
          }).catch(() => {});
        } else {
          deps.setFavorites(new Set());
          deps.setNotes({});
        }
        deps.setRecognizedText("");
        deps.setWordMatches([]);
        let idx = 0;
        let resumeIdx: number | null = null; // 进度恢复的目标句（有记录才非 null）
        const jump = jumpTargetRef.current;
        if (jump && jump.videoId === currentVideoId) {
          // 生词本跳原句：按 sentence_id 定位句序
          jumpTargetRef.current = null;
          const j = data.sentences.findIndex((s: any) => s.id === jump.sentenceId);
          idx = j >= 0 ? j : 0;
        } else if (localStorage.getItem("token")) {
          // 位置记忆：登录用户恢复上次句位（游客从头开始）
          try {
            const progress = await getProgress();
            const rec = progress.find((r: any) => r.video_id === currentVideoId);
            if (rec) {
              idx = Math.max(0, Math.min(data.sentences.length - 1, rec.last_sentence_index));
              resumeIdx = idx > 0 ? idx : null;
            }
          } catch { /* 静默 */ }
        }
        if (!cancelled) {
          setResumeIndex(resumeIdx);
          setResumeDismissed(false);
          setCurrentIndex(idx);
          // 进页默认从「上次学到的位置」连续自动播放（不句末自停），
          // 句子列表随后自动滚到该句；"从头开始"浮条保留至用户点按/关闭
          const s = data.sentences[idx];
          deps.setPendingPlay(s?.start_time ?? 0, null);
          deps.tryStartPendingPlay();
          setPlayerLoading(false);
        }
      }).catch(() => { if (!cancelled) setPlayerLoading(false); });
      return () => { cancelled = true; };
    } else {
      // 非跟读页（如列表）保持 loading 关闭，避免骨架残留
      setPlayerLoading(false);
    }
  }, [currentVideoId, page]);

  const currentSentence = sentences[currentIndex];
  const currentVideo = videos.find((v) => v.id === currentVideoId);

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
    deps.setRecognizedText("");
    deps.setWordMatches([]);
    deps.resetSentenceState();
    reportPosition(clamped);
  };

  // 切句时清空各练习模式的临时输入（听写/挖空/精听揭示等）
  useEffect(() => { deps.resetSentenceState(); }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // 移动端(barOnTop)：当前句对齐到可见区顶部（紧贴吸顶栏下方），不居中，避免落在可视区底部
    // 桌面端：句卡顶部留 offset 间隙，再在剩余可用高度内尽量居中（过高卡片则贴顶）
    const top = barOnTop
      ? Math.max(0, elTop - offset)
      : Math.max(0, elTop - offset - Math.max(0, (avail - elHeight) / 2));
    window.scrollTo({ top, behavior: "smooth" });
  };

  // 滚动到当前句：进页即定位到上次学到的位置（自动滚到该句），会话内切句保持顺滑
  useEffect(() => {
    if (page !== "player") return;
    scrollToSentence(currentIndex);
  }, [page, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const jumpToStart = () => {
    goSentence(0);
    scrollToSentence(0);
    // 「从头开始」= 从第一句连续自动播放（不句末自停），符合整段跟读流
    deps.setPendingPlay(sentences[0]?.start_time ?? 0, null);
    deps.tryStartPendingPlay();
    setResumeDismissed(true);
  };
  const dismissStart = () => setResumeDismissed(true);

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

  return {
    videos, loading, playerLoading,
    sentences, currentIndex, setCurrentIndex, currentSentence, currentVideo,
    resumeIndex, resumeDismissed, jumpToStart, dismissStart,
    progressList, progressMap, reportPosition, goSentence,
    parseInput, setParseInput, parseJob, parseError, submitVideoUrl,
  };
}
