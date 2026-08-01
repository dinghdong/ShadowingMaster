import { useState } from "react";
import { Sentence } from "../shared";
import { lsGet } from "./prefs";
import { PRACTICE_MODES, PracticeMode, isSingleSentenceMode } from "./practiceMode";

export interface ExercisesDeps {
  currentSentence: Sentence;
  playFrom: (start: number, end: number) => void;
  videoRef: { current: HTMLVideoElement | null };
  playEndRef: { current: number | null };
  resetSentenceState: () => void;
}

/**
 * 四种练习模式：view(原文/精听) / 跟读 / 听写 / 挖空 —— 从原 useApp 原样搬出。
 * 精听降级为整段「隐藏字幕」开关；听写 / 挖空为每句独立作答状态。
 */
export function useExercises(deps: ExercisesDeps) {
  const { currentSentence, playFrom, videoRef, playEndRef, resetSentenceState } = deps;

  const lsPracticeMode = (): PracticeMode => {
    const v = lsGet("sm.practiceMode", "view");
    return (PRACTICE_MODES as readonly string[]).includes(v) ? (v as PracticeMode) : "view";
  };

  const [subtitleMode, setSubtitleMode] = useState<"both" | "english" | "chinese">(() => lsGet("sm.subtitleMode", "both") as "both" | "english" | "chinese");
  const [practiceMode, setPracticeModeState] = useState<PracticeMode>(lsPracticeMode);
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

  const setPracticeMode = (m: PracticeMode) => {
    setPracticeModeState(m);
    resetSentenceState();
    // 不再清空听写/挖空：同一句话可同时保留多种练习结果
    // 练习模式（跟读/听写/挖空）：切入即从头播当前句，句末自动暂停，方便逐句练习
    if (isSingleSentenceMode(m) && currentSentence) {
      playFrom(currentSentence.start_time, currentSentence.end_time);
    } else if (m === "view") {
      // 精听：切回即连续自动播放（不限单句）
      const v = videoRef.current;
      if (v) {
        playEndRef.current = null;
        v.play().catch(() => {});
      }
    }
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

  return {
    subtitleMode, setSubtitleMode,
    practiceMode, setPracticeMode,
    subtitleHidden, revealIntensive,
    dictationTexts, setDictationText, dictationChecked, checkDictation, redoDictation,
    clozeAnswers, setClozeAnswer, clozeChecked, checkCloze, redoCloze,
    wordHighlight, setWordHighlight,
    clearExercises,
  };
}
