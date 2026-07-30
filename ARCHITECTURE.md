# 架构约束（开发时不得违反；要违反先改这里并说明理由）
- 部署：单 VPS，前端静态文件 + 后端单进程 + SQLite 单文件 app.db
- 依赖白名单：fastapi、uvicorn、react、vite；新增依赖必须在 PRD 记录理由
- 可观测性基线：/api/health、请求日志、错误堆栈可见；部署后 journalctl 可查日志
- 备份 = 拷贝 app.db 文件
