/**
 * 练习模式常量——原 useApp 顶部的 SINGLE_SENTENCE_MODES / isSingleSentenceMode 原样搬出，
 * usePlayer（播放控制）与 useExercises（模式切换）共用。
 */
export type PracticeMode = "view" | "shadow" | "dictation" | "cloze";

export const PRACTICE_MODES = ["view", "shadow", "dictation", "cloze"] as const;

// 跟读/听写/挖空 三种练习模式：均按「单句播放、句末自停」处理，方便逐句练习；
// 仅 view(原文/精听) 为整段连续自动播放。
const SINGLE_SENTENCE_MODES = new Set(["shadow", "dictation", "cloze"]);

export const isSingleSentenceMode = (m: string) => SINGLE_SENTENCE_MODES.has(m);
