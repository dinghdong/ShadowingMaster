import { useEffect, useRef, useState } from "react";
import { Sentence, compareWords, tokenize } from "../shared";

// 跟读录音评分（本地，无后端依赖）
export interface ShadowScore {
  overall: number;   // 综合分 0-100
  accuracy: number; // 准确度（逐词正确率）
  coverage: number; // 完整度（识别词数 / 原句词数）
  fluency: number;  // 流利度（录音时长 / 原句时长）
  recognizedText: string;
  perWord: { word: string; ok: boolean }[];
}

export interface ShadowRecording {
  url: string;            // 录音 blob 的 object url
  duration: number;       // 录音时长（秒）
  recognizedText: string; // 语音识别文本
  wordMatches: boolean[]; // 逐词是否正确
  score: ShadowScore | null;
}

export interface RecordingDeps {
  sentences: Sentence[];
  playFrom: (start: number, end: number) => void;
  /** 录音期间抑制单句循环（播放器内的同一个 ref） */
  suppressLoopRef: { current: boolean };
  showToast: (msg: string) => void;
}

/**
 * 跟读录音 + 本地评分（浏览器 MediaRecorder + 原生语音识别）。
 *
 * 关键修复：用 recordingIdRef 跟踪「当前正在录音的句子 id」，避免在 async 预备期后
 * 误读已过期的闭包 state（旧实现在 getUserMedia 之前就提前 return，导致录音永远不触发）。
 */
