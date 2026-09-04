#!/usr/bin/env bash
set -euo pipefail

# ShadowingMaster —— VPS 初次引导（在目标 VPS 上以 root 运行一次）
#
# 用法：
#   ./scripts/bootstrap-vps.sh --domain api.shadowingmaster.genisource.studio
#
# 生产架构：systemd 直跑，不是容器。本脚本只负责把「运行环境」就位：
#   1. 确保运行用户 shadowing 与 /opt/shadowing 存在
#   2. 安装 systemd 单元 shadowing.service（若仓库带 deploy/shadowing.service 则用它；
#      否则校验 /etc/systemd/system/shadowing.service 已存在，缺失则告警）
#   3. 安装每日备份 cron（scripts/backup.sh → 阿里云 OSS）
#   4. 放行 22/80/443
#
# 代码本身由 deploy.yml（rsync + systemctl restart）负责，本脚本不碰代码、不碰 .env。
# Caddy 已在 /etc/caddy/Caddyfile 反代 localhost:8000，本脚本也不管它。
# （Docker 此前装过但生产不用，保留无害；新机器无需再装。）

DOMAIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done
[ -z "$DOMAIN" ] && { echo "ERROR: 必须传 --domain（API 域名，如 api.shadowingmaster.genisource.studio）" >&2; exit 1; }

INSTALL_DIR=/opt/shadowing
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1) 运行用户 + 目录
if ! id shadowing >/dev/null 2>&1; then
  echo ">> 创建运行用户 shadowing"
  useradd -r -s /usr/sbin/nologin -d "$INSTALL_DIR" shadowing
fi
mkdir -p "$INSTALL_DIR"
chown shadowing:shadowing "$INSTALL_DIR"

# 2) systemd 单元
if [ -f "$SCRIPT_DIR/../deploy/shadowing.service" ]; then
  echo ">> 安装 systemd 单元（来自仓库 deploy/shadowing.service）"
  cp "$SCRIPT_DIR/../deploy/shadowing.service" /etc/systemd/system/shadowing.service
  systemctl daemon-reload
  systemctl enable shadowing
elif [ -f /etc/systemd/system/shadowing.service ]; then
  echo ">> systemd 单元已存在（/etc/systemd/system/shadowing.service），跳过"
else
  echo "::warning:: 仓库未带 deploy/shadowing.service 且 /etc/systemd/system/shadowing.service 不存在，请手动放置单元文件"
fi

# 3) 备份 cron（每天 04:17 伦敦时间）
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
chown shadowing:shadowing "$INSTALL_DIR/backup.sh"
( crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/backup.sh"; \
  echo "17 4 * * * /bin/bash $INSTALL_DIR/backup.sh >> $INSTALL_DIR/backup.log 2>&1" ) | crontab - \
  || echo "::warning:: crontab 写入失败（非致命，可手动补备份任务）"

# 4) 放行端口
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp 80/tcp 443/tcp || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http --add-service=https --add-service=ssh 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
fi

echo
echo ">> bootstrap 完成（仅运行环境；代码由 deploy.yml 部署）。"
echo "   目录 : $INSTALL_DIR"
echo "   域名 : $DOMAIN"
echo "   下一步：GitHub 配 4 个 Secrets（VPS_HOST/VPS_USER/VPS_SSH_KEY/DEPLOY_DOMAIN），push main 即可。"
