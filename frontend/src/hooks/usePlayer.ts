import { useEffect, useRef, useState } from "react";
import { Sentence } from "../shared";
import { lsGet } from "./prefs";
import { PracticeMode, isSingleSentenceMode } from "./practiceMode";

export interface PlayerDeps {
  sentences: Sentence[];
  currentIndex: number;
  currentSentence: Sentence;
  setCurrentIndex: (idx: number) => void;
  goSentence: (idx: number) => void;
  reportPosition: (idx: number) => void;
  scrollToSentence: (idx: number) => void;
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
  const onVideoLoaded = () => { setPlayerLoading(false); tryStartPendingPlay(); };

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
    if (end == null && isSingleSentenceMode(getPracticeMode()) && currentSentence && t >= currentSentence.end_time) {
      // 练习模式兜底：即使从连续播放进入，也在当前句末暂停，不自动跳下一句
      v.pause();
      return;
    }
    // 连续播放：当前句高亮跟随播放头
    const idx = sentences.findIndex((s) => t >= s.start_time && t < s.end_time);
    if (idx >= 0 && idx !== currentIndex) {
      // 1) seek 进行中：t 不可信，整段跳过（既防高亮乱跳也防抖动）
      if (v.seeking) return;
      // 2) seek 刚结束的边界误判：浏览器回报的 t 略小于 start_T（浮点），被严格 <end 归到上一句，
      //    表现为 idx === currentIndex-1。此时 currentIndex 已是目标句，跳过即可，避免滚回上一句抖动。
      if (idx === currentIndex - 1) return;
      setCurrentIndex(idx);
      reportPosition(idx);
      requestAnimationFrame(() => scrollToSentence(idx));
    }
  };

  return {
    videoRef, playEndRef, loopSingleRef, suppressLoopRef, pendingPlayRef,
    playerLoading, playhead, resetSentenceState,
    isPlaying, setIsPlaying,
    loopSingle, setLoopSingle,
    RATES, rateIdx, rate, cycleRate, setRate,
    playFrom, playSentenceAt, togglePlay, jumpToSentence, tryStartPendingPlay, onVideoLoaded, handleTimeUpdate,
  };
}
