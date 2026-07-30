export interface Video {
  id: number;
  youtube_id: string;
  title: string;
  duration_seconds: number;
  thumbnail_url: string;
  sentence_count: number;
}

export interface Sentence {
  id: number;
  sentence_index: number;
  start_time: number;
  end_time: number;
  english_text: string;
  chinese_text: string | null;
}

export type Page = "login" | "list" | "player" | "wordbook";

const COMMON_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","must","shall","can","need","dare","ought","used","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","under","again","further","then","once","here","there","when","where","why","how","all","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","just","now","also","back","still","well","even","new","good","high","old","great","big","own","small","large","next","early","young","important","few","public","bad","same","able","i","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself","yourselves","he","him","his","himself","she","her","hers","herself","it","its","itself","they","them","their","theirs","themselves","what","which","who","whom","this","that","these","those","am","about","against","up","down","out","off","over","under","again","further","then","once","and","but","if","or","because","until","while","hello","everyone","welcome","back","our","channel","today","we","re","going","talk","learning","english","faster","key","consistent","practice","every","single","day","even","fifteen","minutes","can","make","huge","difference","shadowing","one","most","effective","techniques","jump","over","lazy","dog","run","forest","quick","brown","fox","learn","talk","job","interview","tips","conversation","daily",
]);

export function isHardWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  return clean.length > 0 && !COMMON_WORDS.has(clean);
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
