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

# ----------------------------------------------------------------------------
# 诊断日志：把 yt-dlp 实际用的代理 / cookies / 请求 URL / HTTP 状态码 打到服务端，
# 方便排查「HTTP 429 / 限流 / 代理没生效」等问题（而不是靠猜）。
# 默认 INFO（足够看到 429 ERROR 行 + 诊断摘要）；设 YTDLP_DEBUG=1 升到 DEBUG，
# 连 yt-dlp 的 verbose 请求 URL 也一并输出。
# ----------------------------------------------------------------------------
import logging

logger = logging.getLogger("fetch_video")
if not logger.handlers:
    _h = logging.StreamHandler(sys.stderr)
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)
_YTDLP_DEBUG = os.environ.get("YTDLP_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")
if _YTDLP_DEBUG:
    logger.setLevel(logging.DEBUG)


class _YtDlpLogger:
    """把 yt-dlp 的 debug/info/warning/error 回调转发到标准 logging。

    yt-dlp 的 `ERROR: ... HTTP Error 429 ...` 这类信息会经 error() 传给 logging，
    直接在服务端日志里可见；DEBUG 模式下还能看到它实际请求的 URL。
    """

    @staticmethod
    def _fwd(level, msg):
        s = (msg or "").strip()
        if s:
            logger.log(level, "[ydl] %s", s)

    def debug(self, msg):
        if _YTDLP_DEBUG:
            self._fwd(logging.DEBUG, msg)

    def info(self, msg):
        self._fwd(logging.INFO, msg)

    def warning(self, msg):
        self._fwd(logging.WARNING, msg)

    def error(self, msg):
        self._fwd(logging.ERROR, msg)

    def critical(self, msg):
        self._fwd(logging.CRITICAL, msg)


_ytdlp_logger = _YtDlpLogger()


def _log_diag(youtube_id: str, title: str, en_langs: list, url: str):
    """下载前的诊断摘要：把【代理 / cookies / ffmpeg / node / 格式 / 字幕语言】一次性打印，
    配合下方 try/except 捕获的 429 URL，即可判断限流到底发生在哪个阶段、是否走了代理。"""
    logger.info("=== fetch 诊断开始: %s (%s) ===", title, youtube_id)
    logger.info("请求 URL: %s", url)
    logger.info("proxy=%r (来源: %s)", _YTDLP_PROXY,
                "环境变量 YTDLP_PROXY" if _YTDLP_ENVCANDIDATES else "scutil 系统代理兜底")
    logger.info("cookies_file=%r cookies_browser=%r", _YTDLP_COOKIES_FILE, _YTDLP_COOKIES_BROWSER)
    logger.info("ffmpeg=%r js_runtime=%r", _FFMPEG_BIN, _JS_RUNTIME)
    logger.info("yt_dlp=%s curl_cffi_impersonation=%s", yt_dlp.version.__version__, _HAS_IMPERSONATION)
    logger.info("player_client=%r fallback=%s", _PLAYER_CLIENT, _FALLBACK_CLIENTS)
    logger.info("format_selector=%s", _build_format_selector())
    logger.info("en_langs(字幕)=%s", en_langs)


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


# 检测 JS 运行时：yt-dlp 解 YouTube 的 n 挑战签名必须有一个（node >=23.5 / deno / bun）。
# 缺失时 YouTube 只返回图片格式或媒体 URL 直接 403 —— 这是「unable to download video data:
# HTTP Error 403」最常见的根因之一，所以这里把探测面放宽到 deno/bun 而不只认 node，
# 并在全部缺失时启动即告警（而不是等下载失败才被发现）。
def _find_js_runtime() -> str:
    for name in ("node", "deno", "bun"):
        p = shutil.which(name)
        if p:
            return name
    return ""


_HAS_NODE = bool(shutil.which("node"))
_JS_RUNTIME = _find_js_runtime()


def _has_impersonation() -> bool:
    """curl_cffi 是否真的可用（yt-dlp 靠它做 TLS 指纹伪装）。

    没有伪装时 YouTube CDN 常对媒体流直接返回 403 Forbidden。注意版本兼容：
    yt-dlp 只接受 curl_cffi 0.10.x~0.15.x，装到 0.16+ 会被**静默拒绝**
    （--list-impersonate-targets 全显示 (unavailable)），看起来装了其实没生效。
    """
    try:
        from yt_dlp.dependencies import curl_cffi  # noqa: F401
        return True
    except Exception:
        return False


