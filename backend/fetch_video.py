"""Slice 2 · 视频爬取 CLI：给一个 YouTube URL，下载 + 字幕解析 + 入库一条龙。
用法：python fetch_video.py <youtube_url>
"""
import os
import shutil
import sys
from pathlib import Path

import yt_dlp

from import_video import MEDIA, ingest
from core.oss import OSS_ENABLED, upload_file

# 可选：YouTube 登录态 cookie（Netscape 格式），用于绕过 "confirm you're not a bot" 反爬。
# 通过环境变量 YTDLP_COOKIES_FILE 指定；为空或文件不存在时忽略。
_YTDLP_COOKIES_FILE = os.environ.get("YTDLP_COOKIES_FILE", "")
if _YTDLP_COOKIES_FILE and not os.path.isfile(_YTDLP_COOKIES_FILE):
    _YTDLP_COOKIES_FILE = ""

# 本地调试兜底：未配置 cookie 文件时，自动尝试从本机浏览器读取完整 cookie 库
# （含 httpOnly 反爬 cookie，JS 扩展导出的文件常缺失 → 仍被判 bot）。
# 默认 chrome；可用 YTDLP_COOKIES_BROWSER 覆盖（firefox/edge/safari/brave）；
# 设为 "off" 可关闭本兜底。生产服务器配置 YTDLP_COOKIES_FILE 后此分支不触发。
_YTDLP_COOKIES_BROWSER = os.environ.get("YTDLP_COOKIES_BROWSER", "chrome").strip().lower()
if _YTDLP_COOKIES_BROWSER in ("", "off", "no", "false", "0"):
    _YTDLP_COOKIES_BROWSER = ""


# 检测 node：yt-dlp 的 n 挑战求解需要 >=23.5 的 JS 运行时；缺失则不强加 js_runtimes
_HAS_NODE = bool(shutil.which("node"))

