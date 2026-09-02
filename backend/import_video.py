"""一次性导入脚本（Slice 1 骨架）：把 yt-dlp 下载的 <youtube_id>.en.vtt 解析成句级字幕入库。
用法：python import_video.py <youtube_id> <title>
Slice 2 会把它泛化成完整的爬取 CLI。
"""
import html
import re
import json
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Optional

BACKEND = Path(__file__).parent
MEDIA = BACKEND / "media"
DB_PATH = BACKEND.parent / "app.db"

TS_RE = re.compile(r"(\d+):(\d+):(\d+)\.(\d+)")
TAG_RE = re.compile(r"<[^>]+>")
SKIP_RE = re.compile(r"^\[.*\]$")  # [Music] / [Applause] 等
BRACKET_RE = re.compile(r"\[[^\]]*\]")  # 句中混入的 [music] 等标记，直接剔除
# YouTube 自动字幕常在句首加 ">>" 表示说话人切换（VTT 里是 &gt;&gt;），纯字幕噪声，整段剔除
SPEAKER_RE = re.compile(r"^>+\s*")
# TED / 社区翻译字幕首条 cue 常是译者署名（中文轨尤其明显），不是台词内容，整行剔除。
CREDITS_RE = re.compile(
    r"^\s*(翻译人员|校对人员|译者|审校|字幕翻译|Translator|Reviewer|Translated by|Reviewed by)\s*[:：]",
    re.IGNORECASE,
)


def clean_text(s: str) -> str:
    """清洗一行字幕原文：去 VTT 标签 → 解码 HTML 实体（&gt; &nbsp; &amp; …）→
    非断空格归一 → 去 [music] 等标记 → 去句首说话人标记 >>。"""
    s = TAG_RE.sub("", s)
    s = html.unescape(s)
    s = s.replace("\xa0", " ")  # &nbsp; → 普通空格
    s = BRACKET_RE.sub("", s)
    s = SPEAKER_RE.sub("", s).strip()
    return s


def ts_to_sec(ts: str) -> float:
    m = TS_RE.search(ts)
    h, mnt, s, ms = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return h * 3600 + mnt * 60 + s + ms / 1000


CJK_RE = re.compile(r"[\u4e00-\u9fff\u3040-\u30ff]")


def join_texts(parts) -> str:
    """拼接字幕片段：中日文不用空格分隔（否则译文里会出现「它们 有非常」这种断裂），
    拉丁文仍用空格。"""
    parts = [p for p in parts if p]
    if not parts:
        return ""
    sep = "" if any(CJK_RE.search(p) for p in parts) else " "
    return sep.join(parts)


def parse_vtt(path: Path, full_text: bool = False):
    """解析 YouTube 滚动式自动字幕：每条 cue 只取带卡拉OK标签的'新词行'，天然去重。

    full_text=True：改为拼接 cue 内全部行。用于**译文**字幕（如 zh-Hans）——
    译文的 <c> 标签对应的是源语言词边界，中文没有空格，只取"新词行"会把句子切碎，
    必须整条 cue 都取。
    """
    chunks = []
    lines = path.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if "-->" in line:
            start_s, end_s = [t.strip() for t in line.split("-->")[:2]]
            end_s = end_s.split()[0]  # 去掉 align:start 等后缀
            i += 1
            cue_lines = []
            new_line = ""
            # cue 以严格空行结尾；纯空白行（含 position 对齐空格）属于 cue 内容，跳过即可
            while i < len(lines) and lines[i] != "":
                raw = lines[i]
                had_tag = bool(TAG_RE.search(raw))
                clean = clean_text(raw)
                if clean and CREDITS_RE.match(clean):
                    clean = ""  # 译者署名行：丢弃，避免混进第一句台词
                if clean:
                    cue_lines.append(clean)
                    if had_tag:
                        new_line = clean
                i += 1
            # 优先取带卡拉OK标签的"新词行"（YouTube 自动字幕，天然去重）；
            # 无标签时（人工字幕/TED 等非自动字幕）回退到拼接全部 cue 行。
            if full_text:
                text = join_texts(cue_lines)
            elif new_line.strip():
                text = new_line.strip()
            elif cue_lines:
                text = " ".join(cue_lines)
            else:
                text = ""
            if text:
                chunks.append((ts_to_sec(start_s), ts_to_sec(end_s), text))
        else:
            i += 1
    return chunks


