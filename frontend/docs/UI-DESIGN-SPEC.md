# ShadowingMaster UI 设计规范 v1.1

> **事实源（单一可信源）**：`frontend/src/tokens.css`（CSS 令牌）+ `frontend/src/theme.ts`（TS 令牌）+ `frontend/src/components.css`（组件类实现）。
> 组件类只允许引用 `var(--xxx)`；TS 组件只允许引用 `theme.ts` 导出。禁止散落硬编码色值 / 字号 / 间距 / 阴影。
>
> **本文档是规范事实源**，与 `tokens.css` 一一对应，并随实现演进。下方所有视觉值以 `tokens.css` 当前内容为准（v1.1 已对齐实际实现，修正了 v1.0 与 `tokens.css` 漂移的深色令牌与阴影分级）。
>
> **v1.0 → v1.1 变更**：① 色彩 / 阴影令牌全部对齐 `tokens.css`（深色底、阴影分级 `xs/sm/md/lg/float`）；② 新增「布局与导航系统」（DesktopShell + TopNav、移动端 480 栏、900px 断点）；③ 跟读页补全四种练习模式（精听 / 跟读 / 听写 / 挖空）与句子收藏 / 笔记；④ 合并 Loading 规范（Spinner / 骨架屏 / 提交态）；⑤ 补充落地页（Landing）与添加视频页规范；⑥ 强化可访问性条款（对比度实测值、焦点环、触控区、缩放）。

---

## 0. 设计语言与原则

**品牌调性**：温暖、陪伴感、低压力的语言学习氛围。珊瑚橙 = 鼓励与进度，暖米底 = 柔和专注。

**设计原则**
1. **一致性**：同一语义只用同一令牌（"主按钮"永远 `primary` + `pill`；"当前句"永远 `primarySoft` 底 + `primary` 描边）。
2. **清晰层次**：一屏一个视觉主角（跟读页 = 当前句气泡），其余降噪。
3. **友好反馈**：每次操作都有可见反馈（按压回弹、Toast、状态切换、加载态）。
4. **无障碍优先**：WCAG AA 对比度、`≥44px` 点击区、`focus-visible` 焦点环、`prefers-reduced-motion` 兜底。
5. **令牌唯一**：所有视觉决策收敛到令牌；不新增 npm 依赖（CSS 原生 / Vite 内置能力）。

**形态**：移动端优先，单列；桌面浏览器（≥900px）走 `DesktopShell` 顶部全局导航 + 主内容区。内容最大宽 **480px**（移动）/ 跟读页桌面双栏（≤1240px）。

---

## 1. 令牌系统（Design Tokens）

> 以下数值为 `tokens.css` 当前真实值（v1.1 已核对）。新增令牌必须同步写入 `tokens.css` 与 `theme.ts` 两处，禁止单边新增。

### 1.1 色彩 · 浅色主题

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg` | `#FFF8F0` | 页面底色（暖米） |
| `--surface` | `#FFFFFF` | 卡片 / 气泡 / 弹窗底 |
| `--surface-2` | `#FFF0E6` | 主色浅底（当前句 / 选中 chip / 聚焦浅底） |
| `--surface-3` | `#FAF3EC` | 次级浅底（禁用以浅底） |
| `--primary` | `#FF7F50` | 品牌、主按钮、当前句描边、选中态 |
| `--primary-strong` | `#F26B3D` | 主色按压态 |
| `--primary-soft` | `#FFF0E6` | 主色 8% 浅底（卡拉OK 逐词点亮 / 聚焦光晕） |
| `--on-primary` | `#FFFFFF` | 主色之上的文字（主按钮白字） |
| `--text` | `#2D2D2D` | 正文 |
| `--text-2` | `#666666` | 次要文字 / 中文字幕 |
| `--text-3` | `#9A9A9A` | 元信息 / 占位符 |
| `--border` | `#F0E6DC` | 卡片描边 / 分隔线 |
| `--border-strong` | `#E6D6C6` | 强分隔 / 输入框聚焦前描边 |
| `--danger` | `#E74C3C` | 生词 / 跟读差异词 / 错误 |
| `--success` | `#27AE60` | 跟读正确 / 加入生词本完成 |
| `--warning` | `#E1A100` | 中等评分提示（60–79） |
| `--info` | `#FF7F50` | 信息提示（同主色，极少量如"解析中"） |
| `--read-bg` | `#F5F5F5` | 已读句气泡底 |
| `--scrim` | `rgba(45,30,20,0.42)` | Modal / 浮层遮罩 |
| `--scrim-soft` | `rgba(45,30,20,0.06)` | 浅遮罩 / 禁用蒙层 |
| `--scrim-strong` | `rgba(28,22,20,0.9)` | 强遮罩（Toast 等不透明浮层） |