# 检测 ffmpeg：Homebrew/系统常见路径通常不在 venv 的 PATH 内，需显式定位。
# yt-dlp 在 ffmpeg 可用时，会用 ffmpeg 把 HLS(m3u8) 直接下载/混流成「单个文件」，
# 避免 yt-dlp 原生分片下载产生上百个 .part-FragN 临时文件 ——
# 那些分片清理时会触发本机沙箱的安全删除批量确认而被强杀（SAFE_DELETE_BULK_CONFIRM_REQUIRED）。
def _find_ffmpeg() -> str:
    candidates = [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return shutil.which("ffmpeg") or ""


_FFMPEG_BIN = _find_ffmpeg()

# 可选：住宅代理（residential proxy），只用于 yt-dlp 的 YouTube 流量。
# 伦敦 SWAS 数据中心 IP 被 YouTube 主动吊销会话 cookie → 必须走住宅 IP 才能被接受。
# 通过环境变量 YTDLP_PROXY 指定，形如 http://user:pass@host:port 或 socks5://host:port；
# 为空时不启用（直连）。注意：必须是「住宅/ISP」代理，数据中心代理同样会被挡。
_YTDLP_ENVCANDIDATES = os.environ.get("YTDLP_PROXY", "").strip()

# 本地开发兜底：未显式配置 YTDLP_PROXY 时，自动探测本机系统代理
# （macOS 上 ClashX/Clash 等常监听 7890，直连 YouTube 会被墙超时 → 必须走代理）。
# 仅当 YTDLP_PROXY 为空才触发；生产显式设了 YTDLP_PROXY 则跳过。
def _detect_system_proxy() -> str:
    if _YTDLP_ENVCANDIDATES:
        return _YTDLP_ENVCANDIDATES
    # macOS：scutil --proxy 读系统代理（避免误用沙箱注入的 http_proxy）
    if sys.platform == "darwin":
        import subprocess
        try:
            out = subprocess.run(
                ["scutil", "--proxy"], capture_output=True, text=True, timeout=5
            ).stdout
            import re
            host = port = None
            for line in out.splitlines():
                m = re.match(r"\s*(HTTPS?Proxy)\s*:\s*(\S+)", line)
                if m:
                    host = m.group(2)
                m = re.match(r"\s*(HTTPS?Port)\s*:\s*(\d+)", line)
                if m:
                    port = m.group(2)
                if host and port and host not in ("0", ""):
                    return f"http://{host}:{port}"
        except Exception:
            pass
    return ""


_YTDLP_PROXY = _detect_system_proxy()


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
    elif _YTDLP_COOKIES_BROWSER:
        # 兜底：直接读浏览器本地 cookie 库（含 httpOnly 反爬 cookie）。
        # macOS 上首次会弹钥匙串授权，允许后即可；无浏览器/拒绝授权时 yt-dlp 会报错，
        # 此时可设 YTDLP_COOKIES_BROWSER=off 退回无 cookie 模式。
        opts["cookiesfrombrowser"] = (_YTDLP_COOKIES_BROWSER,)
    if _HAS_NODE:
        opts.setdefault("js_runtimes", {})["node"] = {}
    if _YTDLP_PROXY:
        opts["proxy"] = _YTDLP_PROXY
    if _FFMPEG_BIN:
        # 所有 YoutubeDL 实例都告知 ffmpeg 路径（venv 的 PATH 里通常没有 Homebrew 的 bin），
        # 否则连 extract_info 阶段都会刷 "ffmpeg not found" 告警并可能降级格式选择。
        opts["ffmpeg_location"] = _FFMPEG_BIN
    # 启用 ejs 远程挑战求解脚本：YouTube 现要求解 n 参数签名挑战，否则只回图片格式
    # → "Requested format is not available" / "Only images are available"。该脚本首次需联网
    # 从 GitHub(yt-dlp-ejs) 拉取并缓存到本地，之后离线可用。与登录态/cookie 无关，是独立反爬。
    opts["remote_components"] = ["ejs:github"]
    return opts


def _build_format_selector() -> str:
    """构造格式选择串：**始终优先渐进式 HTTPS mp4**，绝不落到 HLS。

    背景（踩过的坑）：
    旧串以 `worst[...]` 开头，而 `worst` 是按「码率/体积从小到大」排序取第一个 ——
    YouTube 返回的 HLS(m3u8) 格式（如 format 91，protocol=m3u8_native）体积标注极小，
    于是永远赢过渐进式 mp4 format 18，导致每次都走 HLS 分片下载：
      - 产生上百个 .part-FragN 临时分片，清理时触发本机沙箱批量删除确认而被强杀；
      - 分片经代理时极易 `Connection reset by peer`，13 分钟视频跑 4 分钟只到 25%。
    实测该视频同时提供 format 18（progressive mp4 360p 音视频已混流，44MB 单文件），
    直连单文件下载既无分片、又能断点续传，稳定性远高于 147 个分片。

    选择顺序：
      1. protocol=https 且 acodec!=none 的渐进式 mp4（音视频已混流，免 ffmpeg 合并），取 <=480p 里最好的；
      2. 放宽到任意分辨率的渐进式 mp4；
      3. 有 ffmpeg 时才允许 分离视频轨+音频轨 自行合并（仍是 https 单文件，非 HLS）；
      4. 最后才兜底 best（可能是 HLS，仅当该视频确实没有渐进式格式）。
    """
    parts = [
        # 1) 渐进式 mp4（单文件、已混流），限 https 协议排除 m3u8
        "best[ext=mp4][protocol=https][acodec!=none][vcodec!=none][height<=480]",
        # 2) 放宽分辨率
        "best[ext=mp4][protocol=https][acodec!=none][vcodec!=none]",
        # 3) 任意容器的渐进式
        "best[protocol=https][acodec!=none][vcodec!=none]",
    ]
    if _FFMPEG_BIN:
        # 有 ffmpeg 才做分轨合并；两路都强制 https，避免退回 HLS 分片
        parts.append(
            "bestvideo[ext=mp4][protocol=https][height<=480]+bestaudio[ext=m4a][protocol=https]"
        )
        parts.append("bestvideo[protocol=https][height<=480]+bestaudio[protocol=https]")
    # 4) 最终兜底（可能落到 HLS，仅在无渐进式格式时触发）
    parts.append("best")
    return "/".join(parts)


def _pick_english_langs(info: dict) -> list:
    """从 extract_info 结果里挑出真实可下载的英文语言代码，兼顾自动/手动字幕。
    YouTube 自动字幕的 key 并不固定：常见有 en / en-US / en-GB，也有 en-en-US（"English from
    English (United States)"）等。硬编码请求某一组会漏掉其余，触发「no subtitles」。这里直接
    读视频实际提供的 key，避免对语言代码做假设。
    优先顺序：en > en-US > en-GB > 其余 en-*（自动/手动去重合并）。"""
    auto = info.get("automatic_captions") or {}
    manual = info.get("subtitles") or {}
    en_auto = sorted(k for k in auto if k.startswith("en"))
    en_manual = sorted(k for k in manual if k.startswith("en"))

    pref = ["en", "en-US", "en-GB"]
    chosen: list = []
    for k in pref:
        if k in auto or k in manual:
            chosen.append(k)
    for k in en_auto + en_manual:
        if k not in chosen:
            chosen.append(k)
    return chosen


def _resolve_english_vtt(youtube_id: str) -> Path:
    """yt-dlp 按请求的 lang 写文件名，但 YouTube 自动字幕可能只有 en-US/en-GB 等变体。
    下载后若预期的 {id}.en.vtt 不存在，则把任意 en-*.vtt 复制为 .en.vtt，供 ingest 消费。
    找不到任何英文字幕时抛明确错误，避免 import_video.ingest 的断言信息太晦涩。
    """
    expected = MEDIA / f"{youtube_id}.en.vtt"
    if expected.exists():
        return expected

    candidates = sorted(MEDIA.glob(f"{youtube_id}.en*.vtt"))
    if not candidates:
        # yt-dlp 也可能写成 {id}.{title}.en.vtt（旧模板）或 .live_chat.json，这里只处理 vtt
        candidates = sorted(MEDIA.glob(f"{youtube_id}*.en*.vtt"))
    if candidates:
        chosen = candidates[0]
        print(f"字幕变体：预期 {expected.name} 不存在，使用 {chosen.name}")
        chosen.rename(expected)
        return expected

    raise FileNotFoundError(
        f"未找到 {youtube_id} 的英文字幕文件（已查找 {MEDIA / (youtube_id + '.en*.vtt')}）。"
        "该视频可能没有英文自动字幕，或字幕语言不是 en/en-US/en-GB。"
    )


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
    # 1. 取视频元信息（id / 标题 / 时长）。这里也带 writeautomaticsub/listsubtitles，
    #    否则 extract_info 不会完整填充 automatic_captions（只有真实可下载的英文 key 才会
    #    出现，例如 en-en-US），导致下方 _pick_english_langs 漏读语言代码。
    with yt_dlp.YoutubeDL(_apply_cookies({
        "quiet": True,
        "skip_download": True,
        "writeautomaticsub": True,
        "listsubtitles": True,
    })) as ydl:
        info = ydl.extract_info(url, download=False)
    youtube_id, title = info["id"], info["title"]
    duration = int(info.get("duration") or 0)
    description = (info.get("description") or "").strip()
    tags = info.get("tags") or []
    print(f"视频：{title} ({youtube_id})")

    # 1.5 先确认有可下载的英文字幕（key 可能是 en / en-US / en-GB / en-en-US 等），
    # 没有就提前报错，避免白下载几十 MB 视频。
    en_langs = _pick_english_langs(info)
    if not en_langs:
        raise ValueError(
            f"视频 {youtube_id} 没有可用的英文字幕（自动/手动字幕均未提供 en* 语言）。"
        )
    print(f"英文字幕语言：{', '.join(en_langs)}")

    # 2. 下载低清 mp4 + 英文自动字幕 + 封面到 media/
    #    ffmpeg 缺失时跳过后处理（封面改产 webp，import_video.ingest 已兼容）；
    #    时长改由 yt-dlp 元信息传入，不再依赖 ffprobe。
    postprocessors = []
    if _FFMPEG_BIN:
        postprocessors.append({"key": "FFmpegThumbnailsConvertor", "format": "jpg"})

    opts = {
        "format": _build_format_selector(),
        "writeautomaticsub": True,
        # 直接用视频实际提供的英文 key（见 _pick_english_langs），避免硬编码漏掉 en-en-US 等变体；
        # 后续 _resolve_english_vtt 会挑一个 en*.vtt 重命名为 {id}.en.vtt。
        "subtitleslangs": en_langs,
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
    if _FFMPEG_BIN:
        # 显式指定 ffmpeg 路径：保证 HLS 经 ffmpeg 单文件下载，规避沙箱批量删除强杀。
        opts["ffmpeg_location"] = _FFMPEG_BIN
    _apply_cookies(opts)
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    # 2.5 校验产物：视频必须存在；英文字幕可能是 en-US/en-GB 等变体，归一化为 {id}.en.vtt
    mp4_path = MEDIA / f"{youtube_id}.mp4"
    if not mp4_path.exists():
        raise FileNotFoundError(
            f"yt-dlp 未成功下载 {youtube_id} 的视频文件（{mp4_path} 不存在）。"
            "可能是该视频受限、无可用格式或代理/网络异常，请检查后端日志。"
        )
    _resolve_english_vtt(youtube_id)

    # 3. 解析字幕入库
    video_id = ingest(youtube_id, title, duration, description, tags)

    # 3.5 上传媒体到 OSS（启用时）；失败会让解析任务标记 failed，便于发现配置问题
    _upload_assets(youtube_id)

    # 4. 中文字幕（best-effort：翻译失败不阻塞，事后可 python translate_video.py <id> 补跑）
    try:
        from translate_video import translate_video
        import sqlite3
        from import_video import DB_PATH
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
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
