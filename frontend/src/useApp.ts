import { useEffect, useRef, useState } from "react";
import { lsSet } from "./hooks/prefs";
import { useRouting } from "./hooks/useRouting";
import { useAuth } from "./hooks/useAuth";
import { useVideos } from "./hooks/useVideos";
import { useWordBook } from "./hooks/useWordBook";
import { usePlayer } from "./hooks/usePlayer";
import { useExercises } from "./hooks/useExercises";
import { useRecording } from "./hooks/useRecording";

/**
 * 应用共享状态与交互逻辑（Slice 0 原型转正）。
 * 数据获取 / API 调用 / 状态管理集中在这里，App.tsx 只负责渲染。
 *
 * 模块化（方案 B）：逻辑已按领域拆到 hooks/ 下的子 Hook，本文件只做「组合 + 聚合返回」，
 * 对外返回的 AppState 字段名、类型与运行行为与拆分前完全一致，页面无需任何改动。
 */
export type { ShadowScore, ShadowRecording } from "./hooks/useRecording";

export function useApp() {
  // 轻提示（跨领域，保留在组合层）
  const [toast, setToast] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  };

  // 子 Hook 之间存在少量环形依赖（如「视频加载完成 → 触发播放器起播」）。
  // 这里用 ref 做延迟绑定：所有跨域调用点都在渲染提交之后（effect / 事件回调 / 异步续体），
  // 取到的始终是最新一次渲染的实现，与拆分前单文件内的闭包取值等价。
  const wordBookRef = useRef<ReturnType<typeof useWordBook> | null>(null);
  const playerRef = useRef<ReturnType<typeof usePlayer> | null>(null);
  const exercisesRef = useRef<ReturnType<typeof useExercises> | null>(null);
  const recordingRef = useRef<ReturnType<typeof useRecording> | null>(null);

  const routing = useRouting();

  const auth = useAuth({
    setPage: routing.setPage,
    loginReturnRef: routing.loginReturnRef,
    refreshWordBook: () => { wordBookRef.current?.refreshWordBook(); },
  });

  const videos = useVideos({
    page: routing.page,
    currentVideoId: routing.currentVideoId,
    jumpTargetRef: routing.jumpTargetRef,
    openVideo: routing.openVideo,
    resetSentenceState: () => { playerRef.current?.resetSentenceState(); },
    setPendingPlay: (t, end = null) => { if (playerRef.current) playerRef.current.pendingPlayRef.current = { start: t, end }; },
    tryStartPendingPlay: () => { playerRef.current?.tryStartPendingPlay(); },
    clearExercises: () => { exercisesRef.current?.clearExercises(); },
    setFavorites: (v) => { wordBookRef.current?.setFavorites(v); },
    setNotes: (v) => { wordBookRef.current?.setNotes(v); },
    setRecordings: (v) => { recordingRef.current?.setRecordings(v); },
    setRecordingId: (v) => { recordingRef.current?.setRecordingId(v); },
    setEvalOpenId: (v) => { recordingRef.current?.setEvalOpenId(v); },
    setRecognizedText: (v) => { recordingRef.current?.setRecognizedText(v); },
    setWordMatches: (v) => { recordingRef.current?.setWordMatches(v); },
  });

  const player = usePlayer({
    sentences: videos.sentences,
    currentIndex: videos.currentIndex,
    currentSentence: videos.currentSentence,
    setCurrentIndex: videos.setCurrentIndex,
    goSentence: videos.goSentence,
    reportPosition: videos.reportPosition,
    getPracticeMode: () => exercisesRef.current!.practiceMode,
  });
  playerRef.current = player;

  const wordBook = useWordBook({
    page: routing.page,
    user: auth.user,
    setPage: routing.setPage,
    showToast,
    currentVideoId: routing.currentVideoId,
    currentVideo: videos.currentVideo,
    currentSentence: videos.currentSentence,
    openVideo: routing.openVideo,
    jumpTargetRef: routing.jumpTargetRef,
    videoRef: player.videoRef,
  });
  wordBookRef.current = wordBook;

  const exercises = useExercises({
    currentSentence: videos.currentSentence,
    playFrom: player.playFrom,
    videoRef: player.videoRef,
    playEndRef: player.playEndRef,
    resetSentenceState: player.resetSentenceState,
  });
  exercisesRef.current = exercises;

  const recording = useRecording({
    sentences: videos.sentences,
    playFrom: player.playFrom,
    suppressLoopRef: player.suppressLoopRef,
    showToast,
  });
  recordingRef.current = recording;

  // 全局偏好持久化：任一变化即写入 localStorage
  useEffect(() => {
    lsSet("sm.subtitleMode", exercises.subtitleMode);
    lsSet("sm.wordHighlight", String(exercises.wordHighlight));
    lsSet("sm.practiceMode", exercises.practiceMode);
    lsSet("sm.rateIdx", String(player.rateIdx));
  }, [exercises.subtitleMode, exercises.wordHighlight, exercises.practiceMode, player.rateIdx]);

  return {
    page: routing.page, setPage: routing.setPage, goLogin: routing.goLogin,
    user: auth.user, videos: videos.videos, loading: videos.loading,
    progressList: videos.progressList, progressMap: videos.progressMap,
    currentVideoId: routing.currentVideoId, currentVideo: videos.currentVideo, sentences: videos.sentences, currentIndex: videos.currentIndex, goSentence: videos.goSentence,
    resumeIndex: videos.resumeIndex, resumeDismissed: videos.resumeDismissed, jumpToStart: videos.jumpToStart, dismissStart: videos.dismissStart,
    currentSentence: videos.currentSentence,
    subtitleMode: exercises.subtitleMode, setSubtitleMode: exercises.setSubtitleMode,
    isRecording: recording.isRecording, recognizedText: recording.recognizedText, wordMatches: recording.wordMatches,
    wordBook: wordBook.wordBook, selectedWord: wordBook.selectedWord, wordDetail: wordBook.wordDetail, wordPopupOrigin: wordBook.wordPopupOrigin,
    error: auth.error,
    parseInput: videos.parseInput, setParseInput: videos.setParseInput, parseJob: videos.parseJob, parseError: videos.parseError, submitVideoUrl: videos.submitVideoUrl,
    openVideo: routing.openVideo, openWordOrigin: wordBook.openWordOrigin, handleLogin: auth.handleLogin, handleRegister: auth.handleRegister, handleLogout: auth.handleLogout,
    handleWordClick: wordBook.handleWordClick, addToWordBook: wordBook.addToWordBook, closeWord: wordBook.closeWord, speakWord: wordBook.speakWord, openWordDetail: wordBook.openWordDetail,
    videoRef: player.videoRef, playEndRef: player.playEndRef, loopSingleRef: player.loopSingleRef, suppressLoopRef: player.suppressLoopRef,
    loopSingle: player.loopSingle, setLoopSingle: player.setLoopSingle, rate: player.rate, cycleRate: player.cycleRate, setRate: player.setRate, RATES: player.RATES, playFrom: player.playFrom, playSentenceAt: player.playSentenceAt,
    isPlaying: player.isPlaying, setIsPlaying: player.setIsPlaying, togglePlay: player.togglePlay, jumpToSentence: player.jumpToSentence, onVideoLoaded: player.onVideoLoaded, handleTimeUpdate: player.handleTimeUpdate,
    practiceMode: exercises.practiceMode, setPracticeMode: exercises.setPracticeMode,
    playhead: player.playhead, subtitleHidden: exercises.subtitleHidden, revealIntensive: exercises.revealIntensive,
    dictationTexts: exercises.dictationTexts, setDictationText: exercises.setDictationText, dictationChecked: exercises.dictationChecked, checkDictation: exercises.checkDictation, redoDictation: exercises.redoDictation,
    clozeAnswers: exercises.clozeAnswers, setClozeAnswer: exercises.setClozeAnswer, clozeChecked: exercises.clozeChecked, checkCloze: exercises.checkCloze, redoCloze: exercises.redoCloze,
    wordHighlight: exercises.wordHighlight, setWordHighlight: exercises.setWordHighlight,
    favorites: wordBook.favorites, notes: wordBook.notes, openNoteId: wordBook.openNoteId, toast,
    searchQuery, setSearchQuery,
    toggleFav: wordBook.toggleFav, saveNoteFor: wordBook.saveNoteFor, copySentence: wordBook.copySentence, openNote: wordBook.openNote, closeNote: wordBook.closeNote, showToast,
    recordings: recording.recordings, recordingId: recording.recordingId, evalOpenId: recording.evalOpenId,
    startRecord: recording.startRecord, stopRecord: recording.stopRecord, playRecord: recording.playRecord, openEval: recording.openEval, closeEval: recording.closeEval,
  };
}

export type AppState = ReturnType<typeof useApp>;
