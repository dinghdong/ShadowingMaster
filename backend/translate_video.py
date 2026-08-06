"""Slice 3 · 中文字幕翻译管线：把 sentences 表里的英文翻成中文写入 chinese_text。
用法：python translate_video.py <video_id | all>
翻译源：Google Translate 免费端点为主，MyMemory 兜底；失败句子留空，可重跑补漏。
"""
import os
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

DB_PATH = Path(__file__).parent.parent / "app.db"

# 并发 worker 数：环境变量可覆盖，默认 8（Google 免费端点并发放宽到 8 仍稳定）。
DEFAULT_WORKERS = int(os.environ.get("TRANSLATE_WORKERS", "8"))


def _detect_proxy() -> dict:
    """探测翻译请求要走的代理。
    与 fetch_video._detect_system_proxy 同源：优先 YTDLP_PROXY 环境变量，
    否则 macOS 用 scutil 读系统代理（ClashX 等常监听 127.0.0.1:7890）。
    直连 Google 翻译在受墙网络下会超时，必须走代理。"""
    env = os.environ.get("YTDLP_PROXY", "").strip()
    proxy = env
    if not proxy and sys.platform == "darwin":
        try:
            import re
            import subprocess
            out = subprocess.run(
                ["scutil", "--proxy"], capture_output=True, text=True, timeout=5
            ).stdout
            host = port = None
            for line in out.splitlines():
                m = re.match(r"\s*(HTTPS?Proxy)\s*:\s*(\S+)", line)
                if m:
                    host = m.group(2)
                m = re.match(r"\s*(HTTPS?Port)\s*:\s*(\d+)", line)
                if m:
                    port = m.group(2)
                if host and port and host not in ("0", ""):
                    proxy = f"http://{host}:{port}"
                    break
        except Exception:
            pass
    if not proxy:
        return {}
    return {"http": proxy, "https": proxy}


_PROXIES = _detect_proxy()


def translate(text: str) -> str | None:
    # 主：Google 免费端点（本地网络到 Google 有抖动，带 3 次重试）。翻译请求走代理，否则受墙网络直连超时。
    for attempt in range(3):
        try:
            r = requests.get(
                "https://translate.googleapis.com/translate_a/single",
                params={"client": "gtx", "sl": "en", "tl": "zh-CN", "dt": "t", "q": text},
                timeout=15,
                proxies=_PROXIES,
            )
            if r.ok:
                return "".join(part[0] for part in r.json()[0] if part[0])
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    # 兜底：MyMemory（同样走代理）
    try:
        r = requests.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": "en|zh-CN"},
            timeout=15,
            proxies=_PROXIES,
        )
        if r.ok:
            return r.json()["responseData"]["translatedText"]
    except Exception:
        pass
    return None


def translate_video(conn: sqlite3.Connection, video_id: int, start: int = 0, end: int = 10**9, workers: int | None = None) -> tuple[int, int]:
    workers = workers or DEFAULT_WORKERS
    # 多线程共用同一连接：调用方需用 check_same_thread=False 建立连接（见 main() /
    # fetch_video 的 sqlite3.connect），否则 worker 线程调用 conn.execute 会抛
    # ProgrammingError，被下方 as_completed 的 pass 静默吞掉，表现为「翻译 0 句」计数归零。
    # 写操作本身仍由 write_lock 串行化。
    conn.isolation_level = None
    conn.execute("PRAGMA busy_timeout = 60000")  # 并发写等锁而不是报错
    write_lock = threading.Lock()
    counters = {"ok": 0, "fail": 0, "done": 0}

    rows = conn.execute(
        "SELECT id, english_text FROM sentences WHERE video_id = ? AND sentence_index >= ? AND sentence_index < ? AND (chinese_text IS NULL OR chinese_text = '') ORDER BY sentence_index",
        (video_id, start, end),
    ).fetchall()
    total = len(rows)
    if total == 0:
        return 0, 0

    def worker(sid: int, en: str) -> tuple[int, bool]:
        # 网络请求（慢）并发跑；DB 写单独加锁
        zh = translate(en)
        try:
            with write_lock:
                if zh:
                    conn.execute("UPDATE sentences SET chinese_text = ? WHERE id = ?", (zh, sid))
                    # isolation_level=None 已是 autocommit，每次 UPDATE 自动落库，
                    # 切勿再显式 COMMIT（会抛 "cannot commit - no transaction is active"）。
                    counters["ok"] += 1
                else:
                    counters["fail"] += 1
                counters["done"] += 1
                done = counters["done"]
                if done % 25 == 0 or done == total:
                    print(f"  ... 进度 {done}/{total} (ok={counters['ok']})", flush=True)
        except Exception as e:
            with write_lock:
                counters["fail"] += 1
                counters["done"] += 1
            print(f"  [worker error] sid={sid}: {type(e).__name__}: {e}", flush=True)
        time.sleep(0.05)  # 轻微限速，避免免费端点风控
        return sid, bool(zh)

    print(f"并发翻译 video_id={video_id}: {total} 句, workers={workers}", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(worker, sid, en) for sid, en in rows]
        for _ in as_completed(futures):
            pass  # 结果/异常已在 worker 内处理（新增 try/except 已暴露 worker 错误）
    return counters["ok"], counters["fail"]


def main():
    # 用法：python translate_video.py <video_id | all> [起始句index] [结束句index] [workers]
    target = sys.argv[1]
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    end = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
    workers = int(sys.argv[4]) if len(sys.argv) > 4 else None
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    if target == "all":
        video_ids = [r["id"] for r in conn.execute("SELECT id FROM videos")]
    else:
        video_ids = [int(target)]
    for vid in video_ids:
        ok, fail = translate_video(conn, vid, start, end, workers)
        print(f"video_id={vid} [{start},{end}): 翻译 {ok} 句" + (f"，失败 {fail} 句（可重跑补漏）" if fail else ""))
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法：python translate_video.py <video_id | all> [起始句index] [结束句index]")
        sys.exit(1)
    main()
