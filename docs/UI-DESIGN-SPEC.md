# ShadowingMaster UI 设计规范 v1.0（优化版）

> 本文档是 UI 优化的**事实源**，与 `frontend/src/theme.ts` 一一对应。所有组件只能从令牌取值，禁止散落色值 / 字号 / 间距。
> 现状问题：`App.tsx` 为 889 行全内联 style，图标用 emoji，无组件层、无动效、无深色模式。本规范在保留现有暖橙品牌的前提下，补齐组件、图标、动效、深色模式与可访问性体系。

---

## 0. 设计语言与原则

**品牌调性**：温暖、陪伴感、低压力的语言学习氛围。珊瑚橙 = 鼓励与进度，暖米底 = 柔和专注。

**设计原则**
1. **一致性**：同一语义只用同一令牌（如"主按钮"永远 `primary` + `pill`）。
2. **清晰层次**：一屏一个视觉主角（跟读页 = 当前句气泡），其余降噪。
3. **友好反馈**：每次操作都有可见反馈（按压、Toast、状态切换）。
4. **无障碍优先**：WCAG AA 对比度、≥44px 点击区、`focus-visible` 焦点环、`prefers-reduced-motion` 兜底。

**形态**：移动端优先，桌面浏览器收窄为 **480px 居中栏**，左右安全边距 **16px**。

---

## 1. 色彩系统

### 1.1 浅色主题（基于现有令牌，规范化用法）

| 令牌 | 值 | 用途 |
|---|---|---|
| `bg` | `#FFF8F0` | 页面底色（暖米） |
| `surface` | `#FFFFFF` | 卡片 / 气泡 / 弹窗底 |
| `primary` | `#FF7F50` | 品牌、主按钮、当前句边框、选中态 |
| `primarySoft` | `#FFF0E6` | 当前句气泡底、选中 chip 底、聚焦浅底 |
| `text` | `#2D2D2D` | 正文 |
| `textLight` | `#666666` | 次要文字 / 中文字幕 |
| `textMute` | `#9A938A` | 元信息 / 禁用 / 占位（新增） |
| `border` | `#F0E6DC` | 卡片描边 / 分隔线 |
| `hardWord` | `#E74C3C` | 生词 / 跟读差异词（标红） |
| `correct` | `#27AE60` | 跟读正确词 |
| `readBg` | `#F5F5F5` | 已读句气泡底 |

### 1.2 语义状态色（新增）

| 令牌 | 值 | 用途 |
|---|---|---|
| `warning` | `#E1A100` | 中等评分提示（60–79 分） |
| `info` | `#3B82F6` | 极少量信息提示（如解析中） |
| `danger` | `#E74C3C` | 错误 / 删除确认（复用 hardWord） |
| `success` | `#27AE60` | 成功 / 加入生词本完成（复用 correct） |

> 评分文案映射（沿用 `App.tsx` 逻辑）：≥90「发音地道 👍」/ ≥80「很好」/ ≥60「不错，继续练」/ <60「多听多模仿」；对应色 `correct` / `correct` / `warning` / `hardWord`。

### 1.3 深色主题（新增，暖调深底以呼应品牌）

| 令牌 | 值（深色） | 对应浅色 |
|---|---|---|
| `bg` | `#1E1A17` | `#FFF8F0` |
| `surface` | `#2A2420` | `#FFFFFF` |
| `surface2` | `#332C27` | `primarySoft` 区域 |
| `primary` | `#FF8A5C` | `#FF7F50`（略提亮以保对比） |
| `primarySoft` | `rgba(255,127,80,0.16)` | `#FFF0E6` |
| `text` | `#F5EFE8` | `#2D2D2D` |
| `textLight` | `#B4ADA3` | `#666666` |
| `textMute` | `#7C746B` | `#9A938A` |
| `border` | `#3D352F` | `#F0E6DC` |
| `readBg` | `#2A2420` | `#F5F5F5` |

### 1.4 配色规则
- 主色 `primary` 占比 ≤ 15%（主按钮 + 当前句锚点），避免满屏橙。
- 正文与底色对比度 ≥ 4.5:1；大字 ≥ 3:1（WCAG AA）。
- 浅底用 `border` 描边分区，深色底用 `surface2` 抬升分区。

---

## 2. 字体排印

**字体栈**（零外部依赖，沿用）：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Segoe UI", Roboto, "Noto Sans SC", sans-serif`

**字号阶梯**