### 1.2 色彩 · 深色主题（暖调深底呼应品牌）

全站经 `data-theme="dark"` 切换（持久化 `localStorage`，首访跟随 `prefers-color-scheme`，见 §9）。

| 令牌 | 深色值 | 对应浅色 |
|---|---|---|
| `--bg` | `#1A1614` | `#FFF8F0` |
| `--surface` | `#2A2422` | `#FFFFFF` |
| `--surface-2` | `#3A2E2A` | `#FFF0E6` |
| `--surface-3` | `#322A27` | `#FAF3EC` |
| `--primary` | `#FF8C61` | `#FF7F50`（提亮保对比） |
| `--primary-strong` | `#FF7A4D` | `#F26B3D` |
| `--primary-soft` | `#3A2A24` | `#FFF0E6` |
| `--on-primary` | `#1A1614` | `#FFFFFF` |
| `--text` | `#F5EFEA` | `#2D2D2D` |
| `--text-2` | `#B8AEA8` | `#666666` |
| `--text-3` | `#8A817C` | `#9A9A9A` |
| `--border` | `#3A322E` | `#F0E6DC` |
| `--border-strong` | `#4A403A` | `#E6D6C6` |
| `--danger` | `#FF6B5E` | `#E74C3C` |
| `--success` | `#4FD07F` | `#27AE60` |
| `--warning` | `#FFC24B` | `#E1A100` |
| `--info` | `#FF8C61` | `#FF7F50` |
| `--read-bg` | `#241F1D` | `#F5F5F5` |
| `--scrim` | `rgba(0,0,0,0.6)` | `rgba(45,30,20,0.42)` |
| `--scrim-soft` | `rgba(255,255,255,0.05)` | `rgba(45,30,20,0.06)` |
| `--scrim-strong` | `rgba(0,0,0,0.85)` | `rgba(28,22,20,0.9)` |

### 1.3 语义状态色用法

| 语义 | 令牌 | 应用场景 |
|---|---|---|
| 成功 / 正确 | `--success` | 跟读正确词、加入生词本完成、听写/挖空答对 |
| 提示 / 信息 | `--info` | 极少量信息（= 主色），如视频"解析中" |
| 警示 / 中等 | `--warning` | 评分 60–79「不错，继续练」 |
| 错误 / 生词 / 差异 | `--danger` | 生词标红、跟读差异词删除线、输入错误、解析失败 |

> 评分文案映射：`≥90`「发音地道」/ `≥80`「很好」/ `≥60`「不错，继续练」/ `<60`「多听多模仿」；对应色 `success` / `success` / `warning` / `danger`。

### 1.4 阴影分级

