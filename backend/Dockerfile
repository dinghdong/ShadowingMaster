# ShadowingMaster 后端镜像
# 用法（在 backend/ 目录）：
#   docker build -t shadowingmaster-backend .
#   docker run -d --name sm -p 8000:8000 \
#     -v $(pwd)/data:/app \
#     --env-file .env \
#     shadowingmaster-backend
# 数据持久化：/app 挂载卷保存 app.db 与 backend/media（OSS 关闭时）

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# ffmpeg 由 yt-dlp 后处理（封面转换）与 ffprobe 时长探测需要
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
