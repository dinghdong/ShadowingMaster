# 竞品「地道表达·重点单词」接口解码报告

> 来源：`GET /lang/lesson/knowledge-points?lessonId=2`（shadolab.top）
> 解码对象：`knowledge.json`（`{code:200, data:"<base64>", encrypted:true}`）
> 解码方式：竞品前端内置 **WASM CryptoSDK**（Emscripten `crypto.wasm` + `crypto.js` glue）。
> 加密方案 = **信封加密 + AES-GCM**：客户端 WASM 内置静态 `plainAesKey`，
> 服务端用同一密钥对响应体做 AES-GCM（IV = 密文前 12 字节），`decryptResponse` 在纯 WebCrypto 中解密。
> 解码脚本：`/tmp/shadolab_sdk/loader.mjs`（Node 22，shim 浏览器全局 + `vm` 加载 wasm glue）。

---

## 1. 解码结果概况

解密后是一个**分页列表**响应，本次 `lessonId=2` 共 **69** 条重点表达：

```json
{ "pageNum": 1, "pageSize": 500, "pages": 1, "total": 69, "list": [ ...69 items ] }
```

- `list` 内每条 = 一个「单词 / 短语 / 口语句式 / 搭配」知识点。
- 完整数据见 `knowledge.decoded.json`（207 KB，已 JSON 美化）。
- 前 3 条样例见 `knowledge.sample.json`。

---

## 2. `list` 单条字段逐项注解（共 19 个顶层字段）

| # | 字段 | 类型 | 含义 | 样例 |
|---|------|------|------|------|
| 1 | `knowledgeId` | int | 知识点自身主键 | `128` |
| 2 | `content` | str | 表达/单词本身 | `"bathroom"` |
| 3 | `usPhonetic` | str | 美式音标 | `/ˈbæθˌruːm/` |
| 4 | `ukPhonetic` | str | 英式音标 | `/ˈbɑːθˌruːm/` |
| 5 | `usAudioPath` | str(url) | 美式发音音频 | `…/us8294893624437728.mp3` |
| 6 | `ukAudioPath` | str(url) | 英式发音音频 | `…/uk8294883611427210.mp3` |
| 7 | `enAnnotation` | str | 英文释义 | `a room containing a bathtub…` |
| 8 | `zhAnnotation` | str | 中文释义 | `浴室，卫生间` |
| 9 | `enUsageInstances` | str | 英文例句（**单句字符串**） | `Our apartment has two bathrooms.` |
| 10 | `zhUsageInstances` | str | 中文例句（单句字符串） | `我们的公寓有两个卫生间。` |
| 11 | `pos` | str | 词性 | `名词` |
| 12 | `notes` | str | 用法提示 | `常用'have a bathroom'`（27/69 条有值） |
| 13 | `usagePattern` | str | 搭配/用法公式 | `a bathroom`（49/69 条有值） |
| 14 | `lessonTotal` | int | 出现课程数 | 范围 1–38 |
| 15 | `subtitleTotal` | int | 出现字幕数 | 范围 1–88 |
| 16 | `collected` | bool | 当前用户是否已收藏 | `false`（47/69 为 true） |
| 17 | `subtitleList` | list[obj] | **出现位置明细**（见 §3） | 1–88 条 |
| 18 | `tag` | obj | 类型标签 `{tagId, tagName}` | `{tagId:3, tagName:"单词"}` |
| 19 | `levelList` | list[obj] | 难度/考试等级 `[{levelId, levelName}]` | 雅思/托福/四六级…（35/69 为空） |
| — | `source` | int | 内容来源标记（1=内置词库） | `1` |
| — | `createTime` | str | 创建时间（47/69 有值） | — |

### `tag.tagName` 取值分布（= 类型）
`单词 35` · `短语动词 14` · `短语 9` · `搭配 5` · `口语句式 3` · `惯用表达 3`

### `levelList.levelName` 取值（= 难度/考试等级，多选）
雅思 30 · 托福 21 · 四级 10 · 四六级 11 · 专四 8 · 六级 5 · 专八 4 · 考研 4 · 高考 4 · 中考 4 · 日常口语 7 · 通用 2 · 口语 1 · 医学英语 1 · 商务英语 1 · …（长尾）

---

## 3. `subtitleList[]` 子结构（出现位置 = 可回跳原句）

每条知识点附带它**在哪些字幕里出现过**，字段非常完整（含媒体路径与时间轴）：

```json
{
  "lessonId": 182,
  "lessonNum": 39,
  "lessonTitle": "绝望主妇S01E07_part39",
  "subtitleId": 16119,
  "audioPath": "https://static.shadolab.top/lang/lesson/3/39/audioList/DH_S01E07_part_39_15.mp3",
  "videoPath": "https://static.shadolab.top/lang/lesson/3/39/filmList/DH_S01E07_part_39_15.mp4",
  "startTime": 54570,
  "endTime": 56300,
  "zhContent": "先去厕所然后回家",
  "enContent": "I'm going to the bathroom and then I'm going home."
}
```