| 令牌 | 值（浅色） | 值（深色） | 用途 |
|---|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(45,45,45,0.05)` | `0 1px 2px rgba(0,0,0,0.4)` | 极轻抬升 |
| `--shadow-sm` | `0 2px 8px rgba(45,45,45,0.06)` | `0 2px 8px rgba(0,0,0,0.45)` | 输入框聚焦、chip |
| `--shadow-md` | `0 4px 20px rgba(45,45,45,0.07)` | `0 4px 20px rgba(0,0,0,0.5)` | 卡片 / 气泡 |
| `--shadow-lg` | `0 8px 32px rgba(255,127,80,0.14)` | `0 8px 32px rgba(255,140,97,0.18)` | 底部工具栏 / Modal 浮起 |
| `--shadow-float` | `0 12px 40px rgba(255,127,80,0.20)` | `0 12px 40px rgba(255,140,97,0.22)` | 全屏弹层 / 拖拽浮卡 |

### 1.5 间距 · 圆角 · 层级

**间距（8pt 刻度）**：`--sp-1=4 / --sp-2=8 / --sp-3=12 / --sp-4=16 / --sp-5=20 / --sp-6=24 / --sp-7=32 / --sp-8=40`；页面左右安全边距 `--sp-page=16`。

**圆角**：`--r-xs=6 / --r-sm=8 / --r-md=12 / --r-lg=16 / --r-xl=20 / --r-pill=999`。

**层级（z-index）**：`--z-sticky=20`（顶栏吸顶）/ `--z-toast=1100` / `--z-popover=1201` / `--z-modal=1300`。

### 1.6 字体排印

**字体栈**（零外部依赖）：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Segoe UI", Roboto, "Noto Sans SC", sans-serif`

| 令牌 | px | 行高 | 字重 | 用法 |
|---|---|---|---|---|
| `--fs-brand` | 28 | 1.3 | 800 | 落地页 Logo 字标 |
| `--fs-pageTitle` | 20 | 1.4 | 600 | 页标题 / 列表品牌 |
| `--fs-title` | 18 | 1.4 | 600 | 卡片标题 / 词条单词 |
| `--fs-sentence` | 17 | 1.7 | 400 | 英文字幕句（跟读核心，最大正文） |
| `--fs-body` | 16 | 1.6 | 400 | 按钮 / 输入框 / 跟读结果 |
| `--fs-secondary` | 14 | 1.6 | 400 | 中文字幕 / 次要信息 |
| `--fs-meta` | 13 | 1.4 | 400 | 时长、句数等元信息 |
| `--fs-tiny` | 12 | 1.4 | 400 | 角标 / 提示 |

**字重**：`regular 400` / `medium 500` / `semibold 600` / `bold 700` / `heavy 800`。字幕句 1.7 行高保证多行可读。

### 1.7 动效

**时长**：`--dur-fast=150ms` / `--dur-normal=300ms` / `--dur-slow=500ms`
**缓动**：标准 `--ease=cubic-bezier(0.4,0,0.2,1)`（位移、渐显）；弹性 `--ease-spring=cubic-bezier(0.34,1.56,0.64,1)`（按压回弹、弹层弹出）。

| 场景 | 动效 | 时长 |
|---|---|---|
| 卡片 / 列表项进厂 | 淡入 + 上移 8px（`sm-fade-up`） | normal |
| 按钮按压 | 缩放 0.96 + `primarySoft` 浅底 | fast |
| 当前句切换 | 边框 + 浅底过渡（珊瑚橙描边渐显） | normal |
| 卡拉OK 逐词点亮 | 词底色 `primarySoft` → `primary` 渐变 | fast |
| Toast | 底部上浮 + 淡入，3s 后淡出（`sm-toast-in`） | normal |
| Modal / 弹层 | 遮罩淡入 + 内容弹性缩放上推（`sm-modal-in` / `sm-backdrop-in`） | normal |
| 页面切换 | 整屏淡入 | normal |
| 录音 REC | 脉冲缩放（`sm-rec`） | slow 循环 |
| 光环扩散 | 外环扩散淡出（`sm-halo`） | slow 循环 |

**兜底**：`@media (prefers-reduced-motion: reduce)` 下所有 transition/animation 时长归零、取消位移与弹性（已在 `tokens.css` 全局生效）。

### 1.8 配色规则

- 主色 `--primary` 占比 ≤ 15%（主按钮 + 当前句锚点 + 选中态），避免满屏橙。
- 正文/底色对比度 ≥ 4.5:1，大字 ≥ 3:1（WCAG AA，实测见 §10）。
- 浅底用 `--border` 描边分区；深色底用 `--surface-2` 抬升分区。
- 文字按钮 / 链接用 `--primary`；禁用态用 `opacity:0.5` + `cursor:not-allowed`，不做颜色反转。

---

