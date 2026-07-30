# ShadowingMaster
MVP 项目，遵循 tachos-flow 流程；docs/PRD.md 是需求事实源。

## 栈（锁死，勿引入计划外依赖）
前端 Vite+React+TS（5173）；后端 FastAPI+SQLite（8000）

## 命令
- 后端：cd backend && uvicorn main:app --reload --port 8000
- 前端：cd frontend && npm run dev
- E2E：npx playwright test

## 规则
- 每片一个 commit；API 契约 = backend 的 Pydantic model
- 切片计划与优先级见 docs/PRD.md；计划外功能不做，记入候选清单
