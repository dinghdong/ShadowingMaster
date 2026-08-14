"""全局配置：密钥 / CORS / 媒体目录 / YouTube·邮箱 正则。
集中管理，避免散落在 main.py 顶部；默认值沿用现状，仅搬运。
"""
import os
import re
from pathlib import Path

# ── 鉴权 ────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "shadowingmaster-dev-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# ── CORS：开发期放行任意 localhost 端口；生产通过 CORS_ALLOW_ORIGINS 显式放行前端域名 ──
CORS_ALLOW_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1):\d+"
# 生产前端域名（逗号分隔），如 "https://shadowingmaster.vercel.app"
CORS_ALLOW_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["*"]
CORS_ALLOW_HEADERS = ["*"]

# ── 数据目录（部署用）──
# 生产通过 DATA_DIR 把 app.db 与 media 统一指向挂载卷（如 /data），
# 避免直接挂载 /app 遮挡镜像内的应用代码。未设置时退回到开发期默认路径。
DATA_DIR = os.environ.get("DATA_DIR")

# ── 媒体目录与类型（支持 Range 拖拽）──
# config.py 位于 backend/core/，故 .parent = backend/core，.parent.parent = backend
# → MEDIA_DIR 默认仍是 backend/media，与拆分前一致
MEDIA_DIR = (Path(DATA_DIR) / "media") if DATA_DIR else (Path(__file__).parent.parent / "media")
MEDIA_TYPES = {
    ".mp4": "video/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}

# ── YouTube 链接 ID 解析 ────────────────────────────────────────
YT_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def parse_youtube_id(url: str):
    m = YT_ID_RE.search(url or "")
    return m.group(1) if m else None


# ── 邮箱格式：轻量正则，避免引入 email-validator 新依赖（白名单之外）──
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
