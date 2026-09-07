#!/usr/bin/env bash
# 手机真机调试：把前端 + 后端同时暴露到局域网，手机同 Wi-Fi 即可访问验证 UI。
# 用法：  bash mobile-debug.sh
# 退出：  Ctrl+C 会自动关闭前后端两个服务
#
# 注意：
#  · 手机与本机必须连同一 Wi-Fi
#  · 若手机打不开，检查 macOS 防火墙是否放行 node / python 的传入连接
#  · 局域网 IP 每次可能变化（DHCP），脚本会自动重取；若仍连不上重跑本脚本即可

# 定位仓库根目录（脚本放在仓库根）
ROOT="$(cd "$(dirname "$0")" && pwd)"

# 取 Mac 局域网 IP（en0=Wi-Fi，取不到回退 en1）
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
if [ -z "$MAC_IP" ]; then
  echo "❌ 获取不到局域网 IP，请确认本机已连接 Wi-Fi" >&2
  exit 1
fi

echo "📱 手机访问地址:  http://$MAC_IP:5173"
echo "   (后端 API:     http://$MAC_IP:8000)"
echo ""

# 退出时清理后台后端进程
cleanup() { [ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null; }
trap cleanup EXIT INT TERM

# ── 后端：监听 0.0.0.0 + 放行手机 origin 的 CORS ──
# 系统 PATH 无 uvicorn，改用 workbuddy 托管 venv（已含 fastapi/uvicorn，并补装 oss2）
PYBIN="/Users/dingdongdong/.workbuddy/binaries/python/envs/default/bin/python"
cd "$ROOT/backend"
# 同时放行 localhost:5173（Mac 本机直接访问 localhost 时）与局域网 IP:5173（手机/同 Wi-Fi 设备）
CORS_ALLOW_ORIGINS="http://localhost:5173,http://$MAC_IP:5173" \
  "$PYBIN" -m uvicorn main:app --reload --port 8000 --host 0.0.0.0 &
BACK_PID=$!

# ── 前端：监听 0.0.0.0 + BASE 指向本机后端（手机上 localhost≠Mac）──
cd "$ROOT/frontend"
VITE_API_BASE="http://$MAC_IP:8000" npm run dev -- --host