| 令牌 | px | 行高 | 字重 | 用法 |
|---|---|---|---|---|
| `brand` | 28 | 1.3 | 800 | 登录页 Logo |
| `pageTitle` | 20 | 1.4 | 600 | 页标题 / 列表品牌 |
| `title` | 18 | 1.4 | 600 | 卡片标题 / 词条单词 |
| `sentence` | 17 | 1.7 | 400 | 英文字幕句（跟读核心，最大正文） |
| `body` | 16 | 1.6 | 400 | 按钮 / 输入框 / 跟读结果 |
| `secondary` | 14 | 1.6 | 400 | 中文字幕 / 次要信息 |
| `meta` | 13 | 1.4 | 400 | 时长、句数等元信息 |
| `tiny` | 12 | 1.4 | 400 | 角标 / 提示 |

**字重**：`regular 400` / `semibold 600` / `bold 700` / `heavy 800`。字幕句 1.7 行高保证多行可读。

---

## 3. 间距 · 栅格 · 圆角 · 阴影

**8pt 间距刻度**（沿用）：`4 / 8 / 12 / 16 / 20 / 24 / 32`，页面安全边距 `16`。

**栏宽**：内容最大宽 480px 居中；列表卡片内边距 16，卡片间距 12。

**圆角**

| 令牌 | 值 | 用途 |
|---|---|---|
| `sm` | 8 | 输入框、小标签 |
| `md` | 12 | 卡片、气泡 |
| `lg` | 16 | 大卡、Modal、视频区 |
| `xl` | 20 | 浮层、大按钮 |
| `pill` | 999 | 主按钮、chip、分段控件 |

**阴影分级**（新增 `sm`，沿用 `card`/`float`）

| 令牌 | 值 | 用途 |
|---|---|---|
| `sm` | `0 1px 4px rgba(0,0,0,0.04)` | 输入框聚焦、chip |
| `card` | `0 4px 20px rgba(0,0,0,0.06)` | 卡片 / 气泡 |
| `float` | `0 8px 32px rgba(255,127,80,0.12)` | 底部工具栏、Modal 浮起 |
| `lg` | `0 12px 40px rgba(0,0,0,0.10)` | 全屏弹层 / 拖拽浮卡 |

---

## 4. 动效系统（新增）

**时长**：`fast 150ms` / `normal 250ms` / `slow 350ms`
**缓动**：
- 标准 `cubic-bezier(0.4, 0, 0.2, 1)`（位移、渐显）
- 弹性 `cubic-bezier(0.34, 1.56, 0.64, 1)`（按压回弹、弹层弹出）

**典型动效**

| 场景 | 动效 | 时长 |
|---|---|---|
| 卡片 / 列表项进厂 | 淡入 + 上移 8px | `normal` |
| 按钮按压 | 缩放 0.96 + `primarySoft` 浅底 | `fast` |
| 当前句切换 | 边框 + 浅底过渡（珊瑚橙描边渐显） | `normal` |
| 卡拉OK 逐词点亮 | 词底色 `primarySoft` → `primary` 渐变 | `fast` |
| Toast | 底部上浮 + 淡入，3s 后淡出 | `normal` |
| Modal / BottomSheet | 遮罩淡入 + 内容弹性上推 | `normal` |
| 页面切换 | 整屏淡入 | `normal` |

**兜底**：`@media (prefers-reduced-motion: reduce)` 下所有过渡 ≤ `fast` 且取消位移 / 弹性。

---

## 5. 图标系统（新增，替代 emoji）

**风格**：线性描边，`stroke-width 1.5`，圆角端点（`stroke-linecap: round`），`fill: none`，颜色继承 `currentColor` 以便随状态变色。三档尺寸：`24 / 20 / 16`。

**图标清单**（覆盖当前 emoji 用途）

| 语义 | 名称 | 替换的 emoji | 出现位置 |
|---|---|---|---|
| 返回 | `chevron-left` | `←` | 顶栏返回 |
| 生词本 / 书 | `book` | `📖` | 顶栏、词条来源 |
| 麦克风 | `mic` | `🎤` | 跟读按钮、录音 |
| 播放 | `play` | `▶` | 视频、句子播放 |
| 暂停 | `pause` | `⏸` | 视频播放中 |
| 上一句 | `skip-back` | `⏮` | 底部工具栏 |
| 下一句 | `skip-forward` | `⏭` | 底部工具栏 |
| 设置 | `settings` | `⚙` | 顶栏、底部 |
| 加号 | `plus` | `✚` | 加入生词本 |
| 收藏 | `star` | `⭐` | 句子收藏 |
| 笔记 | `note` | `📝` | 句子笔记 |
| 删除 | `trash` | `🗑` | 生词本移除 |
| 关闭 | `close` | `✕` | Modal / Sheet |
| 循环 | `repeat` | `🔄` | 单句循环 |
| 语言 | `language` | `英中` 文字 | 字幕切换 |
| 主题 | `sun` / `moon` | — | 深色模式切换 |
| 用户 | `user` | `👤` | 个人中心入口 |
| 链接 | `link` | `🔗` | 粘贴 YouTube 链接 |
| 进度 | `target` | `🎯` | 学习进度指示 |

