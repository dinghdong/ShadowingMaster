# ShadowingMaster · Landing Page 设计规范

> 状态：待评审（2026-08-01）
> 目标：作为应用**主页**（`/`），向访客介绍产品价值并引导进入跟读训练。
> 设计事实源：`frontend/src/tokens.css`（CSS 变量）+ `frontend/src/theme.ts`（token 镜像）。
> 本页**不引入任何新依赖、不硬编码色值/字号**，全部取 token；视觉风格与现有跟读页/登录页一致（暖橙陪伴、移动优先、支持深色模式）。

---

## 1. 设计目标与定位

- **角色**：访客落地页。已登录用户访问 `/` 也先看本页，再通过 CTA「开始跟读」进入应用（`/app`）。
- **一次访问要传递的三件事**：
  1. 这是什么——用 YouTube 真实短视频做**逐句跟读**的口语训练工具。
  2. 为什么有效——**逐句气泡字幕 + 生词高亮 + 语音跟读逐词对比**，把"听不清、读不准、记不住"逐个解决。
  3. 怎么开始——三步即可开练，登录后还能粘贴自己的 YouTube 链接。
- **基调**：温暖、鼓励、低门槛；不堆参数、不夸大（评分为本地逐词对比参考，文案避免"AI 打分"等未实现表述）。

## 2. 信息架构（页面区块，自上而下）

| # | 区块 | 作用 | 关键元素 |
|---|------|------|----------|
| 0 | 顶部导航 | 品牌 + 主题切换 + 登录入口 | 品牌字、🌗 主题钮、登录按钮（登录态显示「进入应用」） |
| 1 | Hero | 价值主张 + 主 CTA | 主标题、副文案、主按钮「开始跟读」、次按钮/锚点「怎么用 ↓」、右侧手机视觉（hero.png） |
| 2 | 三步开始 | 降低陌生感 | 选视频 → 逐句跟读录音 → 收藏生词（film / mic / book 图标） |
| 3 | 核心功能 | 能力全景 | 6 张功能卡：双语字幕、生词高亮、语音跟读对比、四种练习模式、生词本&跳回原句、进度记忆 |
| 4 | 练习模式展示 | 细化 4 模式 | 精听 / 跟读 / 听写 / 挖空 胶囊 + 一句话说明 |
| 5 | 真实跟读示例 | 眼见为实 | 模拟一句气泡：英文 + 中文 + 生词标红 + 「你的跟读」逐词对比（差异词删除线标红） |
| 6 | YouTube 链接即学 | 差异化卖点 | 粘贴链接自动下载/解析/入库（登录后可用） |
| 7 | 最终 CTA | 转化 | 大色块「现在就开始你的第一段跟读」+ 开始跟读 / 登录 |
| 8 | 页脚 | 收尾 | 品牌、定位句、隐私/帮助/联系、© 2026 ShadowingMaster |

## 3. 文案（中文，面向成人英语学习者）

- 品牌副标：英语口语跟读训练
- Hero 眉标：用 YouTube 真实短视频练口语
- Hero 主标：像母语者一样，逐句跟读练出好口语
- Hero 副文：选一段你喜欢的英文短视频，跟着逐句气泡字幕朗读、录音对比、自动标记生词。把碎片时间变成高效的口语训练。
- 主 CTA：开始跟读（→ `/app`，游客可直接浏览跟读）
- 次动作：登录 / 注册（→ `/login`）
- 三步标题：① 选一段视频 ② 逐句跟读录音 ③ 收藏生词复习
- 功能卡标题：中英双语气泡字幕 / 生词自动高亮 / 语音跟读·逐词对比 / 四种练习模式 / 生词本·跳回原句 / 学习进度记忆
- 练习模式：精听（盲听练听力）· 跟读（录音对比）· 听写（写下你听到的）· 挖空（填生词）
- 示例句：EN "I genuinely appreciate your generous hospitality." / CN "我由衷地感激你慷慨的款待。"；跟读对比演示 "I genuine appreciate your generous hospital."（genuine→genuinely、hospital→hospitality 标红）
- 最终 CTA：现在就开始你的第一段跟读

## 4. 与已实现功能的映射（确保「设计即事实」）

| 落地页区块 | 代码事实来源 |
|-----------|--------------|
| 双语字幕 | `subtitleMode` both/english/chinese（`useApp.ts`），`SentenceCard` 渲染 |
| 生词高亮 | `isHardWord` + 5000 常用词表（`shared.ts`），红色加粗点击弹释义 |
| 语音跟读对比 | `startRecord` + `webkitSpeechRecognition` + `compareWords`（`useApp.ts`） |
| 四种练习模式 | `practiceMode` intensive/shadow/dictation/cloze（`useApp.ts`） |
| 生词本·跳回原句 | `openWordOrigin` → 跳回 video/sentence（`useApp.ts`） |
| 进度记忆 | `resumeIndex`「继续学习 第 N 句」浮条（`App.tsx`） |
| YouTube 链接即学 | `submitVideoUrl` + `parse_jobs` 异步轮询（`useApp.ts` / `AddVideoPage`） |
| 深色模式 | `data-theme="dark"` + `tokens.css`（落地页复用同一切换） |

## 5. 视觉规范（复用 token，禁止硬编码）

- 容器：`#root` 移动端已限制 480px 居中；桌面端（≥900px）落地页自拥 `max-width: 1080px` 居中宽栏，Hero 在桌面端左右双栏、移动端上下单栏。
- 间距/圆角/阴影：全部用 `--sp-*` / `--r-*` / `--shadow-*`。
- 主按钮：`.btn--primary`（珊瑚橙实心胶囊）；次按钮：`.btn--ghost` / `.link-btn`。
- 图标：复用 `components/Icon.tsx`（线性、currentColor 随主题变色）。
- 进厂动效：复用 `sm-fade-up`（`fade-up` 类），尊重 `prefers-reduced-motion`。
- 深色模式：仅依赖 token 变量，无需额外样式；主题切换复用 `App.tsx` 的 `theme` / `onToggleTheme`。

## 6. 响应式要点

- **移动端（<900px）**：单列手机栏，Hero 视觉图在下或融入卡片，区块纵向堆叠，间距紧凑。
- **桌面端（≥900px）**：Hero 双栏（文案左 / 手机视觉右），功能卡 2–3 列网格，CTA 色块更宽；整体居中不铺满。

## 7. 路由与入口（实现约束）

- 新增 `Page = "landing"`；`/` → `landing`，原列表页迁至 `/app`（`setPage("list")` 产出 `/app`，保持内部跳转不变）。
- `App.tsx`：加载完成后 `if (page === "landing") return <LandingPage .../>`；`DesktopShell` 侧栏品牌点击 `setPage("landing")` 回首页。
- 落地页所有导航走 `useApp().setPage`，与现有 History 路由一致（无 `#`、无新依赖）。

## 8. 验收

- `npm run build` 通过（tsc + vite，零类型错误）。
- 桌面/移动两种宽度下布局正常，深色模式切换正常。
- 主 CTA → 列表页；登录按钮 → 登录页；侧栏品牌 → 回首页；均不刷新整页。
