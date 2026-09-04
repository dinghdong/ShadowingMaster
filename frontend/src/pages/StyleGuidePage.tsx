import styleguideHtml from "../../docs/UI-DESIGN-SYSTEM.html?raw";

/**
 * /styleguide —— 设计规范可视化预览页。
 * 单源：直接 `?raw` 引入 frontend/docs/UI-DESIGN-SYSTEM.html（与实现令牌 tokens.css 同源），
 * 经 iframe srcDoc 内联渲染，避免复制/漂移。HTML 完全自包含（内联 CSS/JS、SVG 符号），
 * 自带浅/深色切换，无需外部资源。整页铺满视口、不套 DesktopShell，供开发/设计对照。
 */
export default function StyleGuidePage() {
  return (
    <iframe
      srcDoc={styleguideHtml}
      title="ShadowingMaster · UI Design System"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
    />
  );
}
