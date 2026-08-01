# 视频重点表达（地道表达·重点单词）功能方案

> 状态：方案草案（待评审）  
> 基于竞品截图与 ShadowingMaster 当前现状，提供可落地的两版路径。

---

## 1. 背景与目标

竞品在每个视频底部提供了一块「地道表达 · 重点单词」区域，把视频里值得学习的语言点以卡片形式汇总，支持按类型筛选、收藏、看释义例句。

对我们的价值：
- 当前产品只能「在跟读句子时顺手查词收藏」，缺少一个**课后总览/复习入口**。
- 这块区域能把「看视频」和「记表达」两件事更紧密地绑定，提升用户学完一个视频后的获得感。
- 如果数据结构化做得好，未来还能跨视频做「这个表达你在 N 个视频里见过」。

---

## 2. 竞品功能拆解

从截图看，竞品卡片包含：

| 元素 | 说明 |
|------|------|
| 分类筛选 | 全部、单词、口语句式、惯用表达、搭配、短语、短语动词、已收藏、批量收藏 |
| 卡片头部 | 表达/单词 + 英/美音标 + 「添加到单词本」 |
| 标签 | 单词/名词/动词/短语/日常口语/托福/雅思/中考/四六级 |
| 释义 | 中文释义 + 英文释义 |
| 例句 | 原句（中英对照） |
| 搭配模式 | 常见搭配/用法公式 |
| 出现统计 | 「在往期中出现 X 次」 |

本质：**视频的「课后语言点清单」**，把被动查词升级成主动学习材料。

---

## 3. 与现有 ShadowingMaster 的关系

当前已具备：
- 句级生词高亮（基于 5000 常用词表）
- 点词查词 + 弹窗释义（FreeDictionary + MyMemory 翻译）
- 「加入生词本」+ 生词本页面
- 生词可跳回原视频原句

新功能**不是替代**现有流程，而是**补充**：

| 场景 | 现有功能 | 新功能 |
|------|----------|--------|
| 学句子时遇到生词 | 点词查词 → 收藏 | 保持不变 |
| 学完整个视频后想复习 | 只能去生词本翻 | 视频底部直接给重点清单 |
| 想看视频里有哪些地道表达 | 没有 | 系统预提取 + 分类展示 |

**关键打通点**：重点表达卡片支持一键「加入生词本」，与现有生词本完全互通。

---

## 4. 方案总览

考虑到当前还在 MVP 阶段（切片已排到 Slice 7），我给出**两版路径**：

- **方案一 · 轻量版**：复用现有数据（5000 词表判定出的生词），最快 1-2 个切片落地，先验证用户是否真需要这个入口。
- **方案二 · 完整版**：引入 AI/LLM 分析字幕，真正提取「地道表达、搭配、习语」，对标竞品，适合 v2。

---

## 5. 方案一 · 轻量版（推荐先做）

### 5.1 数据从哪来

直接复用当前 `shared.ts` 里的 `isHardWord()` 逻辑：
- 取本视频所有句子的 `english_text`。
- 按空格/标点分词，去掉 5000 常用词表里的词。
- 去重，得到「本视频重点词列表」。

> 当前 `vocabulary_words` 表已有但为空（`import_video.py` 未填充），轻量版可以前端实时计算，也可以后端补一个简单填充脚本。

### 5.2 展示什么

在跟读页底部加一个可折叠面板「本课重点」：
- 顶部 chip：全部 / 名词 / 动词 / 形容词 / 副词 / 其他（基于 FreeDictionary 返回的词性）。
- 卡片内容：
  - 单词
  - 音标（FreeDictionary）
  - 词性标签
  - 中文释义
  - 一条来自本视频的例句（中英对照）
  - 「加入生词本」按钮
  - 点击卡片/例句可跳回原句

### 5.3 优点
- 不引入新 AI 依赖，不破坏依赖白名单。
- 1-2 周内可落地。
- 能验证「用户是否会主动使用视频级重点清单」。

### 5.4 局限
- 只能展示「难词」，无法识别「地道表达、搭配、习语」这类多词单位。
- 质量取决于 5000 词表，会有误杀/漏网。

---

## 6. 方案二 · 完整版（v2）

### 6.1 数据从哪来

在 `fetch_video.py` 的入库流程里增加一步 **AI 分析**：
- 输入：视频的所有英文字幕句。
- 调用 LLM（如 OpenAI/Claude/国产大模型 API）。
- 输出结构化 JSON，例如：

```json
[
  {
    "phrase": "suit yourself",
    "type": "idiom",
    "pos": "verb phrase",
    "meaning_zh": "随你便；你想怎样就怎样",
    "meaning_en": "Used to tell someone they can do what they want...",
    "example": "If you don't want to come, suit yourself.",
    "example_zh": "如果你不想来，随你便。",
    "collocations": ["suit + reflexive pronoun"],
    "tags": ["日常口语"],
    "source_sentence_ids": [12]
  }
]
```

### 6.2 类型定义

| type | 对应竞品分类 | 例 |
|------|-------------|-----|
| `word` | 单词 | bathroom, honestly |
| `phrase` | 短语 | in advance |
| `phrasal_verb` | 短语动词 | come up with, look forward to |
| `idiom` | 惯用表达 | suit yourself, break the ice |
| `collocation` | 搭配 | a type of plastic, red collar |
| `oral_pattern` | 口语句式 | Honestly, + statement |

### 6.3 展示什么

基本对齐竞品截图：
- 分类筛选：全部、单词、口语句式、惯用表达、搭配、短语、短语动词、已收藏。
- 卡片：表达/单词、音标、分类标签、中英释义、例句、搭配模式、出现次数、收藏。
- 跨视频统计：记录该表达在全部视频中的出现次数。

