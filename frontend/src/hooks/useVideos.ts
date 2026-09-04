import { useEffect, useRef, useState } from "react";
import { fetchVideos, fetchVideo, getProgress, saveProgress, submitVideo, getParseJob, getAnnotations } from "../api";
import { Video, Sentence, Page } from "../shared";
import { JumpTarget } from "./useRouting";
import { ShadowRecording } from "./useRecording";
import { SM_SCROLL_DEBUG, smScrollLog, smDiagLog } from "../scrollDebug";

// ── 解析轮询容错 ──
// 网络层抖动（代理 / Tor 出口 / 弱网 / 节点切换）会让 fetch 抛 TypeError，
// 但**后端解析任务仍在后台继续跑**。老实现遇到一次抖动就 stopParsePolling()
// 并把浏览器原始报错（"Failed to fetch"）直接甩给用户，用户以为解析失败，
// 实际上视频几分钟后已经入库 —— 这正是 2026-09-03 线上那次误报的成因。
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_NET_FAILS = 15; // 连续网络失败容忍次数（2s/次 ≈ 30s 容错窗口）
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 轮询总上限，避免任务卡死时前端无限转圈

const isNetworkError = (e: unknown) =>
  e instanceof TypeError ||
  /failed to fetch|networkerror|load failed|network request failed|ERR_NETWORK/i.test(
    String((e as any)?.message || e)
  );

