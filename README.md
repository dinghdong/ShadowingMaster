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
3. push 到 `main` → `deploy.yml` 自动：构建镜像推到 **GHCR**（包设为 Public）→ scp compose/Caddyfile → VPS `docker compose up` → 两段探活（先容器内 `/api/health`，再公网域名，便于区分「应用起不来」与「Caddy/DNS/证书未就绪」）。

> 部署全程不上传源码，只投递 `docker-compose.yml` 与 `Caddyfile`；应用本体是 GHCR 上的镜像。首次部署必须走 CI —— `BACKEND_IMAGE` 需指向已构建的镜像，在服务器上手动 `docker compose up` 会因该变量缺失而报错退出。

> 私有镜像：若 GHCR 包设为 Private，需在 VPS 上 `docker login ghcr.io`（用含 `read:packages` 的 PAT），见 compose 的 `BACKEND_IMAGE`。

### 3. 备份
- 夜间 cron（`scripts/backup.sh`）把 `app.db` 在线备份到 OSS 私有桶 `backups/`，保留 7 天。
- 恢复：`docker compose run --rm backend python -c "..."` 从 OSS 下载覆盖 `/data/app.db` 后 `docker compose restart backend`。

### 4. 回滚
镜像每次同时打 `:latest` 与 `:sha-<commit>`，部署时 `.env` 里的 `BACKEND_IMAGE` 固定到当次 sha（而非 `latest`，否则重启一次容器就会悄悄换版本）。

回滚**不需要登录服务器**：GitHub Actions → Deploy backend → Run workflow，在 `image_tag` 填入要回退到的 `sha-<40位commit>` 即可。留空则构建并部署当前 commit。该模式跳过构建，直接部署 GHCR 上已有的镜像。

### 5. 媒体文件与词级时间戳
`DATA_DIR=/data` 把 `app.db` 与 `media/` 一并落到挂载卷。**字幕 `.vtt` 只存在于该卷**——`_upload_assets` 只上传 mp4 与封面，不传字幕。因此：

- 卷丢失 = 字幕丢失 = `backfill_word_timings.py` 无法为存量视频补词级时间戳，只能重新导入。
- 卡拉OK逐词高亮依赖这些时间戳；`word_timings` 为 NULL 时前端回退到句内线性插值（精度差但可用）。
- 导入时只接受 YouTube **自动生成字幕轨**（词级时间戳的唯一来源）。上传字幕轨会被拒绝并提示用户，CLI 可用 `--allow-manual-track` 绕过。

### 相关文件
- `docker-compose.yml` / `Caddyfile` — VPS 上的服务编排与反代
- `.github/workflows/ci.yml` — PR：前端 lint/build + 后端镜像构建校验 + 后端模块导入冒烟
- `.github/workflows/deploy.yml` — push main 自动部署；`workflow_dispatch` 手动部署/回滚
- `scripts/bootstrap-vps.sh` / `scripts/backup.sh` / `scripts/setup-deploy.sh` — VPS 引导、备份、本机一键配置
- `backend/Dockerfile` + 仓库根 `.dockerignore` — 镜像构建

> **构建上下文是仓库根目录，不是 `backend/`。** `backend/requirements.txt` 里有
> `-e ../packages/proxy_auto`，以 `backend/` 作上下文时 pip 找不到该目录，会直接报
> `not a valid editable requirement` 把构建打掉。正确姿势：
> `docker build -f backend/Dockerfile .`（CI 里两个 workflow 都已按此配置）。
> 根 `.dockerignore` 负责把 `backend/media`（本机近 700MB）、前端 `node_modules`、
> 设计稿与本地数据库挡在上下文之外。
