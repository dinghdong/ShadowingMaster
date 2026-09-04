import { useEffect, useRef, useState } from "react";
import { Sentence } from "../shared";
import { lsGet } from "./prefs";
import { PracticeMode, isSingleSentenceMode } from "./practiceMode";
import { smScrollLog, smDiagLog, SM_DIAG } from "../scrollDebug";

export interface PlayerDeps {
  sentences: Sentence[];
  currentIndex: number;
  currentSentence: Sentence;
  setCurrentIndex: (idx: number) => void;
  goSentence: (idx: number) => void;
  reportPosition: (idx: number) => void;
  scrollToSentence: (idx: number, behavior?: ScrollBehavior) => void;
  /** 当前练习模式（useExercises 在其后声明，由 useApp 延迟绑定；读取点均在渲染提交之后） */
  getPracticeMode: () => PracticeMode;
}

/**
 * 播放控制（连续自动播放模型）：视频元素、单句/连续播放、单句循环、倍速、播放头。
 * 从原 useApp 原样搬出。
 */
export function usePlayer(deps: PlayerDeps) {
  const { sentences, currentIndex, currentSentence, setCurrentIndex, goSentence, reportPosition, scrollToSentence, getPracticeMode } = deps;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const playEndRef = useRef<number | null>(null);     // 单句播放的自动停点；null = 连续播放
  const suppressLoopRef = useRef(false);              // 跟读录音期间抑制单句循环
  const pendingPlayRef = useRef<{ start: number; end: number | null } | null>(null); // 进页后待自动播放的片段（位置记忆/跳原句：起点+止点，止点=null 为连续）
  const [isPlaying, setIsPlaying] = useState(false);
  // 视频加载/切换骨架屏：进页或切视频时为 true，元数据就绪（onVideoLoaded）后置 false
  const [playerLoading, setPlayerLoading] = useState(true);
  const [loopSingle, setLoopSingle] = useState(false);
  const loopSingleRef = useRef(false);
  useEffect(() => { loopSingleRef.current = loopSingle; }, [loopSingle]);
  // 切换到新视频（sentences 变化）时重新进入加载态，骨架屏重新出现
  useEffect(() => { setPlayerLoading(true); }, [sentences]);
  // 兜底：若视频元数据在 <video> 挂载前已就绪（缓存/极快加载），onLoadedMetadata 可能错过，
  // 故挂载后检查 readyState，已就绪(HAVE_METADATA)则直接解除 loading，避免卡在骨架屏。
  useEffect(() => {
    const v = videoRef.current;
    if (v && v.readyState >= 1) setPlayerLoading(false);
  }, [sentences]);
  const RATES = [1, 0.75, 1.25];
  const [rateIdx, setRateIdx] = useState(() => { const i = Number(lsGet("sm.rateIdx", "0")); return Number.isFinite(i) && i >= 0 && i < RATES.length ? i : 0; });
  const rate = RATES[rateIdx];
  const cycleRate = () => setRateIdx((i) => (i + 1) % RATES.length);
  const setRate = (r: number) => { const i = RATES.indexOf(r); if (i >= 0) setRateIdx(i); };

  function resetSentenceState() {
    // 注意：听写/挖空/精听隐藏为每句独立状态，不在切句时清空——保留用户选择
    setPlayhead(0);
  }

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
      if (isSingleSentenceMode(getPracticeMode()) && currentSentence) {
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
    playEndRef.current = isSingleSentenceMode(getPracticeMode()) ? s.end_time : null;
    v.currentTime = s.start_time;
    v.play().catch(() => {});
  };

  // 从待定起点（位置记忆/跳原句）开始默认连续自动播放；需元数据就绪
  const tryStartPendingPlay = () => {
    const v = videoRef.current;
    const pending = pendingPlayRef.current;
    if (!v || !pending || v.readyState < 1) return;
    pendingPlayRef.current = null;
    playEndRef.current = pending.end; // 有止点=单句播放后自停；null=连续
    v.playbackRate = rate;
    v.currentTime = pending.start;
    v.play().catch(() => {});
  };

  // 视频元数据就绪时尝试起播（覆盖"元数据后于数据就位"的情况）
  const onVideoLoaded = () => {
    setPlayerLoading(false);
    tryStartPendingPlay();
    // 视频真实高度此时才确定（.player-frame 撑开）；若其晚于首次滚动出现，
    // 当前句会被新撑开的吸顶视频盖住半截——重滚一次当前句兜底。
    smScrollLog(`VIDEOLOADED idx=${currentIndex}`);
    smDiagLog(`VIDEOLOADED idx=${currentIndex} readyState=${videoRef.current?.readyState} duration=${videoRef.current ? videoRef.current.duration.toFixed(1) : "n/a"}`);
    requestAnimationFrame(() => scrollToSentence(currentIndex, "auto"));
  };

  // 吸顶栏(.player-bar)高度变化（视频元数据撑开 / 布局抖动）时，把当前句重新定位到其下方。
  // 根因是「scrollToSentence 测量早于视频加载 → 当时 .player-bar 只有导航栏高度，等视频撑开后
  // 吸顶栏变高把已定位好的当前句盖住半截」（真机 100% 复现）。ResizeObserver 监听高度变化，
  // 一旦变高即把当前句重滚到新底边之下，彻底消除时序脆弱性（含 onVideoLoaded 兜底 + 此监听双保险）。
  const scrollToSentenceRef = useRef(scrollToSentence);
  scrollToSentenceRef.current = scrollToSentence;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let raf = 0;
    // player-bar 在首帧可能尚未渲染（sentences 加载前），轮询直到出现再挂载监听，
    // 否则一次性 querySelector 拿 null 会直接跳过，导致视频加载后无法被纠正。
    const attach = () => {
      const bar = document.querySelector(".player-bar");
      if (!bar || typeof ResizeObserver === "undefined") { raf = requestAnimationFrame(attach); return; }
      let last = -1;
      ro = new ResizeObserver(() => {
      const h = bar.getBoundingClientRect().height;
      if (last >= 0 && Math.abs(h - last) < 2) return; // 忽略细微抖动，避免无谓重滚
        last = h;
        smScrollLog(`RO barH=${h.toFixed(0)} idx=${currentIndexRef.current}`);
        smDiagLog(`RO-RESCROLL barH=${h.toFixed(0)} idx=${currentIndexRef.current}`);
        requestAnimationFrame(() => scrollToSentenceRef.current(currentIndexRef.current, "auto"));
      });
      ro.observe(bar);
    };
    attach();
    return () => { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, []);

  // 播放头驱动：单句自停/循环 + 高亮跟随 + 位置上报
  const handleTimeUpdate = (t: number, paused: boolean) => {
    const v = videoRef.current;
    setPlayhead(t);
    if (!v || paused) {
      if (SM_DIAG) smDiagLog(`TIMEUPDATE t=${t.toFixed(2)} paused=${paused} seeking=${v?.seeking} currentIndex=${currentIndex} (skipped: ${!v ? "no video" : "paused"})`);
      return;
    }
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
    if (end == null && isSingleSentenceMode(getPracticeMode()) && currentSentence && t >= currentSentence.end_time) {
      // 练习模式兜底：即使从连续播放进入，也在当前句末暂停，不自动跳下一句
      v.pause();
      return;
    }
    // 连续播放：当前句高亮跟随播放头
    const idx = sentences.findIndex((s) => t >= s.start_time && t < s.end_time);
    // 读 ref 而非闭包里的 currentIndex：rAF 每帧都调用本函数，而 setCurrentIndex 要到
    // 下次重渲染才反映到闭包上。中间这几帧若继续读旧值，会把同一句重复上报 / 重复滚动。
    // ref 在每次渲染时由 currentIndex 同步回来（见上方），故用户手动切句后依然准确。
    const cur = currentIndexRef.current;
    if (SM_DIAG) smDiagLog(`TIMEUPDATE t=${t.toFixed(2)} seeking=${v.seeking} currentIndex=${cur} detectedIdx=${idx} (${idx >= 0 && idx !== cur ? "WILL-SWITCH" : "no-op"})`);
    if (idx >= 0 && idx !== cur) {
      // 1) seek 进行中：t 不可信，整段跳过（既防高亮乱跳也防抖动）
      if (v.seeking) return;
      // 2) seek 刚结束的边界误判：浏览器回报的 t 略小于 start_T（浮点），被严格 <end 归到上一句，
      //    表现为 idx === currentIndex-1。此时 currentIndex 已是目标句，跳过即可，避免滚回上一句抖动。
      if (idx === cur - 1) return;
      currentIndexRef.current = idx;  // 同步占位，去重后续帧
      setCurrentIndex(idx);
      reportPosition(idx);
      smDiagLog(`AUTO-FOLLOW setCurrentIndex=${idx} (was ${cur}) start=${sentences[idx]?.start_time}`);
      // 自动跟随：用 instant（auto）滚动，避免真机 smooth scroll 被高频重入取消/重启导致落点漂移
      // （真机浏览器 smooth 重入不可靠，桌面模拟器仅偶发；这是真机 100% 半截显示的根因）。
      // 用户主动导航（点击/上下句）仍走 smooth，见 goSentence / 进页定位。
      smScrollLog(`AUTO idx=${idx} t=${v.currentTime.toFixed(2)}`);
      requestAnimationFrame(() => scrollToSentence(idx, "auto"));
    }
  };

  // rAF 始终调用最新一次渲染产生的 handleTimeUpdate，避免闭包里的 sentences /
  // currentSentence / practiceMode 过期（effect 依赖只有 isPlaying，不随渲染重挂）。
  const handleTimeUpdateRef = useRef(handleTimeUpdate);
  handleTimeUpdateRef.current = handleTimeUpdate;

  // 卡拉OK精度：<video> 的 timeupdate 由浏览器实现自行节流，实测约 250ms 一次(4Hz)。
  // 而字幕轨里真实词长中位数只有 240ms、55% 的词短于 250ms —— 词的存活时间比采样间隔
  // 还短，高亮只能整词整词地跳过去（按库内 33568 个词模拟：17.5% 的词从未被点亮）。
  // 播放期间改由 rAF 按屏幕刷新率(~16.7ms)读 currentTime 驱动，同口径模拟漏词率 0.1%。
  // 顺带把单句自停/循环的判定也提到同一精度：原先句末最多晚 250ms 才刹车。
  // 暂停与 seek 期间 rAF 不跑，仍由 <video> 的 timeupdate 兜底（seek 时它照常触发）。
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) handleTimeUpdateRef.current(v.currentTime, v.paused);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return {
    videoRef, playEndRef, loopSingleRef, suppressLoopRef, pendingPlayRef,
    playerLoading, playhead, resetSentenceState,
    isPlaying, setIsPlaying,
    loopSingle, setLoopSingle,
    RATES, rateIdx, rate, cycleRate, setRate,
    playFrom, playSentenceAt, togglePlay, jumpToSentence, tryStartPendingPlay, onVideoLoaded, handleTimeUpdate,
  };
}
