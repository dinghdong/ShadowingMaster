export interface Video {
  id: number;
  youtube_id: string;
  title: string;
  duration_seconds: number;
  thumbnail_url: string;
  video_path: string | null;
  sentence_count: number;
  /** 视频简介（来自 YouTube 原视频，可空） */
  description?: string;
  /** 标签数组（来自 YouTube 原视频，可空） */
  tags?: string[];
}

export interface Sentence {
  id: number;
  sentence_index: number;
  start_time: number;
  end_time: number;
  english_text: string;
  chinese_text: string | null;
}

export type Page = "landing" | "login" | "list" | "player" | "wordbook" | "profile" | "add";

/** 后端相对路径（/media/...）转完整 URL；外链原样返回 */
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";
export function mediaUrl(u: string | null | undefined): string {
  if (!u) return "";
  return u.startsWith("/") ? `${API_BASE}${u}` : u;
}

import EXAM_TARGET_JSON from "./data/exam-words.target.json";

/**
 * 考纲标注目标词表（exam-words.target.json：CET4/6+考研+雅思+托福+SAT+GRE 并集，
 * 再减去初中/高中已学词的差集，13612 词；分级源数据见同目录 exam-words.json）。
 * 设计（2026-08-01 用户拍板）：命中词表的词 = 考纲要求掌握、且初高中没学过的词 = 句中标橙；
 * 初高中基础词（think/of/hate/sentence 级）不标，超出所有考纲的词（如 sentience/AI）也不标。
 * 注意必须是差集而非纯并集：考纲词表是累积制，cet4 词表本身收录基础词。
 * 想调整标注范围（如提到六级及以上），重新生成 target.json 即可。
 */
const TARGET_WORDS = new Set<string>(EXAM_TARGET_JSON as string[]);

/** 轻量词形归一：复数/过去式/进行时/所有格还原后查目标词表 */
function inTargetWords(w: string): boolean {
  if (TARGET_WORDS.has(w)) return true;
  // 所有格 's
  if (w.endsWith("'s") && TARGET_WORDS.has(w.slice(0, -2))) return true;
  // 复数 / 第三人称单数 -s（只去掉一个 s，避免 from→fro、right→rig 等误命中）
  if (w.endsWith("s") && !w.endsWith("ss")) {
    const stem = w.slice(0, -1);
    if (stem.length >= 2 && TARGET_WORDS.has(stem)) return true;
  }
  // -ies / -ied → -y
  if (w.endsWith("ies") && TARGET_WORDS.has(w.slice(0, -3) + "y")) return true;
  if (w.endsWith("ied") && TARGET_WORDS.has(w.slice(0, -3) + "y")) return true;
  // -ed / -ing
  for (const suf of ["ed", "ing"]) {
    if (w.endsWith(suf)) {
      const b = w.slice(0, -suf.length);
      if (TARGET_WORDS.has(b)) return true;
      if (b.length >= 2 && TARGET_WORDS.has(b.slice(0, -1))) return true; // 双写辅音
      if (TARGET_WORDS.has(b + "e")) return true; // 去 e 变形
    }
  }
  return false;
}

/**
 * 判断单词是否应标注（UI 橙色高亮 + 挖空优先挖）：命中考纲目标词表（TARGET_WORDS，见上）即标注。
 * clean 后长度 > 1 才判定：空串/标点不判；单字母（a/I）是最高频虚词，
 * 且词表按 len>=2 构建不含单字母，直接排除。词形还原逻辑见 inTargetWords。
 */
export function isHardWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z']/g, "");
  return clean.length > 1 && inTargetWords(clean);
}

export function tokenize(text: string) {
  const parts = text.split(/(\s+)/);
  return parts.map((part, i) => ({
    text: part,
    isHard: isHardWord(part),
    space: i % 2 === 1,
  }));
}

export function compareWords(original: string, recognized: string) {
  const ow = original.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const rw = recognized.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const matches = ow.map((w, i) => w === (rw[i] || ""));
  return { originalWords: ow, recognizedWords: rw, matches };
}

/** 生词弹窗解析后的释义结构（FreeDictionary 返回裁剪版） */
export interface WordMeaning {
  partOfSpeech: string;
  definition: string;
  example?: string;
  /** 机器翻译得到的中文释义（FreeDictionary 仅英文，需额外翻译） */
  definitionZh?: string;
  /** 例句的中文翻译 */
  exampleZh?: string;
}

/**
 * 轻量中文翻译：经后端代理调用 MyMemory（en→zh-CN）。
 * 改为走自家 API，规避浏览器直连外国主机在国内常超时/被重置的问题。
 * 失败（限流/网络）时返回 null，由调用方回退到英文释义，绝不阻塞弹窗。
 */
import { BASE } from "./api";

export async function translateEnToZh(text: string): Promise<string | null> {
  if (!text || !text.trim()) return null;
  try {
    const url = `${BASE}/api/translate?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.translatedText;
    return t ? String(t) : null;
  } catch {
    return null;
  }
}

export interface WordDetail {
  phonetic?: string;
  meanings: WordMeaning[];
  notFound?: boolean;
}

/** 词性英文 → 中文标签，方便成人学习者一目了然 */
const POS_MAP: Record<string, string> = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词",
  determiner: "限定词",
  article: "冠词",
  numeral: "数词",
};

export function posLabel(pos: string): string {
  if (!pos) return "";
  return POS_MAP[pos.toLowerCase()] || pos;
}
