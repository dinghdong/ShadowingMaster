"""ShadowingMaster API —— 仅做装配：创建 app、挂 CORS/middleware、include routers、startup 初始化。

业务逻辑已拆分到：
- core/   配置·安全·DB 连接
- models/ Pydantic 模型
- routers/ 按资源分文件（auth/videos/progress/wordbook/annotations/media）
- services/ 解析任务等后台编排
"""
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from core.config import (
    CORS_ALLOW_ORIGIN_REGEX,
    CORS_ALLOW_ORIGINS,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_HEADERS,
)
from core.db import init_db
from routers.auth import router as auth_router
from routers.videos import router as videos_router
from routers.progress import router as progress_router
from routers.wordbook import router as wordbook_router
from routers.annotations import router as annotations_router
from routers.media import router as media_router
from routers.dictionary import router as dictionary_router

app = FastAPI(title="ShadowingMaster API")

app.add_middleware(
    CORSMiddleware,
    # 生产前端域名（如 Vercel），由环境变量 CORS_ALLOW_ORIGINS 注入
    allow_origins=CORS_ALLOW_ORIGINS,
    # 开发期放行任意 localhost 端口（Vite 5173 / 预览端口及重映射端口）
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)


# ── Request logging ─────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = datetime.utcnow()
    response = await call_next(request)
    elapsed = (datetime.utcnow() - start).total_seconds() * 1000
    print(f"{request.method} {request.url.path} → {response.status_code} ({elapsed:.1f}ms)")
    return response


# ── Health ──────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Routers ─────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(videos_router)
app.include_router(progress_router)
app.include_router(wordbook_router)
app.include_router(annotations_router)
app.include_router(media_router)
app.include_router(dictionary_router)


# ── Init on startup ─────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
