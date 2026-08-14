# 架构约束（开发时不得违反；要违反先改这里并说明理由）
- 部署（混合拓扑，见下）：前端静态托管在 Vercel；后端单进程跑在单台 VPS 的 Docker 容器里；SQLite 单文件 app.db 落在挂载卷（DATA_DIR）
  - 前端：Vercel（frontend/vercel.json），构建注入 VITE_API_BASE=https://api.<domain>
  - 后端：单 VPS（推荐阿里云伦敦，与 OSS eu-west-1 / 住宅代理同区域），docker compose 起 backend + caddy（Caddy 自动 TLS 反代 /api）
  - 媒体：优先阿里云 OSS 私有桶 + 签名 URL；OSS 关闭时降级本地磁盘（/data/media）
- 依赖白名单：fastapi、uvicorn、react、vite；新增依赖必须在 PRD 记录理由
- 可观测性基线：/api/health、请求日志、错误堆栈可见；部署后 docker logs 可查，CI 部署后会探活 /api/health
- 备份 = 夜间 cron 把 app.db 在线备份到 OSS 私有桶（scripts/backup.sh，保留 7 天）