## 2. 布局与导航系统

### 2.1 形态与断点

| 视口 | 布局 | 导航 |
|---|---|---|
| 移动端 `<900px` | 单列，内容最大宽 480px 居中；左右安全边距 16px | 列表/生词本/个人中心/添加视频：全局 `TopNav`（吸顶）；跟读页：页面内部 `.navbar--keep`（返回/标题/生词本/设置） |
| 桌面端 `≥900px` | `DesktopShell`：顶部 `TopNav` + 主内容区；跟读页双栏（视频+练习台 / 字幕列表，≤1240px 居中） | 全局 `TopNav`（品牌 + 标签 + 搜索 + 添加 + 主题 + 头像/登录） |
| 落地页 / 登录页 | 独立全屏（不走 Shell） | 落地页自带品牌与主题切换；登录页自带品牌头 |

**断点约定**：仅一个关键断点 `900px`（移动 ↔ 桌面）。跟读页双栏在 `≥900px` 启用，并配合 `.practice-skeleton` 双栏骨架防止布局跳动。

### 2.2 全局导航 `DesktopShell` + `TopNav`

- **结构**：`<DesktopShell>` = 吸顶 `<TopNav>`（`position:sticky; top:0; z:var(--z-sticky)`）+ `<main class="shell__main">` 主内容区。
- **品牌**：左 `ShadowingMaster` 字标 + 暖橙 tile favicon，点击回落地页。
- **主导航标签**：`视频列表` / `生词本` / `个人中心`（当前页 `aria-current="page"` + `--primary` 文字激活态）。
- **搜索**：列表/生词本页右侧出现；移动端折叠为图标（点击展开），桌面端常驻输入（`topnav__search`）。
- **操作区**：`添加视频`（主按钮胶囊）+ 主题切换（`sun`/`moon`）+ 头像（`user`，进个人中心）或 `登录`（主按钮）。
- **自适应**：全部走令牌，浅/深主题自动适配；`backdrop-filter` 毛玻璃底 `+1px --border` 分隔。

### 2.3 跟读页导航

- **桌面（≥900px）**：复用 `DesktopShell` + `TopNav`（与列表/生词本一致，统一头部仪式感）。
- **移动（<900px）**：不包 Shell，页面内部 `.navbar--keep` 提供 `← 返回 / 视频标题（省略）/ 生词本 / 设置齿轮`，沿用已调好的移动端布局（CSS 在 `≥900px` 隐藏 `.navbar--keep`）。
- **设置齿轮**：保留在跟读页内部（`navbar__actions`），不开到顶 nav，避免桌面顶 nav 过挤。

---

## 3. 图标系统

**风格**：线性描边，`stroke-width:1.5`，圆角端点（`stroke-linecap:round`），`fill:none`，颜色继承 `currentColor` 随状态变色。三档尺寸 `24 / 20 / 16`。**禁止 emoji 作图标**（已全量替换）。

| 语义 | 名称 | 出现位置 |
|---|---|---|
| 返回 | `arrowLeft` / `chevron-left` | 顶栏返回、搜索收起 |
| 生词本 / 书 | `book` | 顶栏、词条来源 |
| 麦克风 | `mic` | 跟读按钮、录音 |
| 播放 / 暂停 | `play` / `pause` | 视频、句子播放 |
| 上一句 / 下一句 | `skip-back` / `skip-forward` | 底部工具栏 |
| 设置 | `settings` | 顶栏、底部、生词本 |
| 加号 | `plus` | 加入生词本、添加视频 |
| 收藏 | `star` / `starFill` | 句子收藏（选中实心） |
| 笔记 | `note` | 句子笔记（有内容显角标） |
| 删除 | `trash` | 生词本移除 |
| 关闭 | `close` | Modal / Sheet / 搜索清除 |
| 循环 | `repeat` | 单句循环 |
| 语言 | `language` | 字幕切换 |
| 主题 | `sun` / `moon` | 深浅色切换 |
| 用户 | `user` | 个人中心 / 头像 |
| 链接 | `link` | 粘贴 YouTube 链接 |
| 进度 | `target` | 学习进度指示 |
| 发声 | `volume` | 单词/例句朗读 |
| 回到原句 | `reply` | 生词本跳回 |
| 复制 | `copy` | 句子复制 |
| 搜索 | `search` | 顶栏搜索 |
| 锁定 | `lock` | 精听字幕隐藏态 |

