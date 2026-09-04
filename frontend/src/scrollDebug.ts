// 调试工具：滚动偏移排查（为定位真机「当前句被吸顶栏遮半截」而加）。
// 开启方式（任选其一，方便手机真机调试）：
//   1) URL 加 ?scrolllog=1
//   2) 控制台执行 localStorage.smScrollDebug = '1' 后刷新
// 关闭：去掉参数 / localStorage.smScrollDebug = '' 后刷新。
// 它会同时输出 console（前缀 [SM-SCROLL]）与屏幕底部 HUD（可直接截图发回），
// 并把「真实滚动容器」与每次滚动的全部偏移量打出来，便于核对偏移计算是否正确。

export const SM_SCROLL_DEBUG =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("scrolllog") ||
    window.localStorage.getItem("smScrollDebug") === "1");

// 通用诊断开关（定位「字幕定位到 200+ 句 / 每次刷新位置不同」问题时加）。
// 开启：URL 加 ?diag=1 或 localStorage.smDiag='1' 后刷新。关闭：去掉 / 置空后刷新。
export const SM_DIAG =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("diag") ||
    window.localStorage.getItem("smDiag") === "1");

export function smDiagLog(line: string): void {
  if (!SM_DIAG) return;
  console.log("[SM-DIAG] " + line);
}

let __smHud: HTMLDivElement | null = null;

export function smScrollLog(line: string): void {
  if (!SM_SCROLL_DEBUG) return;
  console.log("[SM-SCROLL] " + line);
  if (typeof document === "undefined") return;
  if (!__smHud) {
    __smHud = document.createElement("div");
    __smHud.id = "sm-scroll-hud";
    Object.assign(__smHud.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      maxHeight: "40vh",
      overflow: "auto",
      font: "10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
      color: "#7CFC00",
      background: "rgba(0,0,0,0.82)",
      zIndex: "99999",
      padding: "6px 8px",
      pointerEvents: "none",
      whiteSpace: "pre",
      borderTop: "1px solid #333",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(__smHud);
  }
  const t = new Date().toLocaleTimeString();
  const next = `${t} ${line}\n${__smHud.textContent ?? ""}`;
  __smHud.textContent = next.split("\n").slice(0, 40).join("\n");
}

// 从目标元素向上找真正的滚动容器：任何 overflowY=auto/scroll 或 scrollHeight>clientHeight 的祖先。
// 同时汇报 document.scrollingElement，以区分「整页(window)滚动」与「内部容器滚动」。
export function smDetectScroller(el: HTMLElement): void {
  if (!SM_SCROLL_DEBUG) return;
  const chain: string[] = [];
  let n: HTMLElement | null = el;
  while (n && n !== document.body && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    const oy = cs.overflowY;
    const canScroll = n.scrollHeight > n.clientHeight + 1;
    if (oy === "auto" || oy === "scroll" || canScroll) {
      chain.push(
        `${n.tagName}.${(n.className || "").toString().split(" ")[0]} oy=${oy} ch=${n.clientHeight} sh=${n.scrollHeight} st=${n.scrollTop}`
      );
    }
    n = n.parentElement;
  }
  const de = document.scrollingElement as HTMLElement | null;
  const docInfo = de
    ? `${de.tagName} ch=${de.clientHeight} sh=${de.scrollHeight} st=${de.scrollTop} bodyOH=${document.body.offsetHeight}`
    : "none";
  // 真实移动端（iOS Safari / Android Chrome）常有「视觉视口 ≠ 布局视口」：地址栏伸缩会让
  // window.innerHeight 与 visualViewport.height 不一致，而 getBoundingClientRect 是相对「视觉视口」的，
  // window.scrollY 是相对「布局视口」的——两者混用正是真机偏移算错的经典根因。这里把差值打出来。
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vvInfo = vv
    ? ` vv.offsetTop=${vv.offsetTop.toFixed(0)} vv.height=${vv.height.toFixed(0)} vv.pageTop=${vv.pageTop.toFixed(0)} (innerH=${window.innerHeight})`
    : " vv=none";
  smScrollLog(
    `SCROLLER doc[${docInfo}] winInnerH=${window.innerHeight} candidates=${
      chain.length ? " | " + chain.join(" | ") : "NONE(window?)"
    }${vvInfo}`
  );
}