**使用规则**：图标按钮最小点击区 44×44；列表行内图标 20；强调动作用 24 + `primary` 描边。

---

## 6. 组件库规范

> 组件以 **CSS Modules** 实现（Vite 原生支持，零新增依赖），令牌来自扩展版 `theme.ts`。

### 6.1 Button
- **主按钮** `primary`：实心 `#FF7F50`，白字，`pill` 圆角，高 44（lg）/ 36（md）；hover 提亮 + `float` 阴影，active 缩放 0.96。
- **次按钮** `secondary`：白底 + `border` 描边，`text` 字色；hover `primarySoft` 浅底。
- **文字按钮** `text`：无底无框，`primary` 字色，仅用于"先逛逛"等弱化操作。
- **图标按钮** `icon`：44×44 圆角 `md`，`currentColor` 图标；hover `primarySoft` 浅底。
- **状态**：`disabled`（透明度 0.5 + 禁点）、`loading`（按钮内 spinner 替代文字）。

### 6.2 Input
- 默认：白底 + `border` 描边，`md` 圆角，内边距 14，字号 `body`。
- 聚焦：边框转 `primary`，外发光 `0 0 0 3px rgba(255,127,80,0.12)`，`sm` 阴影。
- 错误：边框 `hardWord` + 下方 `hardWord` 提示文字。
- 禁用：底色 `readBg` + `textMute`。

### 6.3 Card / 气泡（字幕三态）
- **已读句**：`readBg` 底 + `border` 描边，中英文字 `textLight`。
- **当前句**：`primarySoft` 底 + `primary` 2px 描边（强锚点），英文 `text`、中文 `textLight`；生词 `hardWord` 加粗 + 浅红底可点。
- **未读句**：`surface` 白底 + `border` 描边，英文 `text`、中文 `textLight`。
- 统一：`md` 圆角、`card` 阴影、内边距 16，切换当前句时 `normal` 过渡。

### 6.4 Chip（字幕语言 / 练习模式）
- 未选：白底 + `border`，`textLight` 字；选中：`primary` 实心白字（或 `primarySoft` 底 + `primary` 字）。
- `pill` 圆角，高 32，内边距左右 16；组间距 8。
- 练习模式组：精听 / 跟读 / 听写 / 挖空，选中态用 `primary` 实心。

### 6.5 Segmented（登录 / 注册）
- 外层 `primarySoft` 浅底 track，`pill` 圆角；选中段 `primary` 实心白字，`normal` 滑块过渡。

### 6.6 Modal（生词释义，居中）
- 遮罩 `rgba(0,0,0,0.4)` 淡入；内容卡 `surface` 白底 `lg` 圆角 `lg` 阴影，内边距 24。
- 头部：单词 + 音标 + 词性；中部：释义；底部：`plus` 加入生词本（主按钮）+ `close` 关闭。
- 弹出：弹性上推 `normal`。

### 6.7 BottomSheet（设置面板，底部）
- 从底部弹性上推，顶部圆角 `xl`，`float` 阴影；拖拽条 + 遮罩。
- 内含：字幕模式（chip 组）、生词高亮开关、单句循环开关、语速滑块、深色模式切换。

### 6.8 Toolbar（跟读页底部固定，毛玻璃）
- 固定底部，背景 `rgba(255,255,255,0.82)` + `backdrop-filter: blur(12px)`，`float` 阴影上缘。
- 左：播放/暂停圆形图标按钮（44）；中：`跟读` 主按钮胶囊（`primary`，高 44，占主宽）；右：设置图标按钮。
- 安全区 `padding-bottom: env(safe-area-inset-bottom)`。

### 6.9 Skeleton（骨架屏）
- 浅底 `readBg` + 流动微光（shimmer `normal`）；形状复用目标组件圆角；用于视频列表、句子加载。

### 6.10 Toast
- 底部上浮（`normal`），`surface` 白底 `md` 圆角 `float` 阴影，左图标 + 文案；3s 自动淡出；最多叠 1 条。

### 6.11 Progress（学习进度）
- 列表卡片：右上角环形进度（已学句 / 总句），`primary` 弧 + `border` 底。
- 视频区：底部细进度条，`primary` 已播 + `surface2` 未播。

---

## 7. 页面布局规范

### 7.1 登录页
- 顶部：珊瑚橙圆形品牌标（SVG 跟读双气泡图形）+ `brand` 字标 + `secondary` 副标题。
- 卡片：内 `Segmented`（登录/注册）+ 邮箱 Input + 密码 Input + 主按钮 `登 录` + `text` 按钮"先逛逛"。
- 底部：一句品牌标语（`textMute`）。