TERMINAL = (".", "?", "!", "…")


def ends_sentence(word: str) -> bool:
    """词去掉收尾引号/括号后是否以句末标点结尾（即真实句子边界）。"""
    return word.rstrip("\"'”’)]").endswith(TERMINAL)


def words_stream(chunks):
    """词块展平成词流；块内按词序线性插值得到每个词的近似时间。"""
    words = []
    for start, end, text in chunks:
        ws = text.split()
        if not ws:
            continue
        span = max(end - start, 0.3)
        for i, w in enumerate(ws):
            words.append((start + span * i / len(ws), w))
    return words


def merge_sentences(chunks, max_gap=3.0):
    """分句：源字幕带标点时按标点断句（高上限防呆）；无标点（纯自动字幕）回退到词数/时长规则。
    最后把不足 3 词的碎片并入前一句（前一句本身不是完整句时）。"""
    words = words_stream(chunks)
    if not words:
        return []
    punct_ratio = sum(1 for _, w in words if ends_sentence(w)) / len(words)
    punctuated = punct_ratio > 0.04
    max_words, max_span = (25, 15.0) if punctuated else (10, 9.0)

    sents, buf = [], []
    for t, w in words:
        if buf and (t - buf[-1][0]) > max_gap:
            sents.append(buf)
            buf = []
        buf.append((t, w))
        if ends_sentence(w) or len(buf) >= max_words or (t - buf[0][0]) >= max_span:
            sents.append(buf)
            buf = []
    if buf:
        sents.append(buf)

    out = []
    for b in sents:
        text = " ".join(w for _, w in b)
        if out and len(b) < 3 and not ends_sentence(out[-1][2].split()[-1]):
            ps, pe, pt = out.pop()
            out.append((ps, b[-1][0], f"{pt} {text}"))
        else:
            out.append((b[0][0], b[-1][0], text))
    return [(st, en + 0.4, t[0].upper() + t[1:]) for st, en, t in out]  # 句末留 0.4s 尾巴，避免最后一个词被截


def align_chinese(sents, zh_chunks):
    """把中文字幕（YouTube 官方译文轨）按时间轴对齐到已切好的英文句子。

    英文句子是我们自己按标点/词数合并出来的，与中文字幕的 cue 边界并不一致，
    所以这里做的是「区间重叠拼接」而非一一对应：
    - 与该英文句时间区间有重叠的中文 cue，按时间序拼接成该句的译文；
    - 完全没有重叠时（译文轨时间轴漂移/缺失片段），退化为取中心点最近的一条 cue，
      避免整句中文为空而把句子推回机器翻译。
    """
    if not zh_chunks:
        return []
    out = []
    for st, en, _text in sents:
        # 只算重叠时长，再按阈值筛掉「擦边」的邻居 cue：英文句边界是我们自己合并出来的，
        # 常与中文 cue 差 0.1~0.3s，若不过滤会把上/下一句译文的尾巴也拼进来。
        cands = []
        for zst, zen, ztext in zh_chunks:
            ov = min(en, zen) - max(st, zst)
            if ov > 0:
                cands.append((ov, zst, ztext))
        if cands:
            thr = min(0.35, (en - st) * 0.15)
            keep = [c for c in cands if c[0] >= thr] or [max(cands)]
            keep.sort(key=lambda c: c[1])  # 按时间序拼接
            out.append(join_texts([t for _, _, t in keep]))
        else:
            mid = (st + en) / 2
            best, best_d = "", None
            for zst, zen, ztext in zh_chunks:
                d = 0.0 if zst <= mid <= zen else min(abs(zst - mid), abs(zen - mid))
                if best_d is None or d < best_d:
                    best, best_d = ztext, d
            out.append(best)
    return out


