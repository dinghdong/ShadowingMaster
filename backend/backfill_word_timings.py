"""回填 sentences.word_timings —— 用 media/ 下已有的 .en.vtt 补齐历史数据的词级时间戳。

背景
----
卡拉OK高亮原先靠「句内线性均分」推算当前词：assume 每个词等时长。真人说话不匀速，
且 YouTube 自动字幕的 cue 常在说完之后仍挂在屏幕上等转场音乐走完（实测有说完 0.4s、
cue 却挂满 14s 的），于是高亮会一路飘到语音结束好几秒之后。

而字幕轨里本来就带毫秒级词时间戳（<00:02:28.600><c> so</c>），只是导入时被
clean_text() 的去标签步骤丢掉了。本脚本把它们捞回来贴到已入库的句子上。

设计约束
--------
* **不动 english_text / sentence_index / chinese_text**：句子 id 被 notes / favorites /
  vocabulary_words / user_progress 引用，译文也是按现有切句对齐过的，改文本会连带炸掉。
* 只写 word_timings；仅当整句逐词**完全对齐**时，才顺带把 start_time / end_time 收到
  真实语音边界（修掉旧实现 end_time = 末词起点 + 0.4s 固定尾巴带来的偏差）。
* 对不齐的句子留空 → 前端自动回退线性插值，老行为，不会更差。

用法
----
    python backfill_word_timings.py               # 全量回填
    python backfill_word_timings.py --dry-run     # 只报告不写库
    python backfill_word_timings.py --video a-Jmcp_hdJs
    python backfill_word_timings.py --db /data/app.db   # 生产库在挂载卷上时
"""
import argparse
import difflib
import json
import re
import sqlite3
import sys
from pathlib import Path

from import_video import MEDIA, DB_PATH, parse_vtt_words

NORM_RE = re.compile(r"[^a-z0-9']")


def norm(w: str) -> str:
    return NORM_RE.sub("", w.lower())


def align(db_words, real_words):
    """把库里的词序列对齐到 vtt 真实词流，返回与 db_words 等长的 [(t0,t1) | None]。

    用 difflib 而非按下标硬对：两边的分句/清洗规则不完全一致（旧版导入器与当前解析器
    差了好几个 commit），硬对会整体错位。SequenceMatcher 按最长公共子序列锚定，
    中间对不上的词留 None，后面再按锚点线性内插。
    """
    a = [norm(w) for w in db_words]
    b = [norm(t[2]) for t in real_words]
    slots = [None] * len(db_words)
    for ai, bi, size in difflib.SequenceMatcher(None, b, a, autojunk=False).get_matching_blocks():
        for k in range(size):
            slots[bi + k] = (real_words[ai + k][0], real_words[ai + k][1])
    return slots


def fill_gaps(slots):
    """锚点之间的空洞按时间线性内插；首尾空洞用最近锚点外推一个平均词长。

    返回 (timings, 是否全部有值)。全 None 时返回 (None, False)。
    """
    idx = [i for i, s in enumerate(slots) if s]
    if not idx:
        return None, False
    out = list(slots)

    # 中间空洞：在左右锚点之间均分
    for l, r in zip(idx, idx[1:]):
        if r - l <= 1:
            continue
        t0, t1 = out[l][1], out[r][0]
        step = max((t1 - t0) / (r - l), 0.0)
        for k in range(l + 1, r):
            s = t0 + step * (k - l - 1)
            out[k] = (s, s + step if step > 0 else s + 0.12)

    # 首尾空洞：按已知词的平均时长向外推
    known = [s for s in slots if s]
    avg = max(sum(e - b for b, e in known) / len(known), 0.12)
    for k in range(idx[0] - 1, -1, -1):
        e = out[k + 1][0]
        out[k] = (max(e - avg, 0.0), e)
    for k in range(idx[-1] + 1, len(out)):
        b = out[k - 1][1]
        out[k] = (b, b + avg)

    return [[round(b, 3), round(e, 3)] for b, e in out], all(s is not None for s in slots)


def backfill(only: str | None = None, dry_run: bool = False, db: str | None = None) -> int:
    conn = sqlite3.connect(str(db or DB_PATH))
    conn.row_factory = sqlite3.Row
    videos = conn.execute("SELECT id, youtube_id FROM videos ORDER BY id").fetchall()

    tot_sent = tot_filled = tot_exact = 0
    for v in videos:
        yid = v["youtube_id"]
        if only and yid != only:
            continue
        vtt = MEDIA / f"{yid}.en.vtt"
        if not vtt.exists():
            print(f"跳过 {yid}：{vtt.name} 不在 media/ 下")
            continue
        real = parse_vtt_words(vtt)
        if not real:
            print(f"跳过 {yid}：该字幕轨没有词级时间戳（人工字幕轨），保持线性插值回退")
            continue

        rows = conn.execute(
            "SELECT id, english_text FROM sentences WHERE video_id = ? ORDER BY sentence_index",
            (v["id"],),
        ).fetchall()
        # 整段视频统一对齐一次，再切回各句 —— 逐句单独对齐容易被重复词吸引到错误位置
        db_words, owner = [], []
        for r in rows:
            for w in r["english_text"].split():
                db_words.append(w)
                owner.append(r["id"])
        slots = align(db_words, real)

        by_sent, cursor = {}, 0
        for r in rows:
            n = len(r["english_text"].split())
            by_sent[r["id"]] = slots[cursor:cursor + n]
            cursor += n

        updates, exact = [], 0
        for r in rows:
            tim, complete = fill_gaps(by_sent[r["id"]])
            if tim is None:
                continue
            if complete:
                exact += 1
                updates.append((json.dumps(tim, separators=(",", ":")), tim[0][0], tim[-1][1], r["id"]))
            else:
                # 有内插成分 → 只写 timings，不动句子时间边界
                updates.append((json.dumps(tim, separators=(",", ":")), None, None, r["id"]))

        if not dry_run:
            conn.executemany(
                "UPDATE sentences SET word_timings = ?,"
                " start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time)"
                " WHERE id = ?",
                updates,
            )
            conn.commit()

        tot_sent += len(rows); tot_filled += len(updates); tot_exact += exact
        print(f"{yid}: {len(rows)} 句 → 回填 {len(updates)} 句（其中完全对齐 {exact} 句，同步收紧了时间边界）")

    conn.close()
    print(f"\n合计：{tot_sent} 句，回填 {tot_filled}，完全对齐 {tot_exact}"
          + ("（dry-run，未写库）" if dry_run else ""))
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", help="只处理某个 youtube_id")
    ap.add_argument("--dry-run", action="store_true", help="只报告，不写库")
    ap.add_argument("--db", help="库文件路径，默认取 import_video.DB_PATH（生产在 /data/app.db）")
    a = ap.parse_args()
    sys.exit(backfill(a.video, a.dry_run, a.db))
