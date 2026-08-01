# 视频「地道表达·重点单词」模块 · 实现流程设计

> 配套：`VIDEO-VOCABULARY-SPEC.md`（数据模型/API/UI 草案）。
> 本文聚焦**端到端处理流水线**——一个原始视频如何变成可展示的「重点表达」清单。
> 设计原则：复用现有入库链路、不预切媒体、提取策略可插拔（轻量/完整/混合）。

---

## 0. 关键约束（来自实际代码核查）

- 现有入库已产出 `sentences(start_time, end_time, english_text, chinese_text)` + `videos(video_path)`：
  **「点词跳原句」无需预切 mp3/mp4**，用 `#t=` 片段 URI 或播放器 `currentTime` 即可。
  （竞品为同一能力预切了 318 个碎片文件，我们应规避该成本。）
- ASR 已外包给 YouTube 自动字幕（`writeautomaticsub`），本地无需跑 Whisper。
- 触发链：`POST /api/videos/parse` → 后台线程 `fetch_video.fetch()` →
  `import_video.ingest()` + `translate_video.py`。**提取阶段应挂进同一个 `parse_jobs` 后台任务**。
- `word_books` 已带 `video_id / sentence_id / example / definition_zh / example_zh` →
  收藏态直接写入即可，无需新表。

---

## 1. 流水线总览

```
[YouTube URL]
   │  POST /api/videos/parse
   ▼
┌─ Stage 0  视频入库（已有，复用）──────────────┐
│ yt-dlp 下载 mp4 + en.vtt + 封面             │
│ import_video.ingest(): VTT → sentences      │
│ translate_video.py: 补 chinese_text         │
│ 产物: videos + sentences(start/end/time)     │
└──────────────────────────────────────────────┘
   │  sentences 就绪
   ▼
┌─ Stage 1  表达提取（新，核心）────────────────┐
│ 输入: 全部 sentences.english_text           │
│ 策略: 轻量(isHardWord) | 完整(LLM) | 混合   │
│ 输出: 候选表达 {phrase, type, pos}          │
└──────────────────────────────────────────────┘
   │
   ▼
┌─ Stage 2  词典富化（新）──────────────────────┐
│ join 词典: phonetic_us/uk, meaning,          │
│ usagePattern, notes, levels                 │
│ 音频: FreeDictionary(音标) + 浏览器TTS(延后) │
└──────────────────────────────────────────────┘
   │
   ▼
┌─ Stage 3  出处关联（新）──────────────────────┐
│ 每个表达挂回出现过的 sentences                │
│ 存 source_sentence_ids / 关联表              │
│ 点击 → seek(video_path + start_time)         │
└──────────────────────────────────────────────┘
   │
   ▼
┌─ Stage 4  存储（schema 扩展）─────────────────┐
│ video_phrases(扩展字段) + word_books(收藏)   │
└──────────────────────────────────────────────┘
   │
   ▼
┌─ Stage 5 服务 / Stage 6 前端 ──────────────────┐
│ GET /phrases, collect 接口                   │
│ 跟读页底部「本课重点」面板 + 卡片            │
└──────────────────────────────────────────────┘
```

---

## 2. Stage 0 — 视频入库（复用，不重做）

- 入口：`POST /api/videos/parse` → 后台线程调用 `fetch_video.fetch(url)`。
- 产物：`videos(id, video_path, ...)` 与 `sentences(video_id, sentence_index, start_time, end_time, english_text, chinese_text)`。
- **结论**：此阶段零改动。「跳原句」靠 `videos.video_path + sentences.start_time/end_time`，
  不预切媒体，省掉 ffmpeg 逐句切分管线与 O(字幕数×2) 存储。

---

## 3. Stage 1 — 表达提取（核心，新）

- **触发**：挂进同一个 `parse_jobs` 后台线程，紧跟 `fetch()` 之后自动跑；
  另保留 `POST /api/videos/{id}/analyze-phrases`（spec §8.3）用于重跑/完整版。
- **输入**：该视频全部 `sentences.english_text`。
- **策略三选一**（决定工作量与质量）：

  | 策略 | 做法 | 依赖 | 能提取的单位 | 质量 |
  |------|------|------|--------------|------|
  | 轻量版（Slice 8 推荐） | 复用 `isHardWord()` 5000 词表，过滤难词→去重 | 无新增 | 仅 `word` | 中（误杀/漏网） |
  | 完整版（v2） | LLM 提示词提取多词单位 + 双语释义 | 需新增 LLM HTTP（PRD 记录理由） | word/phrase/phrasal_verb/idiom/collocation/oral_pattern | 高 |
  | 混合（演进推荐） | 轻量先做；完整版用 LLM 补「多词单位」+ 释义，词典 join 补发音 | 仅完整版需 LLM | 全 | 高 |

- **输出契约（统一）**：一串候选 `{phrase, type, pos}`，喂给 Stage 2。
- 轻量版落地极简：复用前端/现有 `isHardWord()` 逻辑，逐句分词去常用词 → 去重 → 写 `video_phrases(type='word')`。
  也可后端补一个填充脚本（spec §5.1 提到 `vocabulary_words` 当前为空，可弃用，直接写 `video_phrases`）。

