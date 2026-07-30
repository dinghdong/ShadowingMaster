"""Slice 2 · 视频爬取 CLI：给一个 YouTube URL，下载 + 字幕解析 + 入库一条龙。
用法：python fetch_video.py <youtube_url>
"""
import sys

import yt_dlp

from import_video import MEDIA, ingest


def fetch(url: str) -> int:
    # 1. 取视频元信息（id / 标题）
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    youtube_id, title = info["id"], info["title"]
    print(f"视频：{title} ({youtube_id})")

    # 2. 下载低清 mp4 + 英文自动字幕 + 封面到 media/
    opts = {
        "format": "worst[ext=mp4][height<=360]/worst[ext=mp4]/worst",
        "writeautomaticsub": True,
        "subtitleslangs": ["en"],
        "subtitlesformat": "vtt",
        "writethumbnail": True,
        "postprocessors": [{"key": "FFmpegThumbnailsConvertor", "format": "jpg"}],
        "outtmpl": str(MEDIA / "%(id)s.%(ext)s"),
        "retries": 10,
        "fragment_retries": 10,
        "quiet": False,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    # 3. 解析字幕入库
    return ingest(youtube_id, title)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法：python fetch_video.py <youtube_url>")
        sys.exit(1)
    fetch(sys.argv[1])