### 6.4 优点
- 真正对标竞品，差异化竞争力强。
- 数据结构化后，可衍生复习、测试、跨视频推荐。

### 6.5 风险
- 引入 AI 调用，增加成本、延迟、失败处理。
- 需要设计 prompt + 输出校验，开发量显著大于轻量版。
- 需要新增后端分析任务表，和现有 `parse_jobs` 并行或扩展。

---

## 7. 数据模型设计

### 7.1 新表 `video_phrases`

```sql
CREATE TABLE IF NOT EXISTS video_phrases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    phrase TEXT NOT NULL,              -- 表达/单词本身
    type TEXT NOT NULL,                -- word | phrase | phrasal_verb | idiom | collocation | oral_pattern
    pos TEXT,                          -- 词性（noun/verb/adj/adv/...）
    meaning_zh TEXT,                   -- 中文释义
    meaning_en TEXT,                   -- 英文释义
    example TEXT,                      -- 来自视频的例句
    example_zh TEXT,                   -- 例句中文
    collocations TEXT,                 -- JSON 数组，搭配/用法公式
    tags TEXT,                         -- JSON 数组，如 ["日常口语", "雅思"]
    source_sentence_ids TEXT,          -- JSON 数组，关联 sentences.id
    occurrence_count INTEGER DEFAULT 1, -- 在本视频/全库出现次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE INDEX IF NOT EXISTS idx_video_phrases_video_type ON video_phrases(video_id, type);
```

### 7.2 与现有表关系

- `video_phrases` → `word_books`：用户点击「加入生词本」时，把 phrase 作为 word 写入 `word_books`，并带上 `video_id` / `sentence_id` / `definition_zh` / `example`。
- `video_phrases.source_sentence_ids` → `sentences.id`：点击例句可跳回原句。

---

## 8. API 设计草案

### 8.1 获取视频重点表达

```
GET /api/videos/{video_id}/phrases?type=word& collected=false
```

返回：
```json
{
  "video_id": 1,
  "phrases": [
    {
      "id": 1,
      "phrase": "suit yourself",
      "type": "idiom",
      "pos": "verb phrase",
      "meaning_zh": "随你便",
      "meaning_en": "Used to tell someone they can do what they want...",
      "example": "If you don't want to come, suit yourself.",
      "example_zh": "如果你不想来，随你便。",
      "collocations": ["suit + reflexive pronoun"],
      "tags": ["日常口语"],
      "occurrence_count": 5,
      "is_collected": false
    }
  ]
}
```

### 8.2 收藏/取消收藏重点表达

```
POST /api/videos/{video_id}/phrases/{phrase_id}/collect
DELETE /api/videos/{video_id}/phrases/{phrase_id}/collect
```

行为：写入/删除 `word_books` 表，与现有生词本打通。

### 8.3 触发 AI 分析（仅完整版）

可复用现有 `parse_jobs` 机制，在视频解析流程中自动执行；或单独提供：

```
POST /api/videos/{video_id}/analyze-phrases
```

返回任务 ID，前端轮询进度。

---

## 9. UI 结构草案

### 9.1 入口位置

推荐放在**跟读页底部**，作为一个可折叠/锚定的区域：
- 用户学完几个句子后，自然向下滚动就能看到。
- 不需要新增页面，保持 MVP 简洁。
- 窄屏时与练习台上下堆叠；桌面端可放在右侧句子列表下方或底部面板。

### 9.2 组件结构

```
┌──────────────────────────────────────┐
│  本课重点                [展开 ▼]     │  ← 面板头部
├──────────────────────────────────────┤
│  [全部] [单词] [短语] [习语] [搭配] … │  ← 分类 chip 筛选
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ suit yourself        [☆ 收藏]  │  │
│  │ 英 /suːt/  惯用表达  日常口语   │  │
│  │ 随你便；你想怎样就怎样           │  │
│  │ If you don't want to come...   │  │
│  │ 搭配：suit + 反身代词            │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ bathroom             [☆ 收藏]  │  │
│  │ ...                            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 9.3 视觉规范

沿用现有 tokens：`--primary`（珊瑚橙）、`--surface`、`--card`、卡片阴影、chip 样式。
- 收藏态用 `starFill` 图标 + 主色。
- 分类标签用现有 `tag` 组件变体。
- 保持移动端优先，卡片单列；桌面端可两列网格。

---

## 10. 待确认问题

在动手前需要你对齐以下决策：

1. **先做哪一版？**
   - 轻量版：快速验证，但质量一般。
   - 完整版：对标竞品，但工作量和复杂度显著更高。
2. **是否接受引入 AI/LLM？**
   - 当前依赖白名单外新增 LLM SDK/HTTP 调用需要在 PRD 记录理由。
3. **入口放哪里？**
   - 倾向跟读页底部折叠面板；也可以做独立页面 `/video/:id/phrases`。
4. **分类标签是否要对齐竞品？**
   - 轻量版只能按词性分；完整版才能做到「口语句式/惯用表达/搭配/短语动词」。
5. **数据来源是否复用 `vocabulary_words` 表？**
   - 当前该表为空，轻量版可以前端实时算；完整版必须写 `video_phrases` 新表。

---

## 11. 推荐结论

**建议先走方案一 · 轻量版**，作为 **Slice 8**：
- 目标：在跟读页底部加一个「本课重点」折叠面板，展示本视频 isHard 单词，支持筛选、查释义、加入生词本、跳回原句。
- 价值：用最小成本验证「用户是否会主动使用视频级重点清单」。
- 如果数据正向，下一个切片升级到方案二 · 完整版，引入 AI 分析地道表达。

这样不会拖慢现有 MVP 进度，也能为 v2 的功能积累经验。
