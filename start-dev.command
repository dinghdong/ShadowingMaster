#!/bin/bash
# 双击即可启动 ShadowingMaster 开发环境（后端 8000 + 前端 5173）。
# 后端首次启动会自动跑 sentences.word_timings 的增量迁移。
cd "$(dirname "$0")"

echo "▶ 启动后端 (uvicorn :8000)…"
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000"'

echo "▶ 启动前端 (vite :5173)…"
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/frontend && npm run dev"'

sleep 6
open http://localhost:5173
echo "✓ 已在两个新终端窗口里分别启动，浏览器应已打开 http://localhost:5173"
echo "  关掉那两个终端窗口即可停止服务。"