---

## 4. Stage 2 — 词典富化

- 对每个候选表达，join 词典补全元数据：
  - `phonetic_us/uk` + `meaning_en/zh`：**FreeDictionary API**（现有「点词查词」已用，零新增依赖）。
  - `usagePattern` / `notes`：完整版由 LLM 给；轻量版留空或简单规则。
  - `levels`：考试/难度等级（雅思/托福/四六级…）。竞品将其与类型**拆为两个维度**；
    我们建议从 `tags` 里拆出独立的 `levels` 字段（见 §6 决策）。
- **发音音频**：竞品 `us/ukAudioPath` 是标配，但属「增强项」。
  MVP 建议**延后**——播放用浏览器原生 `SpeechSynthesis`（TTS）即时发声，
  避免引入单词发音库资产。完整版再接静态发音库或 TTS 预生成。

---

## 5. Stage 3 — 出处关联（跳原句的关键）

- 把每个表达映射回它出现过的 `sentences`：
  - 简单方案（对齐 spec §7.1）：`video_phrases.source_sentence_ids` = JSON 数组。
  - 推荐方案（可跨视频统计）：关联表
    `video_phrase_occurrences(phrase_id, sentence_id, start_time, end_time)`，并冗余出现计数。
- **跳转实现**：前端拿到 `sentence.start_time` → 设 `<video>.currentTime = start_time`
  （或 `video_path#t=start,end`）。**无需任何预切文件**。

---

## 6. Stage 4 — 存储（扩展现有 schema）

在 spec §7.1 的 `video_phrases` 基础上，按竞品对照补齐（详见 `KNOWLEDGE-POINTS-DECODED.md` §4）：

```sql
ALTER TABLE video_phrases ADD COLUMN phonetic_us TEXT;
ALTER TABLE video_phrases ADD COLUMN phonetic_uk TEXT;
ALTER TABLE video_phrases ADD COLUMN audio_us TEXT;   -- MVP 可留空，用 TTS
ALTER TABLE video_phrases ADD COLUMN audio_uk TEXT;
ALTER TABLE video_phrases ADD COLUMN notes TEXT;
ALTER TABLE video_phrases ADD COLUMN levels TEXT;      -- JSON 数组，与 type 拆分
-- source_sentence_ids 保留(JSON) 或改为关联表
```

- **决策点（相对 spec §7.1 的偏离）**：spec 把类型与难度合并进 `tags`；
  竞品证明应拆为 `type`（表达类型）+ `levels`（难度等级）两个正交维度。建议采纳拆分。
- **收藏**：`word_books` 已支持 `video_id/sentence_id/example/definition_zh/example_zh`，
  collect 直接写入即可，无需新表。

---

## 7. Stage 5 — 服务（API）

- `GET /api/videos/{id}/phrases?type=&collected=&level=`
  → 分页列表，含 `is_collected`（按当前用户 join `word_books`）。
- `POST /api/videos/{id}/phrases/{pid}/collect` · `DELETE ...`
  → 写/删 `word_books`。
- （可选）`POST /api/videos/{id}/analyze-phrases` → 重跑提取，复用/新增 `parse_jobs`。

---

## 8. Stage 6 — 前端模块

- 入口：跟读页 `/video/:id` 底部可折叠「本课重点」面板（spec §9）。
- 卡片：表达 + 美/英音标切换 + `type` 标签 + 中英释义 + 例句(zh/en) + `usagePattern`/`notes` + 收藏星。
- 交互：点卡片/例句 → 播放器 `currentTime = sentence.start_time`（跳原句）。
- 筛选：type chip + collected + level。
- 复用现有 tokens（`--primary` 珊瑚橙等）与 `tag`/`card` 组件。

---

## 9. Stage 7 — 任务编排

- 提取挂进现有 `parse_jobs` 后台线程（Stage 0 之后），进度复用
  `GET /api/videos/jobs/{id}` 轮询。
- LLM 完整版单独成子任务，失败不阻塞视频可用（与 `translate_video` best-effort 一致）。

---

## 10. 待拍板的决策

1. **先做哪一版？** 轻量（Slice 8，快验证）/ 完整（v2，对标竞品）/ 混合（演进）。
2. **发音音频现在做还是延后？** FreeDictionary 音标 + 浏览器 TTS（MVP）vs 预生成发音库（完整版）。
3. **出处关联**用 JSON 字段（`source_sentence_ids`）还是关联表（`video_phrase_occurrences`）？
4. **是否采纳 `type` 与 `levels` 拆分**（偏离 spec §7.1 的合并 `tags`）？

---

## 11. 推荐落地顺序

1. **Slice 8（轻量）**：Stage 0 复用 → Stage 1 轻量提取 → Stage 3 出处关联 →
   Stage 4 基础 `video_phrases`（先不加发音层）→ Stage 5/6 面板 + 收藏。
   验证「用户是否主动用视频级重点清单」。
2. **v2（完整）**：Stage 1 换 LLM 提取多词单位 → Stage 2 词典/LLM 富化 →
   Stage 4 补发音层 + `levels` 拆分 → Stage 3 升级关联表做跨视频统计。