### 7.2 视频列表页
- 顶栏：`pageTitle` 品牌 + 右侧 `book` / `user` 图标按钮。
- 卡片流：封面（16:9，`lg` 圆角，无封面用渐变占位 + `video` 图标）、标题 `title`、元信息 `meta`（时长 · 句数 · 上次学到第 N 句）、右上 `Progress` 环。
- 加载：整列 `Skeleton` 卡片；空：居中插画位 + "还没有视频，去粘贴一个 YouTube 链接吧"。
- 底部浮动 `link` 按钮：粘贴 YouTube 链接触发解析。

### 7.3 跟读页（核心）
- 顶栏：`chevron-left` + 视频标题（截断）+ `book` 图标按钮。
- 视频区：`lg` 圆角黑底 + `play`/`pause` 覆盖 + 底部细进度条。
- 模式条：`Chip` 组（精听/跟读/听写/挖空）+ `language` 切换。
- 字幕列表：竖向气泡（已读/当前/未读三态），当前句强锚点；卡拉OK 逐词点亮；生词红底可点弹 `Modal`。
- 底部 `Toolbar`（毛玻璃）：播放/暂停 + `跟读` 主按钮 + 设置（`BottomSheet`）。
- 跟读结果：气泡下方逐词对比，正确 `correct`、差异 `hardWord` 删除线；评分色条 + 文案。

### 7.4 生词本页
- 顶栏：`chevron-left` + `pageTitle`"生词本" + `settings` 图标。
- 卡片流：单词 `title` + 音标/词性 `meta` + 来源 `book` + 第 N 句；点击跳回原句；`trash` 移除。
- 空：居中插画位 + "跟读时点击生词就能加入这里"。

### 7.5 个人中心页
- 顶栏：`chevron-left` + `pageTitle`"我的"。
- 区块：账号（`user` + 邮箱）、学习统计（卡片：跟读句数 / 视频数 / 生词数）、入口（生词本、笔记、设置、深色模式切换、退出）。

---

## 8. 状态规范（空 / 加载 / 错误）

| 状态 | 处理 |
|---|---|
| 列表加载 | `Skeleton` 卡片 ×3，shimmer 动效 |
| 句子加载 | 气泡区 `Skeleton` 占位 |
| 空生词本 | 居中线性插画（SVG）+ 引导文案 |
| 空视频列表 | 居中插画 + 粘贴链接引导 |
| 视频解析中 | `info` 色 Toast / 进度条 + "解析中…" |
| 解析失败 | `danger` Toast + 重试入口 |
| 输入错误 | Input 错误态 + 下方红字提示 |
| 网络错误 | 顶部红条 / Toast，可重试 |

> 插画统一用线性 SVG（1.5 描边、`primary`/`textMute`），不引入位图资源。

---

## 9. 深色模式适配要点

- 全站走 `data-theme="dark"` 切换，令牌映射见 1.3。
- 阴影在深色下减弱（`float` 改为 `0 8px 32px rgba(0,0,0,0.5)`），避免光晕发灰。
- 毛玻璃工具栏在深色下用 `rgba(42,36,32,0.82)`。
- 珊瑚橙在深色底提亮为 `#FF8A5C` 保对比。
- 用户偏好存 `localStorage`，首次跟随系统 `prefers-color-scheme`。

---

## 10. 可访问性（WCAG AA）

- 正文/底色对比 ≥ 4.5:1，大字 ≥ 3:1（见 1.4）。
- 所有交互元素 `focus-visible` 珊瑚橙焦点环（2px + 2px offset）。
- 点击区 ≥ 44×44（图标按钮、工具栏）。
- 语义化标签 + `aria-label`（图标按钮、进度、模态）。
- `prefers-reduced-motion` 兜底（见 4）。
- 字号支持浏览器缩放至 200% 不破版。

---

## 11. 工程落地约定

- **目录**：`frontend/src/components/{Button,Input,Card,...}/` 各含 `.tsx` + `.module.css`；图标集 `frontend/src/components/icons/`。
- **令牌**：扩展 `theme.ts`（新增 `textMute`、`warning`、`info`、dark 集、`motion`、`shadow.sm/lg`），组件只取令牌。
- **约束**：不新增 npm 依赖（CSS Modules 为 Vite 内置）；不动后端；每片一个 commit。
- **禁止**：手写散落色值 / 字号 / 间距；emoji 作为图标；内联 style 新建组件。

---

_规范版本 v1.0 · 基于 `theme.ts` 与 PRD UI 规范扩展 · 待评审确认后进入实现阶段。_
