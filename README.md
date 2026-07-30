# ShadowingMaster

英语口语跟读训练工具 MVP。

## 启动命令

```bash
# 后端
cd backend && uvicorn main:app --reload --port 8000

# 前端
cd frontend && npm run dev

# API 文档
open http://localhost:8000/docs
```

## 当前状态

✅ 工程骨架搭建完成（阶段2）
- 前端 Vite+React+TS（端口 5173）
- 后端 FastAPI+SQLite（端口 8000）
- 数据库表结构：users, videos, sentences, vocabulary_words, user_progress, word_books
- 示例数据已填充（3个视频 + 5条句子）
- JWT 认证、健康检查、视频/进度/生词本 API 已就绪

## 下一步：阶段3 — 交互原型（Slice 0）
