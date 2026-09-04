import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  List,
  useDynamicRowHeight,
  type ListImperativeAPI,
  type RowComponentProps,
} from "react-window";
import { AppState } from "../../useApp";
import { Sentence } from "../../shared";
import { SentenceRow } from "./SentenceRow";
import { ModeBar } from "./ModeBar";
import { SentenceCard } from "./SentenceCard";
import { SM_SCROLL_DEBUG, smScrollLog, smDiagLog } from "../../scrollDebug";

// ─────────────────────────────────────────────────────────────────────────
// 移动端句子列表：react-window 2.x 的 List + useDynamicRowHeight。
//
// 为什么用 react-window 而不是手写：
//   WeChat WebView / 部分移动端浏览器会静默忽略 window.scrollBy / scrollTo /
//   scrollIntoView。react-window 把当前句滚到视口顶部，且顺带对长字幕做虚拟化。
//
// 2.x 关键机制：
//   - useDynamicRowHeight 让 List 自动用 ResizeObserver 测量每行真实高度（无需手写
//     测量 + resetAfterIndex），当前句展开变高时自动重算偏移。
//   - List 的 ref.scrollToRow({ align, behavior, index }) 原生支持 behavior 参数
//     （"auto" | "instant" | "smooth"），内部走 element.scrollTo({behavior, top})。
//   - 微信可靠性：默认 "auto" 路径我们仍直接给滚动容器赋 scrollTop（最稳，踩坑结论）；
//     "smooth" 走原生 scrollToRow（微信可能忽略，仅用于真机对比动画效果）。
// ─────────────────────────────────────────────────────────────────────────

type RowProps = { p: AppState; sentences: Sentence[] };

function Row({ index, style, p, sentences }: RowComponentProps<RowProps>) {
  const s = sentences[index];
  const isCur = index === p.currentIndex;

  const content = isCur ? (
    <div className="practice__expanded">
      <ModeBar p={p} />
      <SentenceCard p={p} s={s} idx={index} />
    </div>
  ) : (
    <SentenceRow p={p} s={s} idx={index} />
  );

  return (
    <div id={`sent-${index}`} style={style}>
      <div style={{ paddingTop: index === 0 ? "var(--sp-3)" : 0, paddingBottom: 10 }}>
        {content}
      </div>
    </div>
  );
}

export function MobileSentenceList({ p, sentences }: { p: AppState; sentences: Sentence[] }) {
  const listRef = useRef<ListImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 动态行高：List 自动用 ResizeObserver 测量每行真实高度；当前句展开变高后自动重算偏移。
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: 76 });

  // 容器可用高度（flex:1 的剩余空间），用 ResizeObserver 实时跟随（旋转屏/键盘弹起等）
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      if (containerRef.current) setHeight(containerRef.current.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 实验参数：滚动 behavior。默认 "auto" = 直接赋 scrollTop（微信 WebView 最稳）；
  // URL 带 ?scroll=smooth 时走原生平滑滚动（List.scrollToRow({behavior:"smooth"})）。
  const smoothFromUrl =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("scroll") === "smooth";
  const defaultBehavior: ScrollBehavior = smoothFromUrl ? "smooth" : "auto";

  // 滚到第 index 句顶部（紧贴视频底部）：
  // - "smooth"：react-window 2.x 原生 scrollToRow({behavior:"smooth"})（微信 WebView 可能忽略）
  // - "auto"/undefined：直接给滚动容器赋 scrollTop —— 微信 WebView 100% 可靠（踩坑后的根因解）
  const scrollToRow = useCallback(
    (index: number, behavior: ScrollBehavior = "auto") => {
      const api = listRef.current;
      if (!api || !api.element) return;
      if (behavior === "smooth") {
        api.scrollToRow({ index, align: "start", behavior: "smooth" });
        if (SM_SCROLL_DEBUG) smScrollLog(`LIST-SCROLL-SMOOTH idx=${index}`);
      } else {
        let offset = 0;
        for (let i = 0; i < index && i < sentences.length; i++) {
          offset += rowHeight.getRowHeight(i) ?? rowHeight.getAverageRowHeight();
        }
        smDiagLog(`SCROLLTO idx=${index} avgH=${rowHeight.getAverageRowHeight().toFixed(1)} h0=${rowHeight.getRowHeight(0)?.toFixed(1)} h1=${rowHeight.getRowHeight(1)?.toFixed(1)} computedOffset=${offset.toFixed(1)}`);
        api.element.scrollTop = offset;
        smDiagLog(`SCROLLTO applied scrollTop=${api.element.scrollTop.toFixed(1)} scrollH=${api.element.scrollHeight} clientH=${api.element.clientHeight} listRows=${sentences.length}`);
        if (SM_SCROLL_DEBUG) smScrollLog(`LIST-SCROLL idx=${index} top=${Math.round(offset)}`);
      }
    },
    [sentences.length, rowHeight]
  );

  // 跟随 currentIndex 滚动：覆盖 点击/上一句下一句/自动跟读/从头开始/进页定位 全部入口。
  // align="start"：当前句对齐到滚动区顶部（即紧贴视频底部）。
  // 用 rAF 延到 DOM 提交后再滚；height>0 才滚（首帧容器高度尚未测出时跳过，测出后本 effect 重跑）。
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (height > 0) {
        smDiagLog(`MOBILE-SCROLL-EFFECT currentIndex=${p.currentIndex} height=${height} behavior=${defaultBehavior} sentences=${sentences.length}`);
        scrollToRow(p.currentIndex, defaultBehavior);
      } else {
        smDiagLog(`MOBILE-SCROLL-EFFECT skipped (height=${height} not measured yet) currentIndex=${p.currentIndex}`);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [p.currentIndex, height, scrollToRow, defaultBehavior]);

  const rowProps = useMemo<RowProps>(() => ({ p, sentences }), [p, sentences]);
  const rowKey = useCallback(
    (index: number, data: RowProps) => data.sentences[index]?.id ?? index,
    []
  );

  return (
    <div className="practice__right" ref={containerRef}>
      {height > 0 && (
        <List
          listRef={listRef}
          className="sentence-list"
          rowComponent={Row}
          rowCount={sentences.length}
          rowHeight={rowHeight}
          rowProps={rowProps}
          rowKey={rowKey}
          overscanCount={8}
          style={{ height, width: "100%" }}
        />
      )}
    </div>
  );
}