**使用规则**：图标按钮最小点击区 `44×44`；列表行内图标 `20`；强调动作用 `24` + `primary` 描边。

---

## 4. 组件库规范

> 组件以 **原生 CSS 类 + 令牌** 实现（`components.css`），JS 组件封装在 `frontend/src/components/` 与 `features/`。令牌来自 `tokens.css`，TS 取 `theme.ts`。

### 4.1 Button
- **主按钮** `btn--primary`：实心 `--primary`，`--on-primary` 白字，`--r-pill` 圆角，高 44（lg）/ 36（md，`btn--sm`）；hover 提亮 + `--shadow-lg`；active 缩放 0.96 + `--primary-strong` 底。
- **次/幽灵按钮** `btn--ghost`：白底（`--surface`） + `--border` 描边，`--text` 字色；hover `--surface-2` 浅底。
- **文字按钮** `btn--text`：无底无框，`--primary` 字色，仅用于弱化操作（如"先逛逛"）。
- **块级** `btn--block`：宽度撑满父容器（弹窗底部主操作）。
- **图标按钮** `icon-btn`（/ `--plain`）：`44×44`，`--r-md` 圆角，`currentColor` 图标；hover `--surface-2` 浅底。
- **状态**：`disabled`（透明度 0.5 + `cursor:not-allowed`）；`loading`（按钮内 `<Spinner>` 替代文字，见 §8）。

### 4.2 Input
- 默认：白底（`--surface`）+ `--border` 描边，`--r-md` 圆角，内边距 14，字号 `--fs-body`。
- 聚焦：边框转 `--primary`，外发光 `0 0 0 3px --primary-soft`，`--shadow-sm`。
- 错误：边框 `--danger` + 下方 `--danger` 提示文字。
- 禁用：底色 `--surface-3` + `--text-3`。
- `textarea.input`：听写用，`resize:none`，检查后底色 `color-mix(in srgb, var(--text) 3%, transparent)`。

### 4.3 Card / 气泡（字幕三态）
- **已读句**：`--read-bg` 底 + `--border` 描边，中英文字 `--text-2`。
- **当前句**：`--surface-2` 底 + `--primary` 2px 描边（强锚点），英文 `--text`、中文 `--text-2`；生词 `--danger` 加粗 + 浅红底（`color-mix`）可点；卡拉OK 逐词点亮（活动词 `--primary` 字 + `--primary-soft` 底 + 下划线）。
- **未读句**：`--surface` 白底 + `--border` 描边，英文 `--text`、中文 `--text-2`。
- 统一：`--r-md` 圆角、`--shadow-md`、内边距 16，切换当前句时 `--dur-normal` 过渡。句子序号水印 `.sentence__wm`（`--wm-faint` 几何无衬线，装饰，`aria-hidden`）。

### 4.4 Chip（字幕语言 / 练习模式）
- 未选：白底 + `--border`，`--text-2` 字；选中：`--primary` 实心 `--on-primary` 字（或 `--surface-2` 底 + `--primary` 字）。
- `--r-pill` 圆角，高 32，内边距左右 16；组间距 8。练习模式组：精听 / 跟读 / 听写 / 挖空。

### 4.5 Modal（生词释义，居中）
- 遮罩 `--scrim` 淡入（`sm-backdrop-in`）；内容卡 `--surface` 白底 `--r-lg` 圆角 `--shadow-lg`，内边距 24。
- 头部：单词（`--fs-title` 粗）+ 音标（`--text-2`）+ 发声按钮（`volume`）；中部：词性标签 `.pos-tag` + 中文释义 `.meaning`（英文释义作对照）+ 例句（可发声）；底部：主按钮（`plus` 加入生词本 / `reply` 回到原句）+ `btn--ghost` 关闭。
- 弹出：弹性缩放上推（`sm-modal-in`）。来源为跟读页 → 底部「加入生词本」；来源为生词本 → 底部「回到原句」+ 隐藏加入。

