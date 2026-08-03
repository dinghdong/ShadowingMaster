"""Slice 2 · 视频爬取 CLI：给一个 YouTube URL，下载 + 字幕解析 + 入库一条龙。
用法：python fetch_video.py <youtube_url>
"""
import os
import shutil
import sys

import yt_dlp

from import_video import MEDIA, ingest
from core.oss import OSS_ENABLED, upload_file

# 可选：YouTube 登录态 cookie（Netscape 格式），用于绕过 "confirm you're not a bot" 反爬。
# 通过环境变量 YTDLP_COOKIES_FILE 指定；为空或文件不存在时忽略。
_YTDLP_COOKIES_FILE = os.environ.get("YTDLP_COOKIES_FILE", "")
if _YTDLP_COOKIES_FILE and not os.path.isfile(_YTDLP_COOKIES_FILE):
    _YTDLP_COOKIES_FILE = ""


# 检测 node：yt-dlp 的 n 挑战求解需要 >=23.5 的 JS 运行时；缺失则不强加 js_runtimes
_HAS_NODE = bool(shutil.which("node"))

# 可选：住宅代理（residential proxy），只用于 yt-dlp 的 YouTube 流量。
# 伦敦 SWAS 数据中心 IP 被 YouTube 主动吊销会话 cookie → 必须走住宅 IP 才能被接受。
# 通过环境变量 YTDLP_PROXY 指定，形如 http://user:pass@host:port 或 socks5://host:port；
# 为空时不启用（直连）。注意：必须是「住宅/ISP」代理，数据中心代理同样会被挡。
_YTDLP_PROXY = os.environ.get("YTDLP_PROXY", "").strip()


def _apply_cookies(opts: dict) -> dict:
    """注入 cookie 文件（绕过 YouTube 反爬）、node 运行时（求解 n 挑战签名）、可选住宅代理。

    关键点：
    - 不要强制覆盖 player_client（带 cookie 时指定 ios/tv 常只回图片、无可用格式）。
    - 必须显式开启 js_runtimes={'node':{}}：yt-dlp 默认不实例化任何 JS 运行时，
      否则 n 挑战无法求解 → 只回图片 / "No video formats found"。
    - 伦敦数据中心 IP 会被 YouTube 吊销会话，故可用 YTDLP_PROXY 把 yt-dlp 流量导到住宅 IP。
    """
    if _YTDLP_COOKIES_FILE:
        opts["cookiefile"] = _YTDLP_COOKIES_FILE
    if _HAS_NODE:
        opts.setdefault("js_runtimes", {})["node"] = {}
    if _YTDLP_PROXY:
        opts["proxy"] = _YTDLP_PROXY
    return opts


def _upload_assets(youtube_id: str):
    """把下载产物（视频 + 封面）上传到 OSS。OSS 未启用时跳过。"""
    if not OSS_ENABLED:
        return
    mp4 = MEDIA / f"{youtube_id}.mp4"
    if mp4.exists():
        upload_file(f"/media/{youtube_id}.mp4", str(mp4))
    for ext in ("jpg", "webp", "png"):
        thumb = MEDIA / f"{youtube_id}.{ext}"
        if thumb.exists():
            upload_file(f"/media/{youtube_id}.{ext}", str(thumb))
            break


def fetch(url: str) -> int:
    # 1. 取视频元信息（id / 标题 / 时长）
    with yt_dlp.YoutubeDL(_apply_cookies({"quiet": True, "skip_download": True})) as ydl:
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
        # 住宅代理（台湾 HiNet2）对 googlevideo 大文件 TLS 流偶发重置（SSL UNEXPECTED_EOF）。
        # force_ipv4：服务器无公网 IPv6，强制 v4 避免偶发 v6 边缘；
        # http_chunk_size：把下载切成 10MB 分块 range 请求，单块被重置时仅需重传该块而非整文件；
        # concurrent_fragments=1：顺序分片，减少代理隧道并发连接被掐。
        "force_ipv4": True,
        "http_chunk_size": 10 * 1024 * 1024,
        "concurrent_fragments": 1,
        "quiet": False,
    }
    _apply_cookies(opts)
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    # 3. 解析字幕入库
    video_id = ingest(youtube_id, title, duration, description, tags)

    # 3.5 上传媒体到 OSS（启用时）；失败会让解析任务标记 failed，便于发现配置问题
    _upload_assets(youtube_id)

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