export function useRecording(deps: RecordingDeps) {
  const { sentences, playFrom, suppressLoopRef, showToast } = deps;

  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [wordMatches, setWordMatches] = useState<boolean[]>([]);
  // 跟读录音：每句本地录音（blob url）+ 识别评分；仅会话内有效（刷新即清空）
  const [recordings, setRecordings] = useState<Record<number, ShadowRecording>>({});
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [evalOpenId, setEvalOpenId] = useState<number | null>(null);
  // ref 版 recordingId：async 流程中读取最新值，防止闭包过期导致的提前 return
  const recordingIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recogRef = useRef<any>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 卸载时清理麦克风与定时器，避免泄漏
      try { mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop(); } catch { /* 忽略 */ }
      try { recogRef.current?.stop?.(); } catch { /* 忽略 */ }
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (autoStopRef.current != null) window.clearTimeout(autoStopRef.current);
    };
  }, []);

  // 评分：基于浏览器原生语音识别的逐词对比，给出 准确度/完整度/流利度 三项参考分。
  const computeScore = (s: Sentence, recognizedText: string, matches: boolean[], fluency?: number): ShadowScore => {
    const expected = tokenize(s.english_text).filter((t) => !t.space);
    const total = Math.max(1, expected.length);
    const correct = matches.filter(Boolean).length;
    const accuracy = Math.round((correct / total) * 100);
    const recWords = recognizedText.trim().split(/\s+/).filter(Boolean).length || 0;
    const coverage = Math.round(Math.min(1, recWords / total) * 100);
    const fl = fluency != null ? fluency : accuracy;
    const overall = Math.round(accuracy * 0.55 + coverage * 0.25 + fl * 0.2);
    const perWord = expected.map((t, i) => ({ word: t.text, ok: matches[i] ?? false }));
    return { overall, accuracy, coverage, fluency: fl, recognizedText, perWord };
  };

  const resetRecordingState = () => {
    recogRef.current = null;
    mediaRecorderRef.current = null;
    recordStreamRef.current = null;
    recordingIdRef.current = null;
    suppressLoopRef.current = false;
    if (mountedRef.current) {
      setRecordingId(null);
      setIsRecording(false);
    }
  };

  const stopRecord = () => {
    if (autoStopRef.current != null) { window.clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    try { if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop(); } catch { /* 忽略 */ }
    try { recogRef.current?.stop?.(); } catch { /* 忽略 */ }
    try { recordStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* 忽略 */ }
    resetRecordingState();
  };

  const startRecord = async (sentenceId: number) => {
    // 用 ref 判断，避免闭包过期导致「一次只录一句」误判
    if (recordingIdRef.current !== null) return;
    const s = sentences.find((x) => x.id === sentenceId);
    if (!s) return;

    // 标记录音中（按钮变红 + 预备期可取消）
    recordingIdRef.current = sentenceId;
    setRecordingId(sentenceId);
    setIsRecording(true);
    suppressLoopRef.current = true; // 录音期间抑制单句循环，避免干扰跟读
    showToast("🔊 听原句中…");
    if (s.end_time > s.start_time) playFrom(s.start_time, s.end_time);
    const prepMs = s.end_time > s.start_time ? (s.end_time - s.start_time) * 1000 + 400 : 400;
    await new Promise((r) => setTimeout(r, prepMs));

    // 预备期间用户取消（点了停止）：recordingIdRef 已被 stopRecord 清空
    if (recordingIdRef.current !== sentenceId) { setIsRecording(false); return; }

    // 安全上下文检查：getUserMedia 仅在 HTTPS 或 localhost 可用
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("当前环境不支持录音（需通过 https 或 localhost 访问）");
      resetRecordingState();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast("无法访问麦克风，请检查浏览器权限");
      resetRecordingState();
      return;
    }
    recordStreamRef.current = stream;
    recordChunksRef.current = [];

    let mr: MediaRecorder;
    try {
      // 选择浏览器支持的录音格式，缺省回落到 audio/webm
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = mimeCandidates.find((t) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t)) || "";
      mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      showToast("当前浏览器不支持录音");
      resetRecordingState();
      return;
    }
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e: any) => { if (e.data && e.data.size) recordChunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        const dur = audio.duration || 0;
        const expected = Math.max(0.1, s.end_time - s.start_time);
        // 流利度：录音时长接近原句时长 → 高分；过短/过长都扣分
        const ratio = dur / expected;
        const fluency = Math.max(30, Math.min(100, Math.round((ratio <= 1 ? ratio : 1 / Math.max(0.2, ratio)) * 100)));
        if (!mountedRef.current) return;
        setRecordings((prev) => {
          const ex = prev[sentenceId] || { url: "", duration: 0, recognizedText: "", wordMatches: [], score: null };
          if (ex.url && ex.url !== url) URL.revokeObjectURL(ex.url);
          const score = ex.score
            ? { ...ex.score, fluency, overall: Math.round(ex.score.accuracy * 0.55 + ex.score.coverage * 0.25 + fluency * 0.2) }
            : null;
          return { ...prev, [sentenceId]: { url, duration: dur, recognizedText: ex.recognizedText, wordMatches: ex.wordMatches, score } };
        });
      };
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* 忽略 */ }
      if (mountedRef.current) showToast("录音完成");
    };
    mr.start();
    showToast("🎙️ 请跟读…");

    // 同时跑语音识别用于评分（识别与原句逐词对比）
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        const m = compareWords(s.english_text, text);
        const score = computeScore(s, text, m.matches);
        if (!mountedRef.current) return;
        setRecordings((prev) => {
          const ex = prev[sentenceId] || { url: "", duration: 0, recognizedText: "", wordMatches: [], score: null };
          if (ex.url) {
            // 已录到音：先用 duration 估算流利度，稍后 onstop 回填精确值
            const expected = Math.max(0.1, s.end_time - s.start_time);
            const est = Math.max(30, Math.min(100, Math.round((expected / expected) * 80)));
            score.fluency = est;
            score.overall = Math.round(score.accuracy * 0.55 + score.coverage * 0.25 + est * 0.2);
          }
          return { ...prev, [sentenceId]: { ...ex, recognizedText: text, wordMatches: m.matches, score } };
        });
      };
      rec.onerror = () => { /* 仅无识别分，录音仍保留 */ };
      try { rec.start(); recogRef.current = rec; } catch { /* 忽略 */ }
    }

    // 自动停止：听完原句后，给用户充足时间把整句跟读完。
    // 窗口 = 原句时长 + 充裕缓冲（4s），且最短 8s，避免短句/计时异常时被中途切断。
    // （想拿最佳流利度分，可在说完时手动点停止；自动停止只是兜底，防止漏存。）
    const spokenMs = Math.max(0, (s.end_time - s.start_time) * 1000);
    const autoMs = Math.max(spokenMs + 4000, 8000);
    autoStopRef.current = window.setTimeout(() => stopRecord(), autoMs);
  };

  const playRecord = (sentenceId: number) => {
    const rec = recordings[sentenceId];
    if (!rec?.url) { showToast("还没有录音"); return; }
    const a = new Audio(rec.url);
    a.play().catch(() => showToast("播放失败"));
  };

  const openEval = (sentenceId: number) => {
    setEvalOpenId(sentenceId);
  };
  const closeEval = () => setEvalOpenId(null);

  return {
    isRecording, setIsRecording,
    recognizedText, setRecognizedText,
    wordMatches, setWordMatches,
    recordings, setRecordings,
    recordingId, setRecordingId,
    evalOpenId, setEvalOpenId,
    startRecord, stopRecord, playRecord, openEval, closeEval,
  };
}