### 4.6 Toolbar（跟读页底部固定，毛玻璃）
- `position:fixed` 底部，背景 `color-mix(in srgb, var(--surface) 82%, transparent)` + `backdrop-filter: blur(12px)`，`--shadow-lg` 上缘。
- 左：播放/暂停圆形图标按钮（44）；中：`跟读` 主按钮胶囊（`--primary`，高 44，占主宽，录音态显 REC 脉冲）；右：设置图标按钮（开 BottomSheet）。
- 安全区 `padding-bottom: env(safe-area-inset-bottom)`。

### 4.7 Segmented（登录/注册切换）
- 外层 `--surface-2` 浅底 track，`--r-pill`；选中段 `--primary` 实心白字，`--dur-normal` 滑块过渡。

### 4.8 Toast
- 底部上浮（`sm-toast-in`），`--surface` 白底 `--r-md` 圆角 `--shadow-lg`，左图标 + 文案；3s 自动淡出；最多叠 1 条。成功 `--success` / 信息 `--info` / 警示 `--warning` / 错误 `--danger`。

### 4.9 Progress（学习进度）
- 列表卡片：右上环形进度（已学句 / 总句），`--primary` 弧 + `--border` 底。
- 视频区：底部细进度条，`--primary` 已播 + `--surface-2` 未播。

### 4.10 Skeleton / Spinner（见 §8）

---

## 5. 页面布局规范

### 5.1 落地页（Landing，独立全屏）
- 极光背景漂浮（`sm-aurora-a/b`）+ 声波跳动（`sm-wave`）+ 跑马灯（`sm-marquee`）+ 浮动徽章（`sm-float`）。
- 主视觉：品牌大字标 + 一句话价值主张；CTA 主按钮（流光 `sm-sheen` / 渐变平移 `sm-gradient-pan`）；右上主题切换。
- 尊重 `prefers-reduced-motion`：动效归零，保留静态品牌与 CTA。

### 5.2 登录 / 注册页（独立全屏）
- 顶部：珊瑚橙圆角品牌标（favicon tile）+ `brand` 字标 + `secondary` 副标题。
- 卡片：`.Segmented`（登录/注册）+ 邮箱 Input + 密码 Input + 主按钮 `登 录` + `btn--text`「先逛逛」。
- 提交态：按钮 `disabled` + `<Spinner>` + 文案「登录中…/注册中…」，防重复提交。
- 底部：品牌标语（`--text-3`）。

### 5.3 视频列表页（Shell）
- 顶栏：`TopNav`（品牌 + 标签 + 搜索 + 添加 + 主题 + 头像）。
- 卡片流：封面（16:9，`--r-lg` 圆角，无封面用渐变占位 + `video` 图标）、标题 `--fs-title`、元信息 `--fs-meta`（时长 · 句数 · 上次学到第 N 句）、右上 `Progress` 环。
- 加载：整列 `Skeleton` 卡片 ×3（shimmer）；空：居中线性插画（SVG 1.5 描边）+「还没有视频，去粘贴一个 YouTube 链接吧」。
- 添加：顶栏 `添加视频` 主按钮进添加页。

### 5.4 跟读页（核心，Shell/内部 nav）
- 顶栏：返回 + 视频标题（省略）+ 生词本；桌面走 `TopNav`。
- 视频区：`--r-lg` 圆角黑底 + `play`/`pause` 覆盖 + 底部细进度条；自动播放到当前句时间范围，播完暂停。
- 模式条：`Chip` 组（精听 / 跟读 / 听写 / 挖空）+ `language` 字幕切换（英中 / 仅英 / 仅中）。
- **句子练习台**（见 §6 四模式）+ 句子操作条（播放句、收藏、笔记、复制、检查/重做）。
- 字幕列表：竖向气泡（已读/当前/未读三态），当前句强锚点；生词红底可点弹 `Modal`；卡拉OK 逐词点亮。
- 底部 `Toolbar`（毛玻璃）：播放/暂停 + `跟读` 主按钮 + 设置（`BottomSheet`：字幕模式 / 生词高亮开关 / 单句循环 / 语速滑块 / 深色模式）。

