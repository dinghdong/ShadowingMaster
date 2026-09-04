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
is_alinux() { [ -f /etc/alinux-release ] || grep -qi 'alinux' /etc/os-release 2>/dev/null; }
if ! command -v docker >/dev/null 2>&1; then
  echo ">> 安装 Docker"
  if is_alinux; then
    # 阿里云 Linux 是 RHEL8 兼容系，官方 get.docker.com 脚本会报
    # "Unsupported distribution 'alinux'"。直接用 dnf/yum 装发行版自带的 docker。
    PM=$(command -v dnf >/dev/null 2>&1 && echo dnf || echo yum)
    $PM install -y docker
  else
    curl -fsSL https://get.docker.com | sh
  fi
fi
if ! docker compose version >/dev/null 2>&1; then
  echo ">> 安装 compose 插件"
  if is_alinux; then
    PM=$(command -v dnf >/dev/null 2>&1 && echo dnf || echo yum)
    $PM install -y docker-compose-plugin
  else
    apt-get update -y && apt-get install -y docker-compose-plugin
  fi
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
#    阿里云 Linux 默认不带 crontab，缺失时先装 cronie；整条写入用 `|| echo` 兜底，
#    避免 `set -e` 下因 cron 不可用而中断后续（Caddyfile 渲染等）步骤。
if ! command -v crontab >/dev/null 2>&1; then
  echo ">> 安装 cronie"
  if command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    ( command -v dnf >/dev/null 2>&1 && dnf install -y cronie || yum install -y cronie ) 2>&1 | tail -5
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y cron 2>&1 | tail -5
  fi
  systemctl enable --now crond 2>/dev/null || systemctl enable --now cron 2>/dev/null || true
fi
cp "$SCRIPT_DIR/backup.sh" "$INSTALL_DIR/backup.sh"
chmod +x "$INSTALL_DIR/backup.sh"
( crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/backup.sh"; \
  echo "17 4 * * * /bin/bash $INSTALL_DIR/backup.sh >> $INSTALL_DIR/backup.log 2>&1" ) | crontab - \
  || echo "::warning:: crontab 写入失败（非致命，可手动补备份任务）"

# 4) 放行端口
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp 80/tcp 443/tcp || true
fi

# 5) Caddyfile —— 用 --domain 渲染一份初始配置。
#    此前 --domain 只被校验、从不使用，导致引导完成后目录里没有 Caddyfile，
#    而 compose 把它作为只读卷挂给 caddy，缺失时 caddy 起不来。
#    CI 每次部署都会用 Secrets.DEPLOY_DOMAIN 重新渲染覆盖，这里只保证首次可用。
sed "s/DOMAIN/$DOMAIN/g" "$SCRIPT_DIR/../Caddyfile" > "$INSTALL_DIR/Caddyfile"
echo ">> 已写入 Caddyfile（域名 $DOMAIN）"

echo
echo ">> bootstrap 完成。"
echo "   目录 : $INSTALL_DIR"
echo "   域名 : $DOMAIN"
echo
echo "   下一步（在 GitHub 仓库 Settings → Secrets and variables → Actions 配置）："
echo "     VPS_HOST        本机公网 IP"
echo "     VPS_USER        部署用 SSH 账号"
echo "     VPS_SSH_KEY     对应私钥全文"
echo "     DEPLOY_DOMAIN   $DOMAIN"
echo "     BACKEND_ENV     生产 .env 全文（不要含 BACKEND_IMAGE，CI 会写）"
echo
echo "   配好后 push 到 main，deploy.yml 会构建镜像并自动拉起服务。"
echo "   注意：此刻还不能手动 docker compose up —— compose 文件由 CI 投递，"
echo "        且 BACKEND_IMAGE 需指向 GHCR 上已构建的镜像，首次部署必须走 CI。"
