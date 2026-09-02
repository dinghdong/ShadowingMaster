"""proxy_auto — 自动探测出站代理的小工具库，供爬虫 / API 客户端跨项目复用。

背景
----
ShadowingMaster 的 yt-dlp（抓 YouTube）和翻译脚本（Google 翻译）都踩过同一个坑：
受墙网络下「直连超时」，必须走本机 ClashX/Clash 等代理。两处各自写了一份 macOS
`scutil` 探测代码，逻辑重复。本模块把它们收敛成零第三方依赖的单文件库：

  - 优先级：显式环境变量 > macOS 系统代理(scutil) > 标准 http_proxy/https_proxy
  - 同时提供 requests 的 proxies 字典转换、yt-dlp opts 注入，避免各自再拼一遍

用法
----
    from proxy_auto import detect_proxy_url, to_requests_proxies, apply_to_ytdlp

    # 1) 拿到代理 URL（空串 = 直连）
    url = detect_proxy_url()                # 读 YTDLP_PROXY 环境变量 → 系统代理兜底

    # 2) requests 客户端：直接塞进 proxies=
    requests.get("https://...", timeout=15, proxies=to_requests_proxies(url))

    # 3) yt-dlp 客户端：注入 opts
    opts = apply_to_ytdlp({"quiet": True}, url)

    # 4) 生产环境想钉死某代理，也可显式传 URL（跳过一切探测）：
    detect_proxy_url()                      # 等价于显式 YTDLP_PROXY=http://user:pass@host:port

安装（其他项目）
----------------
    pip install -e ./packages/proxy_auto     # 仓库内路径按需调整；零第三方依赖

常量
----
    DEFAULT_ENV_VAR  探测的环境变量名（默认 YTDLP_PROXY）
    __version__      版本号
"""

from __future__ import annotations

import os
import sys

__version__ = "0.1.0"
DEFAULT_ENV_VAR = "YTDLP_PROXY"

# macOS `scutil --proxy` 输出的键，格式如 "HTTPProxy : 127.0.0.1" / "HTTPPort : 7890"。
_HTTPS_PROXY_RE = None  # 延迟构造，避免非 darwin 平台也无谓编译
_HTTPS_PORT_RE = None


def _detect_macos_system_proxy() -> str:
    """读 macOS 系统代理（ClashX / Clash / Surge 等常监听 127.0.0.1:7890）。

    用 `scutil --proxy` 而非环境变量，是因为沙箱/launchd 常注入过时或空的
    http_proxy，而系统设置里的代理才是用户真实在用的。无代理时返回 ""。
    """
    import re
    import subprocess

    global _HTTPS_PROXY_RE, _HTTPS_PORT_RE
    if _HTTPS_PROXY_RE is None:
        _HTTPS_PROXY_RE = re.compile(r"\s*(HTTPS?Proxy)\s*:\s*(\S+)")
        _HTTPS_PORT_RE = re.compile(r"\s*(HTTPS?Port)\s*:\s*(\d+)")

    try:
        out = subprocess.run(
            ["scutil", "--proxy"], capture_output=True, text=True, timeout=5
        ).stdout
    except Exception:
        return ""

    host = port = None
    for line in out.splitlines():
        m = _HTTPS_PROXY_RE.match(line)
        if m:
            host = m.group(2)
        m = _HTTPS_PORT_RE.match(line)
        if m:
            port = m.group(2)
        # scutil 对未启用项会输出 "HTTPProxy : 0" / "HTTPPort : 0"，跳过
        if host and port and host not in ("0", ""):
            return f"http://{host}:{port}"
    return ""


def _detect_from_env(names: tuple[str, ...]) -> str:
    for name in names:
        val = os.environ.get(name, "").strip()
        if val:
            return val
    return ""


def detect_proxy_url(env_var: str = DEFAULT_ENV_VAR) -> str:
    """探测可用的代理 URL（形如 http://host:port 或 socks5://host:port），无则返回 ""。

    优先级：
      1. 环境变量 env_var（显式配置，生产用它钉死住宅代理；空串/未设则继续探测）
      2. macOS：`scutil --proxy` 读系统设置（ClashX 等）
      3. Linux / Windows / 其它：标准 https_proxy / http_proxy 环境变量
    """
    explicit = os.environ.get(env_var, "").strip()
    if explicit:
        return explicit

    if sys.platform == "darwin":
        mac = _detect_macos_system_proxy()
        if mac:
            return mac

    return _detect_from_env(("https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY"))


def to_requests_proxies(proxy_url: str) -> dict:
    """把代理 URL 转成 `requests` 的 proxies 参数；空串返回 {}（即直连）。

    例：to_requests_proxies("http://127.0.0.1:7890")
        → {"http": "http://127.0.0.1:7890", "https": "http://127.0.0.1:7890"}
    """
    if not proxy_url:
        return {}
    return {"http": proxy_url, "https": proxy_url}


def apply_to_ytdlp(opts: dict, proxy_url: str) -> dict:
    """把代理注入 yt-dlp 的选项 dict（就地修改并返回同一对象）；空串则不动。"""
    if proxy_url:
        opts["proxy"] = proxy_url
    return opts