### 5.5 生词本页（Shell）
- 顶栏：返回 + `pageTitle`「生词本」+ 搜索 + 设置。
- 卡片流：单词 `--fs-title` + 音标/词性 `--fs-meta` + 来源 `book`（视频名）+ 第 N 句；点击跳回原句（`reply`）；`trash` 移除。
- 空：居中线性插画 +「跟读时点击生词就能加入这里」。

### 5.6 个人中心页（Shell）
- 顶栏：返回 + `pageTitle`「我的」。
- 区块：账号（`user` + 邮箱）、学习统计（卡片：跟读句数 / 视频数 / 生词数）、入口（生词本、笔记、设置、深色模式切换、退出登录）。

### 5.7 添加视频页（Shell）
- 顶栏：返回 + `pageTitle`「添加视频」+ 主题切换。
- 主体：YouTube 链接输入框 + 解析按钮（`btn--primary` 块级）；解析中显进度条 + `<Spinner>` + 禁用按钮；完成后视频进入全局列表。
- 失败：`--danger` Toast + 重试入口；空链接：输入校验提示。

---

## 6. 跟读页四种练习模式

| 模式 | 交互 | 结果呈现 |
|---|---|---|
| **精听 view** | 字幕默认隐藏（`lock` 遮罩 + 模糊），点击显示；开启逐词高亮则卡拉OK 逐词点亮 | 听 → 显字幕校对；支持收藏 / 笔记 / 复制 |
| **跟读 shadow** | 点 `跟读` → 重播原句 → Web Speech API 录音 → 识别 | 气泡下方逐词对比：正确 `--success` 常规、差异 `--danger` 删除线；评分色条 + 文案 |
| **听写 dictation** | 隐藏/显示中文提示，textarea 写英文，点检查 | 逐词比对：正确/差异着色；检查后禁用输入、底色微染 |
| **挖空 cloze** | 生词（或补足至 3 个）变下划线填空，写答案，点检查 | 答对 `--success` 下划线、答错 `--danger` 下划线 + 浅红底；显示正确答案 |

**句子操作条**（当前句）：播放句（圆形 `play`）/ 听写·挖空检查（`CheckBtn` 检查+重做）/ 跟读（`ShadowActions`）/ 精听（复制 `copy`、收藏 `star`/`starFill`、笔记 `note` 带角标）。收藏按 sentence id 存 `p.favorites`；笔记经 `NoteEditor` 写入 `p.notes`。

**生词点击**：`handleWordClick` → 弹 `WordPopup`（居中 Modal）→ 释义（Free Dictionary，中文优先）+ 发声 `volume`；跟读页底部「加入生词本」，生词本来源底部「回到原句」。

---

## 7. 状态规范（空 / 加载 / 错误）

| 状态 | 处理 |
|---|---|
| 全局启动 | 品牌 `<Spinner size="lg" label="加载中…">` 居中（替代裸文本） |
| 列表加载 | `Skeleton` 卡片 ×3，shimmer 动效（非「空态」闪现） |
| 跟读页打开视频 | 双栏 `Skeleton`（左 player 占位 + 2 行；右 6 个 sentence-row），**替代白屏**，淡入真实内容 |
| 生词本 / 个人中心加载 | 网格/统计 `Skeleton`，非「还没收藏」空态闪现 |
| 单词弹层加载 | `<Spinner size="sm" label="加载中…">`（替代裸文本） |
| 登录 / 注册提交 | 按钮 `disabled` + `<Spinner>` + 「登录中…/注册中…」 |
| 空生词本 / 空视频列表 | 居中线性 SVG 插画（`--text-3` 描边）+ 引导文案 |
| 视频解析中 | `info` Toast / 进度条 +「解析中…」 |
| 解析失败 / 网络错误 | `danger` Toast + 重试入口；可顶部红条 |
| 输入错误 | Input 错误态 + 下方 `--danger` 提示 |

