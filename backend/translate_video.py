"""Slice 3 · 中文字幕翻译管线：把 sentences 表里的英文翻成中文写入 chinese_text。
用法：python translate_video.py <video_id | all>
翻译源：Google Translate 免费端点为主，MyMemory 兜底；失败句子留空，可重跑补漏。
"""
import sqlite3
import sys
import time
from pathlib import Path

import requests

DB_PATH = Path(__file__).parent.parent / "app.db"


def translate(text: str) -> str | None:
    # 主：Google 免费端点（本地网络到 Google 有抖动，带 3 次重试）
    for attempt in range(3):
        try:
            r = requests.get(
                "https://translate.googleapis.com/translate_a/single",
                params={"client": "gtx", "sl": "en", "tl": "zh-CN", "dt": "t", "q": text},
                timeout=15,
            )
            if r.ok:
                return "".join(part[0] for part in r.json()[0] if part[0])
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    # 兜底：MyMemory
    try:
        r = requests.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": "en|zh-CN"},
            timeout=15,
        )
        if r.ok:
            return r.json()["responseData"]["translatedText"]
    except Exception:
        pass
    return None


def translate_video(conn: sqlite3.Connection, video_id: int, start: int = 0, end: int = 10**9) -> tuple[int, int]:
    conn.execute("PRAGMA busy_timeout = 60000")  # 多进程并发写同一 SQLite 时等锁而不是报错
    rows = conn.execute(
        "SELECT id, english_text FROM sentences WHERE video_id = ? AND sentence_index >= ? AND sentence_index < ? AND (chinese_text IS NULL OR chinese_text = '') ORDER BY sentence_index",
        (video_id, start, end),
    ).fetchall()
    ok, fail = 0, 0
    for i, (sid, en) in enumerate(rows):
        zh = translate(en)
        if zh:
            conn.execute("UPDATE sentences SET chinese_text = ? WHERE id = ?", (zh, sid))
            conn.commit()  # 逐句提交：进程被杀也能从断点续跑
            ok += 1
        else:
            fail += 1
        if (i + 1) % 25 == 0:
            print(f"  ... 进度 {i + 1}/{len(rows)}", flush=True)
        time.sleep(0.1)  # 限速，避免触发免费端点风控
    conn.commit()
    return ok, fail


def main():
    target = sys.argv[1]
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    end = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    if target == "all":
        video_ids = [r["id"] for r in conn.execute("SELECT id FROM videos")]
    else:
        video_ids = [int(target)]
    for vid in video_ids:
        ok, fail = translate_video(conn, vid, start, end)
        print(f"video_id={vid} [{start},{end}): 翻译 {ok} 句" + (f"，失败 {fail} 句（可重跑补漏）" if fail else ""))
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法：python translate_video.py <video_id | all> [起始句index] [结束句index]")
        sys.exit(1)
    main()
