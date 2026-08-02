#!/usr/bin/env bash
# ShadowingMaster 后端 —— 无 Docker 部署脚本（适用于阿里云 SWAS / 任意 Ubuntu·Alinux·CentOS 系）
# 用法：在服务器上以 root 或 sudo 执行  bash deploy/install.sh
set -euo pipefail

APP_DIR=/opt/shadowing
SVC_USER=shadowing
SVC_GROUP=shadowing

echo "==> 1. 安装系统依赖（python / venv / ffmpeg）"
if command -v dnf &>/dev/null; then
  PKG_MGR="dnf"; PM_SUDO=""   # 在阿里云上本脚本应以 root 跑，dnf 无需 sudo
elif command -v yum &>/dev/null; then
  PKG_MGR="yum"; PM_SUDO=""
elif command -v apt-get &>/dev/null; then
  PKG_MGR="apt"; PM_SUDO="sudo"
  $PM_SUDO apt-get update -y
else
  echo "不支持的包管理器，请手动安装 python3 / python3-venv / ffmpeg"; exit 1
fi

$PKG_MGR install -y python3 python3-pip python3-venv || true
# Alinux/CentOS 上也可能叫 python3.11-venv，确保 venv 可用
command -v python3 -m venv >/dev/null 2>&1 || $PKG_MGR install -y python3.11-venv || true

# ffmpeg：优先包管理器，失败则下载静态构建（glibc 通用，最稳）
if ! command -v ffmpeg &>/dev/null; then
  echo "    ffmpeg 不在仓库内，尝试下载静态构建..."
  curl -fsSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ff.tar.xz \
    && tar -xf /tmp/ff.tar.xz -C /tmp \
    && cp /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ \
    && cp /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ \
    && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
    && echo "    ffmpeg 静态构建已装到 /usr/local/bin" \
    || { echo "ffmpeg 安装失败，请手动安装后重试"; exit 1; }
fi
echo "    ffmpeg: $(command -v ffmpeg) $(ffmpeg -version 2>/dev/null | head -1 || echo 'N/A')"

echo "==> 2. 创建运行用户（无登录）"
id "$SVC_USER" &>/dev/null || useradd -r -s /usr/sbin/nologin "$SVC_USER"

echo "==> 3. 放置代码（请把 backend/ 上传到 /opt/shadowing/backend）"
# 假设代码已通过 scp/git 放到 $APP_DIR/backend；此处仅确保目录与归属
mkdir -p "$APP_DIR"
[ -d "$APP_DIR/backend" ] || { echo "未找到 $APP_DIR/backend，请先上传代码"; exit 1; }

echo "==> 4. 建立虚拟环境并安装依赖"
# 先把整树归属运行用户：服务以 shadowing 运行，需要在 /opt/shadowing/app.db、
# backend/media 等 root 目录下写库/写媒体，必须可写
chown -R "$SVC_USER":"$SVC_GROUP" "$APP_DIR"
sudo -u "$SVC_USER" python3 -m venv "$APP_DIR/venv"
sudo -u "$SVC_USER" "$APP_DIR/venv/bin/pip" install --upgrade pip
sudo -u "$SVC_USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

echo "==> 5. 准备 .env（若不存在则从示例复制，请随后填好真实值）"
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
  echo "    已生成 $APP_DIR/backend/.env，请编辑填入 SECRET_KEY / CORS_ALLOW_ORIGINS / OSS_*"
fi

echo "==> 6. 注册 systemd 服务"
cp "$APP_DIR/backend/deploy/shadowing.service" /etc/systemd/system/shadowing.service
systemctl daemon-reload
systemctl enable --now shadowing

echo "==> 7. 开放防火墙端口 8000（SWAS 还需在控制台防火墙页单独放行）"
if command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-port=8000/tcp || true
  firewall-cmd --reload || true
fi

echo ""
echo "完成。检查状态： systemctl status shadowing"
echo "查看日志：       journalctl -u shadowing -f"
echo "健康检查：       curl http://localhost:8000/api/health"
echo ""
echo "提醒："
echo " - 若启用 OSS，请在 $APP_DIR/backend/.env 填好 OSS_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET 并重启服务：systemctl restart shadowing"
echo " - 上线前请给后端绑域名 + HTTPS（否则真机 getUserMedia 录音受限）"
