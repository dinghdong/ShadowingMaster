# ShadowingMaster 前后端模块化优化方案

> 版本：v1 · 2026-08-01
> 范围：在不引入计划外依赖、不破坏现有 API 契约、不砍功能的前提下，对当前"扁平单文件"的代码做模块化拆分。
> 约束遵循：`AGENTS.md`（栈锁死 Vite+React+TS / FastAPI+SQLite）、`ARCHITECTURE.md`（依赖白名单、SQLite 单文件、单进程）、`docs/PRD.md`（候选清单外不做）。

---

## 0. 现状诊断（为什么要改）

代码能跑、功能完整，但**所有逻辑都挤在少数几个"巨无霸"文件里**，没有按职责分层。新人接手或加功能时，改动面大、易回归。

### 后端（backend/）
| 文件 | 行数 | 问题 |
|---|---|---|
| `main.py` | 523 | **单一 God File**：配置、JWT 鉴权、密码哈希、媒体 Range 流、视频/进度/生词本/标注/解析任务等全部路由，外加后台线程任务编排、Pydantic 模型，全堆在一个文件。 |
| `db.py` | 142 | schema 定义 + 增量迁移混在一起，且被 `seed.py`/CLI 直接 `from db import ...` 复用，迁移逻辑散落。 |
| `fetch_video.py` | 67 | CLI 脚本，却通过 `from import_video import MEDIA, ingest` 被 API 后台任务直接 `import` —— **脚本被服务耦合**。 |
| `import_video.py` | 176 | 字幕解析/分句算法 + 入库 IO 混写，函数既给 CLI 用也被 API 用。 |
| `translate_video.py` | 85 | 翻译管线，独立 CLI，但与 API 解析任务存在重复编排。 |
| `seed.py` | 55 | 顶层直接 `sqlite3.connect`（不走 `db.get_db`），与运行时 DB 访问方式不一致。 |

**核心痛点**：没有 `router / service / core` 分层；路由处理函数直接写 SQL；后台解析任务把"下载脚本"和"Web 服务"绑死；配置项（SECRET_KEY、CORS、token 过期）散在文件顶部。

### 前端（frontend/src/）
| 文件 | 行数 | 问题 |
|---|---|---|
| `App.tsx` | 997 | **单一 God Component**：根 `App` + 5 个页面（`LoginPage`/`ProfilePage`/`AddVideoPage`/列表/生词本）+ 跟读页整页 + 7 个小组件（`ActionBtn`/`CheckBtn`/`NoteEditor`/`ShadowActions`/`WordBookCard`/`ProgChips`/`SentenceRow`/`SentenceCard`/`DesktopShell`）全部塞在一个文件。 |
| `useApp.ts` | 814 | **单一 God Hook**：返回 ~70 个值，把 路由、鉴权、视频加载、进度、生词本、标注、播放控制、录音评测、四种练习状态 全部混在一个 `useState` 大杂烩里，无 Context、无拆分子 Hook。 |
| `components.css` | 1048 | 单一全局样式表（按 BEM 分段尚可，但随组件增多会失控）。 |
| `shared.ts` | 136 | 类型 + 词表加载 + 分词/对比/翻译/词典解析 全混一处。 |

**核心痛点**：没有按页面/功能拆目录；状态管理是"一个超级 Hook"，任何小改动都要动 `useApp.ts` 和 `App.tsx` 两处；`AppState` 这个巨型 interface 被所有页面 `&` 继承，强耦合。

---

## 1. 优化目标（验收标准）

1. **后端**：`main.py` 拆成 `core/`（配置·安全·DB）、`routers/`（按资源分文件）、`services/`（解析任务等），`main.py` 只剩 app 装配。单文件控制在 ~150 行以内。
2. **前端**：每个页面独立成文件；状态拆成多个 Context + 子 Hook（auth / player / exercises / recording…）；`App.tsx` 退化为纯路由壳（<120 行）。
3. **契约不变**：API 路径、请求/响应字段、SQLite schema、前端调用方式全部保持兼容（仅内部重组）。
4. **零新增依赖**：严格遵循依赖白名单。后端零新包（用 FastAPI 原生 `APIRouter`/`BackgroundTasks`/`BaseSettings` 思路但用标准库 `os.environ` 即可，不引 pydantic-settings）；前端零新包（React 自带 Context）。
5. **可逐步落地**：每步独立可编译、可运行，不影响线上行为。

---

## 2. 后端模块化方案