_HAS_IMPERSONATION = _has_impersonation()

if not _JS_RUNTIME:
    logger.warning(
        "未检测到任何 JS 运行时（node/deno/bun）：YouTube 的 n 挑战签名无法求解，"
        "视频下载极可能以 403 Forbidden 失败。请在服务器上安装其一。"
    )
if not _HAS_IMPERSONATION:
    logger.warning(
        "curl_cffi 不可用或版本不兼容（yt-dlp 仅支持 0.10.x~0.15.x，0.16+ 会被静默拒绝）："
        "缺少 TLS 指纹伪装时 YouTube CDN 常对媒体流返回 403 Forbidden。"
    )

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
# 未显式配置时自动探测本机代理（macOS ClashX 系统代理 / 标准 http(s)_proxy），
# 探测逻辑收敛在可复用的零依赖库 proxy_auto（packages/proxy_auto）。
from proxy_auto import detect_proxy_url

_YTDLP_ENVCANDIDATES = os.environ.get("YTDLP_PROXY", "").strip()  # 仅诊断用：是否显式配置
_YTDLP_PROXY = detect_proxy_url("YTDLP_PROXY")

# YouTube 播放器客户端（player_client）。2026-08 起 YouTube 对媒体流（googlevideo.com）
# 大幅收紧：默认客户端（android_vr / web / tv）在数据中心出口 IP 上一律返回
# "HTTP Error 403: Forbidden"（web/tv 还会直接要求 "Sign in to confirm you're not a bot"），
# 因为这几个客户端现在强制要求 PO token（Proof of Origin），而生成 PO token 需要干净的
# 住宅 IP 或额外的 bgutil provider 服务。
# 实测可用的是 **web_embedded**（嵌入式网页播放器）：不要求 PO token，且格式/字幕齐全。
# 它只提供 <=720p 的渐进式 mp4 —— 本应用只用到 <=480p，完全够用。
# 若将来该客户端也被封，可用环境变量 YTDLP_PLAYER_CLIENT 覆盖，无需改代码。
_PLAYER_CLIENT = os.environ.get("YTDLP_PLAYER_CLIENT", "web_embedded").strip()
# 主客户端失败时的降级顺序（逐个重试，任一成功即止）。空串表示用 yt-dlp 默认客户端列表。
_FALLBACK_CLIENTS = [
    c.strip()
    for c in os.environ.get("YTDLP_FALLBACK_CLIENTS", "tv_embedded,web,").split(",")
    if c.strip()
]


def _with_player_client(opts: dict, client: str) -> dict:
    """把 player_client 写进 extractor_args，且不影响其它 extractor 参数。"""
    if client:
        opts.setdefault("extractor_args", {}).setdefault("youtube", {})["player_client"] = [client]
    return opts


def _apply_cookies(opts: dict) -> dict:
    """注入 cookie 文件（绕过 YouTube 反爬）、node 运行时（求解 n 挑战签名）、可选住宅代理。

    关键点：
    - 必须指定 player_client（默认 web_embedded）：默认客户端在数据中心出口 IP 上被
      YouTube 强制索要 PO token → 媒体流 403。详见上方 _PLAYER_CLIENT 注释。
      注：ios/tv 这类客户端带 cookie 时可能只回图片格式，故不用它们做主客户端。
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
    if _JS_RUNTIME:
        # 用实际探测到的运行时（node/deno/bun），而不是写死 node：
        # 服务器上常常只装了其中一个，写死会导致挑战求解器整体缺席 → 媒体 URL 403。
        opts.setdefault("js_runtimes", {})[_JS_RUNTIME] = {}
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
    # 指定播放器客户端（见上方 _PLAYER_CLIENT 注释）：403 的根因在这一层，必须显式指定。
    _with_player_client(opts, _PLAYER_CLIENT)
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
    优先顺序：en > en-orig > en-US > en-GB > en-en* > 其余 en-*。

    只返回 1 个 key：TED 之类的视频会同时提供 en-ar / en-es / en-ja 等十几条「英文轨的
    他语言翻译」，它们都以 en 开头，全下会白拉十几个文件并显著提高 429 风险；而且它们
    最终都会被 _resolve_english_vtt 归一化成同一个 {id}.en.vtt 互相覆盖，毫无意义。"""
    auto = info.get("automatic_captions") or {}
    manual = info.get("subtitles") or {}
    # 手动字幕（人工校对，带标点）优先于自动字幕
    keys_manual = sorted(k for k in manual if k.startswith("en"))
    keys_auto = sorted(k for k in auto if k.startswith("en"))

    pref = ["en", "en-orig", "en-US", "en-GB"]
    for group in (keys_manual, keys_auto):
        if not group:
            continue
        for k in pref:
            if k in group:
                return [k]
        # 无标准 key 时优先 en-en*（"English from English"，仍是英文原文轨），
        # 再退到该组第一个，避免误取 en-<其他语言> 翻译轨。
        for k in group:
            if k.startswith("en-en"):
                return [k]
        return [group[0]]
    return []


