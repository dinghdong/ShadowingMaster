/**
 * ShadowingMaster UI 规范（Slice 0 定稿 · 变体 A 暖橙卡片）
 * 所有组件只允许从这里取 token，禁止手写散落的色值/字号/间距。
 */

export const color = {
  bg: "#FFF8F0",          // 页面底色 · 暖米
  card: "#FFFFFF",        // 卡片 / 气泡
  primary: "#FF7F50",     // 主色 · 珊瑚橙（品牌、主按钮、当前句边框）
  primarySoft: "#FFF0E6", // 主色浅底（当前句气泡底）
  text: "#2D2D2D",        // 正文
  textLight: "#666666",   // 次要文字 / 中文字幕
  border: "#F0E6DC",      // 卡片描边 / 分隔
  hardWord: "#E74C3C",    // 生词 / 差异词标红
  correct: "#27AE60",     // 跟读正确词
  readBg: "#F5F5F5",      // 已读句气泡底
} as const;

export const font = {
  // 系统字体栈：iOS/Android 各自回退，中英文混排稳定，零外部依赖
  family: `-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Segoe UI", Roboto, "Noto Sans SC", sans-serif`,
  size: {
    brand: 28,      // 品牌大字（登录页 Logo）
    pageTitle: 20,  // 页标题 / 列表页品牌
    title: 18,      // 卡片标题 / 词条单词
    sentence: 17,   // 英文字幕句（跟读核心，字号最大正文）
    body: 16,       // 按钮 / 输入框 / 跟读结果
    secondary: 14,  // 中文字幕 / 次要信息
    meta: 13,       // 时长、句数等元信息
    tiny: 12,       // 角标 / 提示
  },
  weight: { regular: 400, semibold: 600, bold: 700, heavy: 800 },
  lineHeight: { sentence: 1.7, body: 1.6, compact: 1.4 },
} as const;

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  pagePadding: 16, // 页面左右安全边距
} as const;

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, pill: 999,
} as const;

export const shadow = {
  card: "0 4px 20px rgba(0,0,0,0.06)",
  float: "0 8px 32px rgba(255,127,80,0.12)",
} as const;