def probe_duration(mp4: Path) -> Optional[int]:
    # ffmpeg 缺失时返回 None，由调用方回退到 yt-dlp 元信息里的 duration
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
            capture_output=True, text=True, check=True,
        )
        return int(float(out.stdout.strip()))
    except Exception:
        return None


def ingest(youtube_id: str, title: str, duration: Optional[int] = None, description: Optional[str] = None, tags: Optional[list] = None) -> int:
    """把 media/ 下已下载的 <youtube_id>.en.vtt/.mp4 解析入库，返回 video_id。
    duration 可选：ffmpeg 缺失时由调用方传入 yt-dlp 元信息里的时长。
    description / tags 可选：来自 yt-dlp 元信息，tags 以 JSON 字符串入库。
    """
    vtt = MEDIA / f"{youtube_id}.en.vtt"
    mp4 = MEDIA / f"{youtube_id}.mp4"
    if not vtt.exists() or not mp4.exists():
        missing = []
        if not vtt.exists():
            missing.append(str(vtt))
        if not mp4.exists():
            missing.append(str(mp4))
        raise FileNotFoundError(
            f"导入失败：{', '.join(missing)} 不存在。"
            "通常是 yt-dlp 未成功下载完整视频或英文字幕，请检查下载阶段日志。"
        )

    sents = merge_sentences(parse_vtt(vtt))
    if duration is None:
        duration = probe_duration(mp4) or 0

    # 中文译文：优先用 YouTube 官方译文轨（zh-Hans 等，由 fetch_video 下载为 *.zh.vtt）。
    # 相比调第三方翻译 API，官方译文无限流、质量更好，且时间轴与英文字幕同源。
    # 只有在译文轨缺失/未覆盖到的句子上，才留给 translate_video 走机器翻译补漏。
    zh_map = []
    zh_vtt = MEDIA / f"{youtube_id}.zh.vtt"
    if zh_vtt.exists():
        zh_chunks = parse_vtt(zh_vtt, full_text=True)
        zh_map = align_chinese(sents, zh_chunks)
        filled = sum(1 for x in zh_map if x)
        print(f"中文字幕轨：{len(zh_chunks)} 条，覆盖 {filled}/{len(sents)} 句")

    # 封面：ffmpeg 缺失时 yt-dlp 可能只产出 webp/png，按扩展名依次查找
    thumb_url = None
    for ext in ("jpg", "webp", "png"):
        if (MEDIA / f"{youtube_id}.{ext}").exists():
            thumb_url = f"/media/{youtube_id}.{ext}"
            break

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    old = conn.execute("SELECT id FROM videos WHERE youtube_id = ?", (youtube_id,)).fetchone()
    if old:
        conn.execute("DELETE FROM sentences WHERE video_id = ?", (old["id"],))
        conn.execute("DELETE FROM videos WHERE id = ?", (old["id"],))
    cur = conn.execute(
        "INSERT INTO videos (youtube_id, title, duration_seconds, thumbnail_url, video_path, sentence_count, description, tags) VALUES (?,?,?,?,?,?,?,?)",
        (youtube_id, title, duration, thumb_url, f"/media/{youtube_id}.mp4", len(sents), description, json.dumps(tags or [], ensure_ascii=False)),
    )
    vid = cur.lastrowid
    conn.executemany(
        "INSERT INTO sentences (video_id, sentence_index, start_time, end_time, english_text, chinese_text) VALUES (?,?,?,?,?,?)",
        [(vid, idx, st, en, text, (zh_map[idx] if idx < len(zh_map) else None))
         for idx, (st, en, text) in enumerate(sents)],
    )
    conn.commit()
    conn.close()
    print(f"导入完成：video_id={vid}，{len(sents)} 句，时长 {duration}s")
    for st, en, t in sents[:5]:
        print(f"  [{st:6.1f}-{en:6.1f}] {t}")
    return vid


def main():
    ingest(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    main()