目标目录：
```
backend/
├── main.py                 # 只做装配：创建 app、挂 middleware、include routers、startup init_db
├── core/
│   ├── config.py           # SECRET_KEY / ALGORITHM / TOKEN 过期 / CORS 正则 —— 全部集中
│   ├── security.py         # verify_password / get_password_hash / create_access_token / get_current_user
│   └── db.py               # get_db() / init_db()（schema + 迁移，从现 db.py 搬）
├── models/
│   └── schemas.py          # 所有 Pydantic 模型（UserCreate/UserOut/Token/VideoOut/SentenceOut/ParseRequest/NoteIn…）
├── routers/
│   ├── auth.py             # /api/auth/*  (register/login/me)
│   ├── videos.py           # /api/videos, /api/videos/{id}, /api/videos/parse, /api/videos/jobs/{id}
│   ├── progress.py         # /api/progress, /api/progress/{id}
│   ├── wordbook.py         # /api/wordbook (GET/POST/DELETE)
│   ├── annotations.py      # /api/videos/{id}/annotations, favorite, note
│   └── media.py            # /media/* (Range 流)
├── services/
│   └── parse_job.py        # run_parse_job + 去重/状态机逻辑（把 main.py 里那坨抽出来）
└── (保留) fetch_video.py / import_video.py / translate_video.py / seed.py
```
要点：
- `main.py` 改为 `app.include_router(auth.router)` 等，路由文件各自 `router = APIRouter()`。
- 解析任务：**解除 API 对 CLI 脚本的 import 依赖**。把"下载+字幕解析+入库"封装进 `services/ingest.py`（或 `import_video.ingest` 的纯函数版），API 的后台线程只调 service，不再 `from fetch_video import fetch`。CLI 脚本可作为该 service 的薄包装（保留手动跑通能力，符合 Slice 2/7 叙事）。
- `seed.py` 改为 `from core.db import get_db` 复用同一访问方式，统一 DB 接口。
- 配置集中到 `core/config.py`，`SECRET_KEY` 等从环境变量读取（保持现状默认值，仅搬运）。
- **增量迁移**留在 `core/db.init_db`，逻辑不变（兼容旧库）。

---

## 3. 前端模块化方案

目标目录：
```
frontend/src/
├── main.tsx                      # 入口，挂 <AppProvider>
├── App.tsx                       # 纯路由壳：按 page 渲染对应页面组件（<120 行）
├── app/
│   ├── AppContext.tsx            # 顶层 Context：把 useApp 拆出的共享状态聚合提供
│   ├── hooks/
│   │   ├── useRouting.ts         # History 路由（parsePath/setPage/openVideo）
│   │   ├── useAuth.ts            # 登录/注册/登出/me
│   │   ├── useVideos.ts          # 视频列表/单个视频/进度恢复
│   │   ├── useWordBook.ts        # 生词本/标注(收藏·笔记)
│   │   ├── usePlayer.ts          # 视频播放/单句播放/连续播放/速度/循环/播放头
│   │   ├── useRecording.ts       # 跟读录音 + 本地评分（computeScore）
│   │   └── useExercises.ts       # 原文/精听/听写/挖空 四种练习状态
│   └── store.ts                  # 共享状态容器（或拆多个 Context）
├── pages/
│   ├── LandingPage.tsx           # 已有，搬过来
│   ├── LoginPage.tsx             # 从 App.tsx 抽出
│   ├── ProfilePage.tsx           # 从 App.tsx 抽出
│   ├── AddVideoPage.tsx          # 从 App.tsx 抽出
│   ├── VideoListPage.tsx         # 从 App.tsx 抽出（含卡片）
│   ├── WordBookPage.tsx          # 从 App.tsx 抽出
│   └── PracticePage.tsx          # 跟读页整页（含左侧练习台 + 右侧列表 + 设置弹层）
├── features/practice/
│   ├── SentenceCard.tsx          # 左侧当前句练习台（原文/跟读/听写/挖空）
│   ├── SentenceRow.tsx           # 右侧列表行
│   ├── ProgChips.tsx             # 进度小标签
│   ├── ShadowActions.tsx         # 跟读录音/播放/评价按钮
│   ├── NoteEditor.tsx            # 笔记内联编辑
│   ├── WordDetailModal.tsx       # 生词释义弹窗（从 App.tsx 抽）
│   └── EvalModal.tsx             # 跟读评价弹窗（从 App.tsx 抽）
├── components/                    # 通用原子组件
│   ├── Icon.tsx                  # 已有
│   ├── ActionBtn.tsx / CheckBtn.tsx / WordBookCard.tsx / DesktopShell.tsx
│   └── ui/                       # Segmented / Toggle / Progress / Modal 等基础件
├── lib/
│   ├── api.ts                    # 已有，维持
│   ├── shared.ts                 # 拆为 types.ts（Video/Sentence/Page）+ text.ts（分词/对比）+ dict.ts（词典/翻译）
│   └── exam-words.union.json     # 考纲并集词表（isHardWord 已知基线）；分级版 exam-words.json 备用
├── styles/
│   ├── tokens.css / index.css / theme.css
│   └── components/               # components.css 按组件拆分（可选，见下）
└── theme.ts / theme-mode.ts      # 已有
```

