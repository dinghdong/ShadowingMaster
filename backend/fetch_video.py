"""Slice 2 · 视频爬取 CLI：给一个 YouTube URL，下载 + 字幕解析 + 入库一条龙。
用法：python fetch_video.py <youtube_url>
"""
import shutil
import sys

import yt_dlp

from import_video import MEDIA, ingest


def fetch(url: str) -> int:
    # 1. 取视频元信息（id / 标题 / 时长）
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    youtube_id, title = info["id"], info["title"]
    duration = int(info.get("duration") or 0)
    description = (info.get("description") or "").strip()
    tags = info.get("tags") or []
    print(f"视频：{title} ({youtube_id})")

    # 2. 下载低清 mp4 + 英文自动字幕 + 封面到 media/
    #    ffmpeg 缺失时跳过后处理（封面改产 webp，import_video.ingest 已兼容）；
    #    时长改由 yt-dlp 元信息传入，不再依赖 ffprobe。
    postprocessors = []
    if shutil.which("ffmpeg"):
        postprocessors.append({"key": "FFmpegThumbnailsConvertor", "format": "jpg"})

    opts = {
        "format": "worst[ext=mp4][height<=360]/worst[ext=mp4]/worst",
        "writeautomaticsub": True,
        "subtitleslangs": ["en"],
        "subtitlesformat": "vtt",
        "writethumbnail": True,
        "postprocessors": postprocessors,
        "outtmpl": str(MEDIA / "%(id)s.%(ext)s"),
        "retries": 10,
        "fragment_retries": 10,
        "quiet": False,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    # 3. 解析字幕入库
    video_id = ingest(youtube_id, title, duration, description, tags)

    # 4. 中文字幕（best-effort：翻译失败不阻塞，事后可 python translate_video.py <id> 补跑）
    try:
        from translate_video import translate_video
        import sqlite3
        from import_video import DB_PATH
        conn = sqlite3.connect(str(DB_PATH))
        ok, fail = translate_video(conn, video_id)
        conn.close()
        print(f"中文字幕：翻译 {ok} 句" + (f"，失败 {fail} 句" if fail else ""))
    except Exception as e:
        print(f"中文字幕翻译跳过（{e}），可事后补跑：python translate_video.py {video_id}")

    return video_id


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法：python fetch_video.py <youtube_url>")
        sys.exit(1)
    fetch(sys.argv[1])