→ 点击生词可直接跳到**出处的音视频片段 + 起止时间 + 中英字幕**。这对 shadowing 体验是关键能力。

---

## 4. 与我们 `video_phrases` 设计（`docs/VIDEO-VOCABULARY-SPEC.md` §7.1）的对照

| 竞品字段 | 我们的 `video_phrases` 列 | 映射关系 |
|----------|---------------------------|----------|
| `content` | `phrase` | ✅ 1:1 |
| `tag.tagName` | `type` (word/phrase/phrasal_verb/idiom/collocation/oral_pattern) | ✅ **完全对齐**：单词→word，短语→phrase，短语动词→phrasal_verb，惯用表达→idiom，搭配→collocation，口语句式→oral_pattern |
| `pos` | `pos` | ✅ 1:1 |
| `zhAnnotation` | `meaning_zh` | ✅ 1:1 |
| `enAnnotation` | `meaning_en` | ✅ 1:1 |
| `enUsageInstances` | `example` | ✅ 1:1（竞品是单句字符串，与我们的 `TEXT` 一致） |
| `zhUsageInstances` | `example_zh` | ✅ 1:1 |
| `usagePattern` | `collocations`（JSON 数组） | ⚠️ 竞品是**单字符串公式**，我们设计为数组——落库时可包成 `[usagePattern]` |
| `notes` | （无对应列） | ❌ **缺失**，建议新增 `notes TEXT` |
| `collected` | `is_collected` | ✅ 1:1（bool） |
| `subtitleTotal` | `occurrence_count` | ✅ 可映射（出现字幕数 = 出现次数） |
| `subtitleList[].subtitleId` | `source_sentence_ids`（JSON 数组） | ⚠️ 我们只存 id；竞品额外带 `lessonId / audioPath / videoPath / startTime / endTime / zh+en 字幕` |
| `levelList[].levelName` | `tags`（JSON 数组） | ⚠️ 竞品把「类型(`tag`)」和「难度等级(`levelList`)」**拆成两个维度**；我们合并进一个 `tags`。建议拆开 |
| `us/ukPhonetic` | （无） | ❌ **缺失**，shadowing 强相关，建议新增 `phonetic_us / phonetic_uk` |
| `us/ukAudioPath` | （无） | ❌ **缺失**，发音跟读必需，建议新增 `audio_us / audio_uk` |
| `lessonTotal` | （无） | ❌ 缺失（跨课程出现数，可作统计） |
| `knowledgeId` | `id` | ✅ 主键 |
| `source` / `createTime` | `created_at` | 部分覆盖 |

### 关键差异小结
1. **类型维度对齐得很好**：竞品的 6 类 `tagName` 与我们的 `type` 枚举一一对应，说明我们的分类法合理。
2. **我们缺发音层**：音标（美/英）+ 发音音频路径在竞品中是标配，且对 shadowing 产品至关重要——建议补 `phonetic_us/uk`、`audio_us/uk`。
3. **来源上下文更弱**：竞品 `subtitleList` 自带媒体路径与时间轴，点词即跳转原片段；我们仅存 `source_sentence_ids`，需依赖 `sentences` 表是否含 `audio_path/video_path/start/end`，否则会丢失跳转能力。
4. **类型 vs 难度应分列**：竞品把 `tag`（表达类型）和 `levelList`（考试/难度等级）分开，我们合并进 `tags` 会丢失维度，建议拆为 `type` + `levels`。
5. **用法字段**：竞品有 `usagePattern`（搭配公式）+ `notes`（提示），我们只有 `collocations`；建议新增 `notes` 并把 `usagePattern` 纳入 `collocations`。

---

## 5. 给视频词汇功能的落地建议（候选清单）

- [ ] 扩展 `video_phrases`：加 `phonetic_us`, `phonetic_uk`, `audio_us`, `audio_uk`, `notes`, `levels`(JSON)，并将 `type` 与 `levels` 拆开。
- [ ] `source_sentence_ids` 跳转：确保 `sentences` 表带 `audio_path`/`video_path`/`start_time`/`end_time`（或冗余存储在 `video_phrases`）。
- [ ] 收藏态 `is_collected` 走用户维度（竞品 `collected` 是「当前用户是否收藏」，需 `user_word_books` 关联）。
- [ ] `occurrence_count` 用竞品 `subtitleTotal`（字幕出现数）而非 `lessonTotal`（课程数）。
- [ ] 复用竞品 `tagName → type` 映射直接做为种子数据分类。