def _pick_chinese_langs(info: dict) -> list:
    """挑中文译文轨（YouTube 自动翻译字幕），简体优先；没有则返回空列表。

    只取一个语言：多份中文字幕会互相覆盖同一个 {id}.zh.vtt 文件名。
    取不到不是错误 —— 交给 translate_video 走机器翻译补漏。
    """
    auto = info.get("automatic_captions") or {}
    manual = info.get("subtitles") or {}
    keys = {k for k in list(auto) + list(manual) if k.startswith("zh")}
    if not keys:
        return []
    pref = ["zh-Hans", "zh-CN", "zh-Hans-en", "zh", "zh-Hant", "zh-TW", "zh-HK"]
    chosen = [k for k in pref if k in keys]
    for k in sorted(keys):
        if k not in chosen:
            chosen.append(k)
    return chosen[:1]


def _resolve_chinese_vtt(youtube_id: str):
    """把任意 zh*.vtt 归一化为 {id}.zh.vtt 供 ingest 消费；没有中文轨时返回 None。"""
    expected = MEDIA / f"{youtube_id}.zh.vtt"
    if expected.exists():
        return expected
    cands = sorted(MEDIA.glob(f"{youtube_id}.zh*.vtt"))
    if not cands:
        cands = sorted(MEDIA.glob(f"{youtube_id}*.zh*.vtt"))
    if not cands:
        return None
    src = cands[0]
    src.rename(expected)
    print(f"中文字幕轨：{src.name} → {expected.name}")
    return expected


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
    try:
        with yt_dlp.YoutubeDL(_apply_cookies({
            "quiet": True,
            "skip_download": True,
            "writeautomaticsub": True,
            "listsubtitles": True,
            "logger": _ytdlp_logger,
        })) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        logger.error("=== extract_info 失败 ===")
        logger.error("请求 URL: %s", getattr(e, "url", None))
        logger.error("错误信息: %s", getattr(e, "msg", str(e)))
        logger.debug("extract_info traceback", exc_info=True)
        raise
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
    # 中文译文轨：YouTube 官方翻译字幕（zh-Hans 等）。取不到则留空，由机器翻译补漏。
    zh_langs = _pick_chinese_langs(info)
    print(f"中文字幕语言：{', '.join(zh_langs) if zh_langs else '（无，将走机器翻译）'}")
    _log_diag(youtube_id, title, en_langs, url)

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
        # 只在主流程下英文轨。中文译文轨走后面的独立 best-effort 请求，
        # 因为字幕下载失败（如 429）会让整个 YoutubeDL.download 抛 DownloadError，
        # 混在一起会把「拿不到中文」升级成「整个视频解析失败」。
        "subtitleslangs": en_langs,
        "writesubtitles": True,  # 人工字幕（subtitles）也要，仅 writeautomaticsub 覆盖不到
        "subtitlesformat": "vtt",
        "writethumbnail": True,
        "postprocessors": postprocessors,
        "outtmpl": str(MEDIA / "%(id)s.%(ext)s"),
        "retries": 10,
        "fragment_retries": 10,
        "logger": _ytdlp_logger,
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

    # 依次尝试播放器客户端：主客户端 → 降级列表，任一成功即止。
    # 原因：YouTube 会按 IP 段/时间窗口对某个 client 单独收紧（403 / bot 验证），
    # 硬编码单个客户端迟早失效；自动降级能把「线上突然全量解析失败」降级为「慢一点」。
    _clients = [_PLAYER_CLIENT] + _FALLBACK_CLIENTS
    last_err = None
    for _i, _client in enumerate(_clients):
        _with_player_client(opts, _client)
        if _i:
            logger.warning(
                "播放器客户端降级重试 %d/%d：%r", _i, len(_clients) - 1, _client or "(yt-dlp 默认)"
            )
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            last_err = None
            break
        except yt_dlp.utils.DownloadError as e:
            last_err = e
            logger.error("=== yt-dlp 下载失败（客户端=%r）===", _client or "(yt-dlp 默认)")
            logger.error("失败请求 URL: %s", getattr(e, "url", None))
            logger.error("错误信息: %s", getattr(e, "msg", str(e)))
            logger.debug("下载 traceback", exc_info=True)

    if last_err is not None:
        e = last_err
        # 把可读原因回传前端（去掉 ANSI 颜色），而不是裸抛 yt-dlp 的彩色堆栈
        reason_msg = getattr(e, "msg", None) or str(e)
        import re
        reason = re.sub(r"\x1b\[[0-9;]*m", "", str(reason_msg))[:300]

        # 403 专项提示：这是线上最高频的失败，且成因集中在 3 个环境项上，
        # 直接把当前缺失的那项点出来，省掉一轮人工排查。
        if "403" in str(reason_msg):
            tried = "、".join(c or "(默认)" for c in _clients)
            logger.error(
                "HTTP 403 排查（已试客户端: %s）：proxy=%r js_runtime=%r impersonation=%s。"
                "最常见根因是出口 IP 被 YouTube 判定为数据中心并要求 PO token —— "
                "可切换代理节点，或用 YTDLP_PLAYER_CLIENT 换客户端。",
                tried, _YTDLP_PROXY, _JS_RUNTIME, _HAS_IMPERSONATION,
            )
        raise RuntimeError(f"下载失败（{reason}）") from e

    # 2.5 校验产物：视频必须存在；英文字幕可能是 en-US/en-GB 等变体，归一化为 {id}.en.vtt
    mp4_path = MEDIA / f"{youtube_id}.mp4"
    if not mp4_path.exists():
        raise FileNotFoundError(
            f"yt-dlp 未成功下载 {youtube_id} 的视频文件（{mp4_path} 不存在）。"
            "可能是该视频受限、无可用格式或代理/网络异常，请检查后端日志。"
        )
    _resolve_english_vtt(youtube_id)

    # 2.6 中文译文轨（独立 best-effort）：官方译文无限流、质量优于免费机翻、时间轴与英文同源。
    #     单独发一次 skip_download 请求，失败只是少一份译文，绝不影响已下好的视频/英文字幕。
    if zh_langs:
        sub_opts = dict(opts)
        sub_opts.update({
            "skip_download": True,
            "writethumbnail": False,
            "postprocessors": [],
            "subtitleslangs": zh_langs,
            "retries": 3,
        })
        try:
            with yt_dlp.YoutubeDL(sub_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            logger.warning("中文译文轨下载失败（%s），将由机器翻译补漏", type(e).__name__)
    # 归一化为 {id}.zh.vtt；ingest 会自动检测并按时间轴对齐填入 chinese_text。
    zh_vtt = _resolve_chinese_vtt(youtube_id)
    print(f"中文字幕文件：{zh_vtt.name if zh_vtt else '（无，全部走机器翻译）'}")

    # 3. 解析字幕入库
    video_id = ingest(youtube_id, title, duration, description, tags)

    # 3.5 上传媒体到 OSS（启用时）；失败会让解析任务标记 failed，便于发现配置问题
    _upload_assets(youtube_id)

    # 4. 机器翻译补漏：只处理 chinese_text 仍为空的句子（YouTube 官方译文轨已填的会跳过）。
    #    best-effort：免费端点限流/失败不阻塞入库，事后可 python translate_video.py <id> 补跑。
    try:
        from translate_video import translate_video
        import sqlite3
        from import_video import DB_PATH
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        missing = conn.execute(
            "SELECT COUNT(*) FROM sentences WHERE video_id=? AND (chinese_text IS NULL OR chinese_text='')",
            (video_id,),
        ).fetchone()[0]
        if missing:
            print(f"中文字幕：官方译文轨未覆盖 {missing} 句，走机器翻译补漏")
            ok, fail = translate_video(conn, video_id)
            print(f"中文字幕：补译 {ok} 句" + (f"，失败 {fail} 句" if fail else ""))
        else:
            print("中文字幕：官方译文轨已全覆盖，跳过机器翻译")
        conn.close()
    except Exception as e:
        print(f"中文字幕翻译跳过（{e}），可事后补跑：python translate_video.py {video_id}")

    return video_id


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法：python fetch_video.py <youtube_url>")
        sys.exit(1)
    fetch(sys.argv[1])
