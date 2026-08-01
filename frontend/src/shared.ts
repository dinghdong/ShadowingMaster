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
export function mediaUrl(u: string | null | undefined): string {
  if (!u) return "";
  return u.startsWith("/") ? `http://localhost:8000${u}` : u;
}

import COMMON_WORDS_JSON from "./data/common-words.json";

/**
 * 常用词表：SUBTLEXus 字幕语料 top 5000（51M 词美剧/电影字幕统计，带词形变形）。
 * 来源：https://github.com/words/subtlex-word-frequencies （ISC 协议）
 * 阈值经真实语料校准：标红率 9.2%，超 3 个红词的句子仅 18/492（docs/PRD.md 目标：每句 0-3 个）。
 */
const COMMON_WORDS = new Set<string>(COMMON_WORDS_JSON.map((w) => w.toLowerCase()));

/** 轻量词形归一：复数/过去式/进行时/所有格还原后查表 */
function isCommon(w: string): boolean {
  if (COMMON_WORDS.has(w)) return true;
  for (const n of [1, 2, 3]) { // s / es / ies 粗处理
    const stem = w.slice(0, w.length - n);
    if (stem.length >= 3 && COMMON_WORDS.has(stem)) return true;
  }
  if (w.endsWith("ies") && COMMON_WORDS.has(w.slice(0, -3) + "y")) return true;
  if (w.endsWith("ied") && COMMON_WORDS.has(w.slice(0, -3) + "y")) return true;
  for (const suf of ["ed", "ing"]) {
    if (w.endsWith(suf)) {
      const b = w.slice(0, -suf.length);
      if (COMMON_WORDS.has(b)) return true;
      if (b.length >= 2 && COMMON_WORDS.has(b.slice(0, -1))) return true; // 双写辅音
      if (COMMON_WORDS.has(b + "e")) return true; // 去 e 变形
    }
  }
  if (w.endsWith("'s") && COMMON_WORDS.has(w.slice(0, -2))) return true;
  return false;
}

export function isHardWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z']/g, "");
  return clean.length > 0 && !isCommon(clean);
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
 * 轻量中文翻译：调用免费 MyMemory 翻译 API（en→zh-CN，浏览器直连、CORS 放开）。
 * 失败（限流/网络）时返回 null，由调用方回退到英文释义，绝不阻塞弹窗。
 */
export async function translateEnToZh(text: string): Promise<string | null> {
  if (!text || !text.trim()) return null;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.responseData?.translatedText;
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
