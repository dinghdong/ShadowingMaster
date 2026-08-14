# ShadowingMaster

英语口语跟读训练工具 MVP。

## 本地启动

```bash
# 后端
cd backend && uvicorn main:app --reload --port 8000
# 前端
cd frontend && npm run dev
# API 文档
open http://localhost:8000/docs
```

---

## 部署

混合拓扑：前端静态托管在 **Vercel**，后端单进程跑在**单台 VPS** 的 Docker 容器里，SQLite 落在挂载卷，媒体走阿里云 OSS。

```
Browser
  ├─ https://<domain>      → Vercel   (frontend/ 静态 SPA)
  └─ https://api.<domain>  → Caddy(自动TLS) → backend 容器 :8000
                                   ├─ SQLite (挂载卷 /data/app.db)
                                   └─ media → 阿里云 OSS eu-west-1 (签名URL)
```

### 0. 准备
- 一个域名，把 `api.<domain>` 的 A 记录指向 VPS 公网 IP（Caddy 会自动申请 Let's Encrypt 证书）。
- GitHub 仓库（`git remote add origin ...`），因为 CI 与 Vercel 都需要。
- 阿里云 OSS 伦敦桶（私有）+ AccessKey；伦敦住宅代理（YouTube 反爬，可选但建议）。

### 1. 前端（Vercel，自动）
1. Vercel 导入该 GitHub 仓库，框架预设选 Vite，**Root Directory 设为 `frontend`**。
2. 项目环境变量加：`VITE_API_BASE=https://api.<domain>`。
3. 之后 push 到 `main` → Vercel 自动构建部署（vercel.json 已配好 SPA rewrite 与 no-store 缓存）。

### 2. 后端（GitHub Actions → VPS，自动）
1. 在 VPS（推荐 Ubuntu/Debian，阿里云伦敦）上跑一次引导：
   ```bash
   ./scripts/bootstrap-vps.sh --domain api.<domain> --env-file /path/to/prod.env
   ```
   `prod.env` 内容见 `backend/.env.example`（至少 `SECRET_KEY` / `CORS_ALLOW_ORIGINS` / `OSS_*` / `YTDLP_PROXY`）。
2. 在 GitHub 仓库 Settings → Secrets 配置：
   - `VPS_HOST`、`VPS_USER`、`VPS_SSH_KEY`（部署用 SSH 私钥）
   - `DEPLOY_DOMAIN` = `api.<domain>`
   - `BACKEND_ENV` = 生产 `.env` 全文（不要含 `BACKEND_IMAGE`，CI 会自动补）
3. push 到 `main` → `deploy.yml` 自动：构建镜像推到 **GHCR**（包设为 Public）→ scp compose/Caddyfile → VPS `docker compose up` → 探活 `/api/health`。

> 私有镜像：若 GHCR 包设为 Private，需在 VPS 上 `docker login ghcr.io`（用含 `read:packages` 的 PAT），见 compose 的 `BACKEND_IMAGE`。

### 3. 备份
- 夜间 cron（`scripts/backup.sh`）把 `app.db` 在线备份到 OSS 私有桶 `backups/`，保留 7 天。
- 恢复：`docker compose run --rm backend python -c "..."` 从 OSS 下载覆盖 `/data/app.db` 后 `docker compose restart backend`。

### 4. 回滚
- 镜像按 `:latest` 推送。`docker compose` 在 VPS 上 `docker compose pull backend && docker compose up -d` 可回退到上一可用镜像；CI 探活失败会报错退出，需手动重拉已知良好 digest。

### 相关文件
- `docker-compose.yml` / `Caddyfile` — VPS 上的服务编排与反代
- `.github/workflows/ci.yml` — PR 时前端构建/lint + 后端镜像构建校验
- `.github/workflows/deploy.yml` — push main 时后端部署
- `scripts/bootstrap-vps.sh` / `scripts/backup.sh` — VPS 引导与备份
- `backend/.dockerignore`、`backend/Dockerfile` — 镜像构建
