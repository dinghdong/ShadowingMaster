# 模块化重构落地结果（功能不变）

日期：2026-08-02
基线 commit：dde85d4（重构前）
后端 commit：b7adf0a　前端 commit：5793986

前后端各由一个子 Agent 并行负责重构，主 Agent 在两端都完成后做集成验证。**所有 API 契约、SQLite schema 语义、UI token 体系均未改动，零新增依赖。**

## 后端：main.py（523 行）→ 分层结构
```
backend/
├── main.py                 # ~50 行：app 组装 + include_router + /api/health
├── core/
│   ├── config.py           # 配置常量（JWT 密钥/算法/MEDIA_DIR/DB_PATH 等）
│   ├── db.py               # get_db 连接 + init_db（CREATE TABLE IF NOT EXISTS，不删表）
│   └── security.py         # JWT 签发/校验、密码哈希
├── models/
│   └── schemas.py          # 原 Pydantic 模型集中管理
├── routers/
│   ├── auth.py             # /api/auth/*  (prefix=/api/auth)
│   ├── videos.py           # /api/videos/* (prefix=/api/videos)
│   ├── progress.py         # /api/progress (prefix=/api/progress)
│   ├── wordbook.py         # /api/wordbook (prefix=/api/wordbook)
│   ├── annotations.py      # /api/videos/{id}/annotations, /api/sentences/{id}/favorite|note
│   └── media.py            # /media/{file_name} (Range 流 + 路径穿越拦截)
└── services/
    └── parse_job.py        # YouTube 异步解析任务（保留延迟 import fetch_video 解耦）
```
已删除旧 `backend/db.py`。

## 前端：useApp（814 行）→ 子 Hook + 页面
```
frontend/src/
├── App.tsx                 # ~50 行：纯路由壳，const app = useApp() → 按 app.page 渲染页面
├── useApp.ts               # 组合子 Hook，返回与重构前逐字一致的 AppState（93 字段）
├── hooks/
│   ├── useRouting.ts       # page / currentVideoId / setPage / openVideo / jumpTargetRef
│   ├── useAuth.ts          # user / login / register / logout / me
│   ├── useVideos.ts        # videos / sentences / currentIndex / parse 任务
│   ├── useWordBook.ts      # wordBook / favorites / notes / wordDetail
│   ├── usePlayer.ts        # videoRef / rate / loop / playhead / togglePlay
│   ├── useExercises.ts     # subtitleMode / practiceMode / dictation / cloze / wordHighlight
│   └── useRecording.ts     # recordings / start / stop / playEval
├── pages/                  # Login / Profile / AddVideo / VideoList / WordBook / Practice / Landing
├── components/             # ActionBtn / CheckBtn / DesktopShell / WordBookCard（原内联组件）
└── features/practice/     # 四种练习模式的小组件（逐字搬移）
```
子 Hook 间循环依赖通过 `wordBookRef / playerRef / exercisesRef / recordingRef` 延迟 `.current` 读取解决。

## 验证结果（主 Agent 集成测试 P5）
- **后端 live 冒烟**：`uvicorn main:app` 启动成功；`GET /api/videos`→200、`/docs`→200、`/openapi.json`→200；逐条路由路径对比 `git HEAD` 旧 `main.py`，17 条路径/方法/字段**逐字一致**（含 `/api/auth/*`、`/api/health` 原本即如此）。
- **后端功能**：子 Agent 用 stdlib-only harness 跑 45 项检查（含 register/login/me、videos、annotations、favorites、notes、progress upsert、wordbook CRUD、parse 去重、media Range 206 + 穿越拦截）全部通过；`app.db` 大小/mtime 未变。
- **前端编译**：`tsc --noEmit` 通过；`vite build` 成功（51 modules，dist 正常产出）。`AppState` 93 字段名称与声明顺序与重构前完全一致（校验 `ORDER MATCH: true`）。

## 守护的约束
- API 路径/字段、SQLite schema、UI token 体系：零改动
- 依赖：零新增（仅用 FastAPI 自带 `APIRouter`、React 自带 Hooks/Context）
- 提交：按 AGENTS.md「每片一个 commit」，后端/前端分两次提交
