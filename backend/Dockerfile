# ShadowingMaster 后端镜像
#
# ⚠️ 构建上下文必须是**仓库根目录**，不是 backend/。
# 原因：backend/requirements.txt 里有 `-e ../packages/proxy_auto`（自研零依赖代理探测库，
# fetch_video / translate_video 共用）。以 backend/ 作上下文时，pip 找不到
# ../packages/proxy_auto，直接报
#   ERROR: ../packages/proxy_auto is not a valid editable requirement
# 构建在装依赖那一步就挂掉 —— 而镜像从未被真正构建过（此前 docker build 只在 PR 触发），
# 所以这个问题直到首次部署才会暴露。
#
# 用法（在仓库根目录）：
#   docker build -f backend/Dockerfile -t shadowingmaster-backend .
#   docker run -d --name sm -p 8000:8000 \
#     -v sm-data:/data \
#     --env-file .env \
#     -e DATA_DIR=/data \
#     shadowingmaster-backend
#
# 数据持久化：运行期用 DATA_DIR 把 app.db 与 backend/media 指到同一个挂载卷（见 docker-compose.yml），
# 不要直接挂 /app —— 那会遮挡镜像内的应用代码。
#
# 上下文瘦身见仓库根 .dockerignore（backend/media 本机有近 700MB 媒体文件，必须排除）。

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# ffmpeg 由 yt-dlp 后处理（封面转换）与 ffprobe 时长探测需要
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先落盘 proxy_auto，再 pip install —— requirements.txt 里的相对路径是
# 相对 backend/ 写的（../packages/proxy_auto），落到这里才对得上。
COPY packages/proxy_auto /app/packages/proxy_auto

WORKDIR /app/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
