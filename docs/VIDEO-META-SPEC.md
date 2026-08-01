# 视频简介与标签 · 实现方案

状态：已确认（2026-08-01）
范围：视频增加「简介 description」与「标签 tags」两个字段，爬取时自动填充，前端在列表卡片与跟读页展示。

## 数据来源
- 跟随现有 YouTube 自动爬取流程，由 `fetch_video.py` 用 yt-dlp 的 `info` 直接抓取原视频的 `description` 与 `tags`，无需用户手填。
- `tags` 在库中存为 JSON 字符串（如 `["english","speaking"]`），接口层解析为数组返回，避免逗号歧义。

## 数据存储
- `videos` 表新增两列：
  - `description TEXT`：原视频简介（可较长，展示端做截断）。
  - `tags TEXT`：JSON 数组字符串。
- 旧库兼容：`init_db` 启动时通过 `pragma_table_info` 探测，缺列则 `ALTER TABLE` 补列，不破坏已有数据。

## 接口契约（Pydantic VideoOut 为事实源）
```jsonc
{
  "id": 1, "youtube_id": "...", "title": "...",
  "duration_seconds": 154, "thumbnail_url": "...", "video_path": "...",
  "sentence_count": 12,
  "description": "本视频带你...",      // 新增，可空
  "tags": ["英语口语", "影子跟读"]       // 新增，数组，可空
}
```
- `GET /api/videos` 与 `GET /api/videos/{id}` 的 video 对象均带这两个字段（`currentVideo` 取自列表，故列表返回即覆盖跟读页）。

## 前端展示
- 列表卡片：标题/时长/句数下方新增标签 chips（最多 3 个，超出省略）。
- 跟读页头部（模式条下方）：完整简介（行截断 `-webkit-line-clamp:3`）+ 标签 chips（全部）。
- 复用 `components.css` 令牌与 `.chip` 语义类，新增 `.chip--sm` 与 `.video-desc` 两个类。

## 不在本次范围
- 不做手动编辑/后台录入表单（用户选择「爬取时自动填充」）。
- 不做按标签筛选/搜索（后续候选）。
