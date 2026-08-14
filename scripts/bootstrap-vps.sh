#!/usr/bin/env bash
set -euo pipefail

# ShadowingMaster —— VPS 初次引导（在目标 VPS 上以 root 运行一次）
#
# 用法：
#   ./scripts/bootstrap-vps.sh --domain api.shadowingmaster.com [--env-file /path/to/prod.env]
#
# 完成四件事：
#   1. 安装 Docker + compose 插件（若缺失）
#   2. 创建 /opt/shadowingmaster，写入 .env（来自 --env-file 或占位模板）
#   3. 安装每日备份 cron（scripts/backup.sh → 阿里云 OSS）
#   4. 放行 80/443（若启用 ufw）
#
# 之后把仓库 push 到 GitHub main 分支，deploy.yml 会自动拉起服务。

DOMAIN=""
ENV_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    --env-file) ENV_FILE="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done
[ -z "$DOMAIN" ] && { echo "ERROR: 必须传 --domain（API 域名，如 api.shadowingmaster.com）" >&2; exit 1; }

INSTALL_DIR=/opt/shadowingmaster
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$INSTALL_DIR"

# 1) Docker
if ! command -v docker >/dev/null 2>&1; then
  echo ">> 安装 Docker"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo ">> 安装 compose 插件"
  apt-get update -y && apt-get install -y docker-compose-plugin
fi

# 2) .env
if [ -n "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$INSTALL_DIR/.env"
  echo ">> 已写入 .env（来自 $ENV_FILE）"
else
  cat > "$INSTALL_DIR/.env" <<'EOF'
# 占位 .env（bootstrap 生成）。CI 部署会用 Secrets.BACKEND_ENV 覆盖；
# 手动维护时至少填：SECRET_KEY / CORS_ALLOW_ORIGINS / OSS_* / YTDLP_PROXY
SECRET_KEY=change-me-to-a-long-random-string
CORS_ALLOW_ORIGINS=https://your-frontend.vercel.app
OSS_ENDPOINT=oss-eu-west-1.aliyuncs.com
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_REGION=eu-west-1
OSS_URL_EXPIRE=3600
YTDLP_PROXY=
EOF
  echo ">> 已写入占位 .env（请尽快补全）"
fi

# 3) 备份 cron（每天 04:17 伦敦时间）
cp "$SCRIPT_DIR/backup.sh" "$INSTALL_DIR/backup.sh"
chmod +x "$INSTALL_DIR/backup.sh"
( crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/backup.sh"; \
  echo "17 4 * * * /bin/bash $INSTALL_DIR/backup.sh >> $INSTALL_DIR/backup.log 2>&1" ) | crontab -

# 4) 放行端口
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp 80/tcp 443/tcp || true
fi

echo ">> bootstrap 完成。"
echo "   目录 : $INSTALL_DIR"
echo "   域名 : $DOMAIN （部署时由 CI 写入 Caddyfile）"
echo "   下一步: git push 到 GitHub main → deploy.yml 自动拉起。"
echo "   手动试跑: cd $INSTALL_DIR && docker compose up -d"