### 状态管理落地策略（关键）
当前 `useApp` 返回 70 个字段，直接整块传给每个页面（`AppState`）。拆法二选一，推荐 **方案 A**：

- **方案 A（Context 分域）**：建立多个 Context（AuthContext / PlayerContext / ExerciseContext / RecordingContext），各页面只 `use` 自己关心的域。根 `AppProvider` 组合它们。好处：页面解耦、`App.tsx` 极简、避免无谓重渲染。代价：需引入 `createContext` + Provider（React 自带，**零新依赖**）。
- **方案 B（继续单 Hook，但拆子 Hook）**：`useApp` 内部调用 `useRouting()/useAuth()/usePlayer()...` 并聚合返回，页面仍接 `AppState`。改动最小、风险最低，但 `App.tsx` 仍需把整个 `AppState` 透传。适合"先不动接口、只拆文件"的快速版。

> 建议：**先做方案 B（把 useApp 拆成子 Hook 组合，文件级解耦），待稳定后再演进到方案 A（Context 分域）**。两步都保持 `AppState` 类型兼容，可灰度。

### 样式拆分（可选）
`components.css` 目前按 BEM 分段、单页应用零命名冲突，短期可接受。若想进一步模块化，可：
- 按组件拆成 `styles/components/*.css`，在各自 `.tsx` 里 `import "./SentenceCard.css"`（Vite 原生支持，无需新依赖）；
- 或保留单文件，仅补齐分区注释与目录索引。
**建议本期不强制拆 CSS**，避免大范围改动引入回归；优先拆 JS/TS。

---

## 4. 落地步骤（建议按顺序，每步可独立验证）

| 步 | 内容 | 风险 | 验证 |
|---|---|---|---|
| **P0** | 后端抽 `core/config.py`、`core/security.py`、`models/schemas.py`，`main.py` 暂保留路由但 import 这些模块 | 低 | `uvicorn` 启动 + `/api/health` 通过 |
| **P1** | 后端按资源拆 `routers/*` + `services/parse_job.py`，解除对 CLI 脚本的 import 耦合；`main.py` 退化为装配 | 中 | 全路由回归（登录→列表→解析→进度→生词本）；E2E 跑通 |
| **P2** | 前端 `useApp.ts` → 拆 `hooks/useRouting/useAuth/usePlayer/useVideos/useWordBook/useRecording/useExercises`（方案 B），聚合回 `useApp` | 低 | 页面行为不变；`npm run dev` 通过 |
| **P3** | 前端页面抽出：`pages/*`（Login/Profile/Add/List/WordBook/Practice），`App.tsx` 仅做路由壳 | 中 | 各页面视觉/交互不变 |
| **P4** | 前端 `features/practice/*` 与 `components/*` 原子组件独立成文件 | 低 | 跟读页交互回归 |
| **P5**（可选） | 演进到 Context 分域（方案 A）+ 样式按组件拆分 | 中 | 性能/可维护性提升，行为不变 |

> 每片一个 commit（遵循 AGENTS.md）。功能范围严格 = 当前已实现的，不做候选清单内容。

---

## 5. 不做的事（边界）

- 不引入 Redux/Zustand/React Query 等新状态库（依赖白名单外）。
- 不引入 pydantic-settings / SQLAlchemy / alembic 等（保持轻量、SQLite 直连）。
- 不改 API 契约、不改 SQLite schema（含迁移逻辑）、不改 UI 视觉与 token 体系。
- 不做 PRD「候选清单」里的内容（深色模式/动效/发音打分等已明确不做或已另议）。

---

## 6. 收益预期

- 单文件最大行数从 ~1000 降到 ~150，定位成本大幅下降。
- 加「生词本新字段」「练习模式新变种」等需求时，改动面从 2 个 God 文件收敛到 1~2 个聚焦模块。
- 后端路由可独立单测（router 可挂载到 TestClient），前端页面可独立渲染/测试。
- 为后续（v2 候选）做组件库、PWA、状态库演进打好结构基础。
