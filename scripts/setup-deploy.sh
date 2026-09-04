#!/usr/bin/env bash
set -euo pipefail

# ShadowingMaster —— 部署链路一键配置（在**你的本机**运行，不是在服务器上）
#
# 用法：
#   ./scripts/setup-deploy.sh --host 8.208.16.234 --user root \
#                             --domain api.shadowingmaster.genisource.studio \
#                             [--env-file /path/to/prod.env]
#
# 做四件事：
#   1. 生成一对专用部署密钥（~/.ssh/sm_deploy），不复用你的日常密钥
#   2. 把公钥装到服务器（这一步会提示你输入服务器密码，输一次）
#   3. 把 bootstrap-vps.sh 与 backup.sh 传上去并执行（装 Docker、建目录、
#      写 .env 与 Caddyfile、装备份 cron、放行端口）
#   4. 打印需要填进 GitHub Secrets 的 5 个值（私钥内容只输出到终端，不落盘副本）
#
# 之后只剩：把这 5 个值填进 GitHub → push main → 自动部署。

HOST="" USER_NAME="" DOMAIN="" ENV_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --host)     HOST="$2";     shift 2;;
    --user)     USER_NAME="$2";shift 2;;
    --domain)   DOMAIN="$2";   shift 2;;
    --env-file) ENV_FILE="$2"; shift 2;;
    *) echo "未知参数: $1" >&2; exit 1;;
  esac
done
# 逐个显式检查：${v,,} 的小写展开是 bash 4+ 语法，macOS 自带 bash 3.2 不支持。
[ -z "$HOST" ]      && { echo "ERROR: 缺少 --host 参数（服务器 IP）" >&2; exit 1; }
[ -z "$USER_NAME" ] && { echo "ERROR: 缺少 --user 参数（SSH 账号）" >&2; exit 1; }
[ -z "$DOMAIN" ]    && { echo "ERROR: 缺少 --domain 参数（API 域名）" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY=~/.ssh/sm_deploy

echo "==> 1/4 生成部署专用密钥"
if [ -f "$KEY" ]; then
  echo "    $KEY 已存在，复用（如需重建请先删除）"
else
  ssh-keygen -t ed25519 -C "shadowingmaster-gha-deploy" -f "$KEY" -N ""
  echo "    已生成 $KEY"
fi

echo "==> 2/4 安装公钥到 $USER_NAME@$HOST（接下来会提示输入服务器密码）"
ssh-copy-id -i "$KEY.pub" "$USER_NAME@$HOST"

echo "==> 3/4 上传并执行服务器引导"
ssh -i "$KEY" "$USER_NAME@$HOST" "mkdir -p /opt/shadowingmaster/_bootstrap"
scp -i "$KEY" \
    "$REPO_ROOT/scripts/bootstrap-vps.sh" \
    "$REPO_ROOT/scripts/backup.sh" \
    "$REPO_ROOT/Caddyfile" \
    "$USER_NAME@$HOST:/opt/shadowingmaster/_bootstrap/"
if [ -n "$ENV_FILE" ]; then
  scp -i "$KEY" "$ENV_FILE" "$USER_NAME@$HOST:/opt/shadowingmaster/_bootstrap/prod.env"
  REMOTE_ENV_ARG="--env-file /opt/shadowingmaster/_bootstrap/prod.env"
else
  REMOTE_ENV_ARG=""
  echo "    未传 --env-file，服务器上会写一份占位 .env（记得补全）"
fi
# bootstrap 里用 $SCRIPT_DIR/../Caddyfile 定位模板，故按同样的相对层级摆放
ssh -i "$KEY" "$USER_NAME@$HOST" "
  set -e
  cd /opt/shadowingmaster/_bootstrap
  mkdir -p scripts && mv -f bootstrap-vps.sh backup.sh scripts/
  chmod +x scripts/*.sh
  ./scripts/bootstrap-vps.sh --domain '$DOMAIN' $REMOTE_ENV_ARG
"

echo
echo "==> 4/4 需要填进 GitHub Secrets 的值"
echo "    仓库 → Settings → Secrets and variables → Actions → New repository secret"
echo
echo "  VPS_HOST        $HOST"
echo "  VPS_USER        $USER_NAME"
echo "  DEPLOY_DOMAIN   $DOMAIN"
echo "  BACKEND_ENV     <生产 .env 全文；模板见 backend/.env.example，不要含 BACKEND_IMAGE>"
echo "  VPS_SSH_KEY     ↓↓↓ 以下整段（含首尾 BEGIN/END 行）↓↓↓"
echo "─────────────────────────────────────────────────────────"
cat "$KEY"
echo "─────────────────────────────────────────────────────────"
echo
echo "配好后 push 到 main，deploy.yml 会构建镜像并自动部署。"
echo "验证：curl -s https://$DOMAIN/api/health"