/** 把浏览器/后端的裸报错翻译成用户能看懂的中文提示 */
function friendlyParseError(e: unknown, fallback: string) {
  if (isNetworkError(e)) {
    // 后端任务并未中止，所以提示必须说明"可能仍在解析"，而不是让用户以为失败了
    return "网络连接不稳定，请求未能送达服务器。视频可能仍在后台解析中，可稍后刷新列表查看，或重新提交（重复提交不会重复解析）。";
  }
  return String((e as any)?.message || "").trim() || fallback;
}

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
  // 轮询改用自调度的 setTimeout（而非 setInterval）：弱网下单次请求可能耗时数秒，
  // setInterval 会并发叠加请求，自调度能保证上一次返回后才发起下一次。
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          smDiagLog(`PAGELOAD jumpTarget -> j=${j} idx=${idx}`);
        } else if (localStorage.getItem("token")) {
          // 位置记忆：登录用户恢复上次句位（游客从头开始）
          try {
            const progress = await getProgress();
            const rec = progress.find((r: any) => r.video_id === currentVideoId);
            if (rec) {
              idx = Math.max(0, Math.min(data.sentences.length - 1, rec.last_sentence_index));
              resumeIdx = idx > 0 ? idx : null;
              smDiagLog(`PAGELOAD progress rec video=${currentVideoId} last_sentence_index=${rec.last_sentence_index} -> idx=${idx}`);
            } else {
              smDiagLog(`PAGELOAD progress: no rec for video=${currentVideoId} -> idx=0`);
            }
          } catch { /* 静默 */ }
        } else {
          smDiagLog(`PAGELOAD guest (no token) -> idx=0`);
        }
        if (!cancelled) {
          setResumeIndex(resumeIdx);
          setResumeDismissed(false);
          setCurrentIndex(idx);
          smDiagLog(`PAGELOAD setCurrentIndex=${idx} resumeIdx=${resumeIdx} sentences=${data.sentences.length} start_time=${data.sentences[idx]?.start_time} end_time=${data.sentences[idx]?.end_time}`);
          // 进页定位：列表自动滚到上次学到/生词本跳转的目标句（延到 DOM 提交后测量布局）
          smScrollLog(`PAGELOAD idx=${idx}`);
          requestAnimationFrame(() => scrollToSentence(idx));
          // 进页默认从「上次学到的位置」连续自动播放（不句末自停），
          // 句子列表随后自动滚到该句；"从头开始"浮条保留至用户点按/关闭
          const s = data.sentences[idx];
          deps.setPendingPlay(s?.start_time ?? 0, null);
          deps.tryStartPendingPlay();
        }
      });
      return () => { cancelled = true; };
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
    smDiagLog(`NAV goSentence(${idx}) -> clamped=${clamped}`);
    setCurrentIndex(clamped);
    deps.setRecognizedText("");
    deps.setWordMatches([]);
    deps.resetSentenceState();
    reportPosition(clamped);
    // 仅在有意导航时滚动（点击/上一下一句/从头开始），不再监听 currentIndex 全局副作用，
    // 避免 seek 期间 timeupdate 误写 currentIndex 触发多余滚动造成抖动。
    // rAF 延到 React 提交 DOM 后，确保移动端展开当前行的布局已生效再测量位置。
    smScrollLog(`NAV idx=${clamped}`);
    requestAnimationFrame(() => scrollToSentence(clamped));
  };

  // 切句时清空各练习模式的临时输入（听写/挖空/精听揭示等）
  useEffect(() => { deps.resetSentenceState(); }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 滚动到指定句：保证整句完整落在可见区域，不被上方导航/视频遮挡。
  //
  // 【架构决策】移动端使用「内部滚动容器」方案（.practice__right 为 overflow-y:auto 的 flex 子项），
  // 彻底规避微信 WebView / iOS Safari 中 window.scrollBy / window.scrollTo 静默失效的问题
  // （实测：这些 API 在微信内置浏览器中返回成功但不产生任何滚动，elTop 始终为 0）。
  // 桌面端仍使用 window 滚动（.practice__right 不是滚动容器，行为不变）。
  //
  // 滚动方式：直接赋值 scrollTop（非 scrollBy/scrollTo API），该属性赋值在所有 WebView 中可靠触发重绘。
  const scrollToSentence = (idx: number, behavior: ScrollBehavior = "smooth") => {
    const leftCol = document.querySelector(".practice__left");
    const mobile = !leftCol || getComputedStyle(leftCol).position !== "sticky";
    smDiagLog(`SCROLL-DESKTOP idx=${idx} mobile=${mobile} -> ${mobile ? "SKIP(mobile, react-window 接管)" : "run"}`);
    // 移动端滚动由 MobileSentenceList(react-window) 接管：它内部监听 currentIndex 并调用
    // listRef.scrollToItem(idx, "smart")，直接给滚动容器赋 scrollTop（微信 WebView 中唯一可靠的滚动方式）。
    // 此处桌面端专用，不再手动操作移动端 DOM，避免与虚拟列表争抢滚动。
    if (mobile) return;

    const el = document.getElementById(`sent-${idx}`);
    if (!el) return;
    const bar = document.querySelector(".player-bar");

    void document.body.offsetHeight; // 强制回流

    // 桌面端：找到最近的 overflow 滚动容器（默认 window）；居中当前句
    let scroller: HTMLElement | Window = window;
    let n: HTMLElement | null = el.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 1) {
        scroller = n;
        break;
      }
      n = n.parentElement;
    }

    const elTop = el.getBoundingClientRect().top;
    const scrollerTop = scroller === window ? 0 : (scroller as HTMLElement).getBoundingClientRect().top;
    const relativeElTop = elTop - scrollerTop; // 元素相对于滚动容器顶部
    const gap = 24;

    const vh = scroller === window ? window.innerHeight : (scroller as HTMLElement).clientHeight;
    const elH = el.getBoundingClientRect().height;
    const targetScroll = (scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop) + relativeElTop - (vh - elH) / 2;

    if (SM_SCROLL_DEBUG) {
      const scName = scroller === window ? "window" : (scroller as HTMLElement).className || (scroller as HTMLElement).tagName;
      smScrollLog(`SCROLL idx=${idx} desktop relativeElTop=${relativeElTop.toFixed(0)} targetScroll=${targetScroll.toFixed(0)} scroller=${scName}`);
    }

    if (scroller === window) {
      window.scrollTo({ top: targetScroll, behavior });
    } else {
      (scroller as HTMLElement).scrollTop = targetScroll;
    }

    if (SM_SCROLL_DEBUG) {
      const measure = () => {
        const elTopNow = el.getBoundingClientRect().top;
        const headerNow = bar ? bar.getBoundingClientRect().bottom : 0;
        const covered = elTopNow < headerNow - 2;
        const currentST = scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;
        smScrollLog(`AFTER idx=${idx} elTopNow=${elTopNow.toFixed(0)} headerBottomNow=${headerNow.toFixed(0)} scrollTop=${currentST.toFixed(0)} ${covered ? "BAD❌被遮" : "OK✅未遮"}`);
      };
      if (behavior === "smooth") setTimeout(measure, 500);
      else requestAnimationFrame(() => requestAnimationFrame(measure));
    }
  };

  const jumpToStart = () => {
    goSentence(0);
    // 「从头开始」= 从第一句连续自动播放（不句末自停），符合整段跟读流
    deps.setPendingPlay(sentences[0]?.start_time ?? 0, null);
    deps.tryStartPendingPlay();
    setResumeDismissed(true);
  };
  const dismissStart = () => setResumeDismissed(true);

  // 「从头开始」浮条自动消失：一旦用户离开上次学到的句位（连续播放自动推进 / 点下一句 / 手动跳转），
  // 该提示即不再相关，自动隐藏；已显式点按过则保持隐藏，不会重现。
  useEffect(() => {
    if (resumeIndex != null && currentIndex !== resumeIndex) {
      setResumeDismissed(true);
    }
  }, [currentIndex, resumeIndex]);

  // ── 提交 YouTube 链接 → 后端异步解析 + 轮询 ──
  const refreshVideos = async () => {
    try { const v: Video[] = await fetchVideos(); setVideos(v); } catch { /* 静默 */ }
  };

  const stopParsePolling = () => {
    if (parseTimerRef.current) { clearTimeout(parseTimerRef.current); parseTimerRef.current = null; }
  };

  useEffect(() => () => stopParsePolling(), []); // 卸载时清理轮询

  const submitVideoUrl = async (rawUrl: string) => {
    const url = (rawUrl || "").trim();
    setParseError("");
    if (!url) { setParseError("请输入 YouTube 链接"); return; }
    // 提交请求本身也会抖动。后端对同链接已有 pending/processing/done 任务会直接复用，
    // 因此重试不会产生重复下载，可以放心重试一次。
    let res: any;
    try {
      res = await submitVideo(url);
    } catch (e) {
      if (!isNetworkError(e)) {
        setParseError(friendlyParseError(e, "提交失败，请检查链接或登录状态"));
        return;
      }
      try {
        res = await submitVideo(url);
      } catch (e2) {
        setParseError(friendlyParseError(e2, "提交失败，请检查网络连接后重试"));
        return;
      }
    }
    setParseError("");

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

    let netFails = 0;
    const startedAt = Date.now();

    const poll = async () => {
      // 超时保护：任务卡死时不要无限转圈
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopParsePolling();
        setParseJob(null);
        setParseError("解析超时（超过 10 分钟仍未完成）。请稍后刷新列表查看，或重新提交。");
        return;
      }
      try {
        const j: any = await getParseJob(jobId);
        netFails = 0; // 成功一次即清零
        if (j.status === "done") {
          stopParsePolling();
          setParseJob(null);
          setParseInput("");
          await refreshVideos();
          if (j.video_id) openVideo(j.video_id);
          return;
        }
        if (j.status === "failed") {
          stopParsePolling();
          setParseError(j.error || "解析失败，请稍后重试");
          setParseJob(null);
          return;
        }
        setParseJob({ job_id: j.id, status: j.status });
      } catch (e: any) {
        // 网络抖动 ≠ 解析失败：后端任务仍在跑，继续轮询；
        // 只有连续失败累计到阈值（约 30s）才判定为真的连不上。
        if (isNetworkError(e) && netFails + 1 < POLL_MAX_NET_FAILS) {
          netFails += 1;
        } else {
          stopParsePolling();
          setParseJob(null);
          setParseError(friendlyParseError(e, "查询解析进度失败"));
          return;
        }
      }
      // 自调度：等上一次请求返回后再排下一次，避免弱网下请求叠加
      parseTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    parseTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  };

  return {
    videos, loading,
    sentences, currentIndex, setCurrentIndex, currentSentence, currentVideo,
    resumeIndex, resumeDismissed, jumpToStart, dismissStart,
    progressList, progressMap, reportPosition, goSentence, scrollToSentence,
    parseInput, setParseInput, parseJob, parseError, submitVideoUrl,
  };
}
