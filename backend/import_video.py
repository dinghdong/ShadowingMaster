"""一次性导入脚本（Slice 1 骨架）：把 yt-dlp 下载的 <youtube_id>.en.vtt 解析成句级字幕入库。
用法：python import_video.py <youtube_id> <title>
Slice 2 会把它泛化成完整的爬取 CLI。
"""
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).parent
MEDIA = BACKEND / "media"
DB_PATH = BACKEND.parent / "app.db"

TS_RE = re.compile(r"(\d+):(\d+):(\d+)\.(\d+)")
TAG_RE = re.compile(r"<[^>]+>")
SKIP_RE = re.compile(r"^\[.*\]$")  # [Music] / [Applause] 等
BRACKET_RE = re.compile(r"\[[^\]]*\]")  # 句中混入的 [music] 等标记，直接剔除


def ts_to_sec(ts: str) -> float:
    m = TS_RE.search(ts)
    h, mnt, s, ms = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return h * 3600 + mnt * 60 + s + ms / 1000


def parse_vtt(path: Path):
    """解析 YouTube 滚动式自动字幕：每条 cue 只取带卡拉OK标签的'新词行'，天然去重。"""
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
                clean = TAG_RE.sub("", raw).strip()
                if clean:
                    cue_lines.append(clean)
                    if had_tag:
                        new_line = clean
                i += 1
            # 只取带卡拉OK标签的"新词行"；无标签的单行 cue 是上一句的复述/音乐，跳过
            text = BRACKET_RE.sub("", new_line).strip()
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


def probe_duration(mp4: Path) -> int:
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
        capture_output=True, text=True, check=True,
    )
    return int(float(out.stdout.strip()))


def ingest(youtube_id: str, title: str) -> int:
    """把 media/ 下已下载的 <youtube_id>.en.vtt/.mp4 解析入库，返回 video_id。"""
    vtt = MEDIA / f"{youtube_id}.en.vtt"
    mp4 = MEDIA / f"{youtube_id}.mp4"
    jpg = MEDIA / f"{youtube_id}.jpg"
    assert vtt.exists() and mp4.exists(), f"缺少 {vtt} 或 {mp4}，先用 yt-dlp 下载"

    sents = merge_sentences(parse_vtt(vtt))
    duration = probe_duration(mp4)

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    old = conn.execute("SELECT id FROM videos WHERE youtube_id = ?", (youtube_id,)).fetchone()
    if old:
        conn.execute("DELETE FROM sentences WHERE video_id = ?", (old["id"],))
        conn.execute("DELETE FROM videos WHERE id = ?", (old["id"],))
    cur = conn.execute(
        "INSERT INTO videos (youtube_id, title, duration_seconds, thumbnail_url, video_path, sentence_count) VALUES (?,?,?,?,?,?)",
        (youtube_id, title, duration,
         f"/media/{youtube_id}.jpg" if jpg.exists() else None,
         f"/media/{youtube_id}.mp4", len(sents)),
    )
    vid = cur.lastrowid
    conn.executemany(
        "INSERT INTO sentences (video_id, sentence_index, start_time, end_time, english_text) VALUES (?,?,?,?,?)",
        [(vid, idx, st, en, text) for idx, (st, en, text) in enumerate(sents)],
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