> 插画统一用线性 SVG（1.5 描边、`--primary`/`--text-3`），不引入位图资源。

---

## 8. Loading 基础件（统一语言）

- **旋转器** `.spinner`（描边环，色取 `--primary`，`border-top-color` 实色，`sm-spin 0.7s linear`）：档位 `sm=14 / md=20 / lg=32`。`prefers-reduced-motion` 自动降级停转。
- **整块加载** `.loading-state`：flex 居中列，`gap --sp-3`，`--text-2` 文案（如「加载中…」）。
- **骨架屏** `.skeleton*`：背景复用 shimmer 流光（`sm-shimmer`）；形状贴合真实布局（`.skeleton-card` 16:9 封面 + 行；`.skeleton-line` 圆角条；`.practice-skeleton` 桌面双栏网格防跳动）。
- **提交态**：任何提交类按钮请求中必须 `disabled` + spinner + 变文案（登录/注册/解析），杜绝重复提交。

---

## 9. 深色模式适配要点

- 全站 `data-theme="dark"` 切换，令牌映射见 §1.2；切换经 `theme-mode.ts`（持久化 `localStorage` `sm-theme`，首访跟随 `prefers-color-scheme`）。
- 阴影深色下减弱（lg/float 降不透明度、转深底，见 §1.4），避免光晕发灰。
- 毛玻璃工具栏/顶栏深色下用 `color-mix(in srgb, var(--surface) 82%, transparent)`。
- 珊瑚橙深色底提亮为 `--primary #FF8C61` 保对比。
- 水印 `--wm-faint` 深色压暗（`#2A2A2A`），避免近白刺眼。

---

## 10. 可访问性（WCAG AA）

- **对比度（实测）**：浅色 `--text #2D2D2D` on `--bg #FFF8F0` ≈ 12.6:1；`--text-2 #666666` on `--bg` ≈ 5.0:1（正文级达标）；深色 `--text #F5EFEA` on `--bg #1A1614` ≈ 15:1。主色 `#FF7F50` 仅用于大块/描边与白字按钮（白字 on `#FF7F50` ≈ 2.9:1，仅按钮大字号用，符合 3:1 大字标准；正文文本不落主色底）。
- **焦点**：所有交互元素 `:focus-visible` 珊瑚橙焦点环（2px + 2px offset，`--r-xs` 圆角）。
- **触控**：图标按钮 / 工具栏 / 列表行点击区 `≥44×44`。
- **语义**：语义化标签 + `aria-label`（图标按钮、进度、模态、搜索展开态 `aria-expanded`）；当前导航 `aria-current="page"`；装饰水印 `aria-hidden`。
- **动效**：`prefers-reduced-motion` 全局兜底（见 §1.7）。
- **缩放**：字号支持浏览器缩放至 200% 不破版（流式布局 + `clamp()` 用于跟读页边距）。
- **色彩非唯一载体**：差异/正确除颜色外辅以删除线 / 下划线 / 文本，不单靠红绿传达。

---

## 11. 工程落地约定

- **目录**：`frontend/src/components/{Button,Input,Card,...}`（`.tsx` + 类）、`features/practice/`（练习台子组件）、`hooks/`（状态与数据）、`pages/`（页面）、`components/Icon.tsx`（线性图标集）。
- **令牌**：CSS 仅 `tokens.css` 定义，组件类只引用 `var(--xxx)`；TS 仅 `theme.ts` 导出，组件只取导出。新增令牌双写 `tokens.css` + `theme.ts`。
- **约束**：不新增 npm 依赖（CSS/原生能力零成本）；不动后端；每片一个 commit。
- **禁止**：手写散落色值 / 字号 / 间距 / 阴影；emoji 作为图标；内联 style 新建组件（既有内联为历史债，新增组件走类 + 令牌）。

---

_规范版本 v1.1 · 事实源 `tokens.css` + `theme.ts` + `components.css` · 对齐实际实现（深色令牌 / 阴影分级 / 导航 / 四练习模式 / Loading / 可访问性）· 待评审确认后进入实现阶段。_
