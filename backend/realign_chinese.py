"""用已下载的中文字幕轨重算 chinese_text，不重新下载视频。

用途：
  1. 对齐/去重逻辑升级后，修正历史视频的译文（如滚动轨重复、译文错位）
  2. 某次解析中文字幕缺失、但 media/<id>.zh.vtt 仍在时补算

用法：
  python realign_chinese.py            # 处理所有缺中文或有 zh.vtt 的视频（只填空句）
  python realign_chinese.py 13         # 只处理指定 video_id（只填空句）
  python realign_chinese.py 13 --force # 强制重算：覆盖已有中文，新译文为空则置空

依赖 media/<youtube_id>.zh.vtt 存在；不存在则跳过（保持原中文不变，避免清空）。
"""
import sqlite3
import sys
from pathlib import Path

from import_video import MEDIA, DB_PATH, align_chinese, parse_vtt


def _cols(conn, table: str) -> str:
    """返回表的列名，失败诊断用（各环境 schema 可能不同）。"""
    try:
        return ",".join(r[1] for r in conn.execute(f"PRAGMA table_info({table})"))
    except Exception as e:
        return f"<读取失败 {e}>"


def realign(video_id: int, overwrite: bool = False) -> str:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row

    # 不同环境的 schema 可能不同（如老库缺列），显式挑明而不是抛裸 IndexError
    want = {"id", "youtube_id", "title"}
    have = set(_cols(conn, "videos").split(","))
    miss = want - have
    if miss:
        conn.close()
        return f"#{video_id}: videos 缺列 {sorted(miss)}，实际列：{sorted(have)}"

    v = conn.execute(
        "SELECT id, youtube_id, title FROM videos WHERE id = ?", (video_id,)
    ).fetchone()
    if not v:
        conn.close()
        return f"#{video_id}: 视频不存在"

    zh_path = MEDIA / f"{v['youtube_id']}.zh.vtt"
    if not zh_path.exists():
        conn.close()
        return f"#{video_id}: 无 {zh_path.name}，跳过"

    zh_chunks = parse_vtt(zh_path, full_text=True)
    if not zh_chunks:
        conn.close()
        return f"#{video_id}: {zh_path.name} 解析出 0 条，跳过"

    have_s = set(_cols(conn, "sentences").split(","))
    miss_s = {"id", "start_time", "end_time", "english_text", "chinese_text"} - have_s
    if miss_s:
        conn.close()
        return f"#{video_id}: sentences 缺列 {sorted(miss_s)}，实际列：{sorted(have_s)}"

    rows = conn.execute(
        "SELECT id, sentence_index, start_time, end_time, english_text, chinese_text FROM sentences "
        "WHERE video_id = ? ORDER BY sentence_index",
        (video_id,),
    ).fetchall()
    if not rows:
        conn.close()
        return f"#{video_id}: 无句子，跳过"

    sents = [(r["start_time"], r["end_time"], r["english_text"]) for r in rows]
    zh_map = align_chinese(sents, zh_chunks)

    updated = 0
    for r, zh in zip(rows, zh_map):
        if not zh:
            if not overwrite:
                continue  # 非强制模式：新译文为空则保留原中文（可能来自机翻补漏）
            # 强制重算：忠实于轨，置空。否则历史上那些「重复/错位」的脏译文会一直留着，
            # 看起来覆盖率很高，实际修完用户看到的还是旧的错误内容。
        elif not overwrite and (r["chinese_text"] or "").strip():
            continue  # 已有中文且非强制 → 保留
        conn.execute("UPDATE sentences SET chinese_text = ? WHERE id = ?", (zh, r["id"]))
        updated += 1
    conn.commit()

    filled = conn.execute(
        "SELECT COUNT(*) x FROM sentences WHERE video_id = ? "
        "AND chinese_text IS NOT NULL AND chinese_text != ''",
        (video_id,),
    ).fetchone()["x"]
    conn.close()
    return f"#{video_id} {v['youtube_id']}: 更新 {updated} 句 | 中文覆盖 {filled}/{len(rows)} | {v['title'][:36]}"


def main() -> None:
    args = [a for a in sys.argv[1:]]
    overwrite = "--all" in args or "--force" in args
    ids = [int(a) for a in args if a.lstrip("-").isdigit()]

    if not ids:
        conn = sqlite3.connect(str(DB_PATH))
        rows = conn.execute("SELECT id FROM videos ORDER BY id").fetchall()
        conn.close()
        ids = [r[0] for r in rows]

    print(f"处理 {len(ids)} 个视频（强制覆盖={overwrite}）")
    print("-" * 78)
    for vid in ids:
        try:
            print(realign(vid, overwrite=overwrite))
        except Exception as e:
            print(f"#{vid}: 失败 {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
