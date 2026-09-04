#!/usr/bin/env bash
set -euo pipefail

# ShadowingMaster —— 部署密钥一键配置（在**你的本机**运行，不是在服务器上）
#
# 用法：
#   ./scripts/setup-deploy.sh --host 8.208.16.234 --user root \
#                             --domain api.shadowingmaster.genisource.studio
#
# 生产后端是 systemd 直跑（不是容器）：deploy.yml 把代码 rsync 到 /opt/shadowing
# 后 `systemctl restart shadowing`，Caddy 已在 /etc/caddy/Caddyfile 反代好。
# 所以本脚本只做两件事：
#   1. 生成一对专用部署密钥（~/.ssh/sm_deploy），不复用你的日常密钥
#   2. 把公钥装到服务器（首次会提示输入服务器密码，输一次）
#   然后打印需要填进 GitHub Secrets 的 4 个值（私钥只输出到终端，不落盘副本）。
#
# 注：BACKEND_ENV 这个 Secret 已不需要——服务器上的 /opt/shadowing/backend/.env
# 已是真实配置，部署会保留它，不会从 Secret 覆盖。

HOST="" USER_NAME="" DOMAIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --host)   HOST="$2";   shift 2;;
    --user)   USER_NAME="$2";shift 2;;
    --domain) DOMAIN="$2"; shift 2;;
    *) echo "未知参数: $1" >&2; exit 1;;
  esac
done
[ -z "$HOST" ]    && { echo "ERROR: 缺少 --host 参数（服务器 IP）" >&2; exit 1; }
[ -z "$USER_NAME" ] && { echo "ERROR: 缺少 --user 参数（SSH 账号）" >&2; exit 1; }
[ -z "$DOMAIN" ]  && { echo "ERROR: 缺少 --domain 参数（API 域名）" >&2; exit 1; }

KEY=~/.ssh/sm_deploy

echo "==> 1/2 生成部署专用密钥"
if [ -f "$KEY" ]; then
  echo "    $KEY 已存在，复用（如需重建请先删除）"
else
  ssh-keygen -t ed25519 -C "shadowingmaster-gha-deploy" -f "$KEY" -N ""
  echo "    已生成 $KEY"
fi

echo "==> 2/2 安装公钥到 $USER_NAME@$HOST（接下来会提示输入服务器密码）"
ssh-copy-id -i "$KEY.pub" "$USER_NAME@$HOST"

echo
echo "==> 需要填进 GitHub Secrets 的值（4 个，不需要 BACKEND_ENV）"
echo "    仓库 → Settings → Secrets and variables → Actions → New repository secret"
echo
echo "  VPS_HOST      = $HOST"
echo "  VPS_USER      = $USER_NAME"
echo "  DEPLOY_DOMAIN = $DOMAIN"
echo "  VPS_SSH_KEY   = 以下整段私钥（含首尾 BEGIN/END 行）"
echo "------------------------------------------------------------"
cat "$KEY"
echo "------------------------------------------------------------"
echo
echo "配好后 push 到 main，deploy.yml 会 rsync 代码并重启 shadowing.service。"
echo "验证：curl -s https://$DOMAIN/api/health"
