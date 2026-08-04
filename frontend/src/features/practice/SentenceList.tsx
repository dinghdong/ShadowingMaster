import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { AppState } from "../../useApp";
import { Sentence } from "../../shared";
import { SentenceRow } from "./SentenceRow";
import { ModeBar } from "./ModeBar";
import { SentenceCard } from "./SentenceCard";
import { SM_SCROLL_DEBUG, smScrollLog } from "../../scrollDebug";

// ─────────────────────────────────────────────────────────────────────────
// 移动端句子列表：使用 react-window 的 VariableSizeList 作为内部滚动容器。
//
// 为什么用开源组件而不是手写：
//   WeChat WebView / 部分移动端浏览器会静默忽略 window.scrollBy / scrollTo /
//   scrollIntoView（甚至 inner 元素的 scrollTo({behavior}) 也不触发）。
//   react-window 的滚动是「直接给 scroll 容器赋 scrollTop」（不受上述限制），
//   且 scrollToItem(index, "start") 可把当前项对齐到滚动区顶部（紧贴视频底部），
//   同时顺带对长字幕做虚拟化，避免一次性渲染上百个 DOM 节点。
// ─────────────────────────────────────────────────────────────────────────

type RowData = {
  p: AppState;
  sentences: Sentence[];
  setSize: (index: number, size: number) => void;
};

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const { p, sentences, setSize } = data;
  const contentRef = useRef<HTMLDivElement>(null);
  const s = sentences[index];
  const isCur = index === p.currentIndex;

  // 测真实内容高度（用内容节点而非外层定位节点，定位节点高度由 react-window 控制）。
  // 高度变化时通知列表重新计算（resetAfterIndex）→ 偏移量立即修正，避免重叠/留白。
  useLayoutEffect(() => {
    if (contentRef.current) setSize(index, contentRef.current.getBoundingClientRect().height);
  });

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
      <div ref={contentRef} style={{ paddingTop: index === 0 ? "var(--sp-3)" : 0, paddingBottom: 10 }}>
        {content}
      </div>
    </div>
  );
}

export function MobileSentenceList({ p, sentences }: { p: AppState; sentences: Sentence[] }) {
  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeMap = useRef<Record<number, number>>({});
  const currentIndexRef = useRef(p.currentIndex);
  currentIndexRef.current = p.currentIndex;

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

  // 高度变化 → 重新计算该 index 之后所有项的偏移；若正是当前句（展开面板变高），
  // 等一帧再 scrollToItem 一次，确保展开后停留可见区。
  const setSize = useCallback((index: number, size: number) => {
    if (size > 0 && sizeMap.current[index] !== size) {
      sizeMap.current[index] = size;
      listRef.current?.resetAfterIndex(index);
      if (index === currentIndexRef.current) {
        requestAnimationFrame(() => listRef.current?.scrollToItem(index, "start"));
      }
    }
  }, []);

  const getSize = useCallback((index: number) => sizeMap.current[index] ?? 76, []);

  const itemData = useMemo<RowData>(() => ({ p, sentences, setSize }), [p, sentences, setSize]);

  // 跟随 currentIndex 滚动：覆盖 点击/上一句下一句/自动跟读/从头开始/进页定位 全部入口。
  // align="start"：当前句对齐到滚动区顶部（即紧贴视频底部），而非 react-window 默认的
  // "smart"（向下切句时会把当前句贴到滚动区底部，导致当前句显示在底部）。
  // 用 rAF 延到 DOM 提交后再滚；height>0 才滚（首帧容器高度尚未测出时跳过，测出后本 effect 重跑）。
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (height > 0) {
        listRef.current?.scrollToItem(p.currentIndex, "start");
        if (SM_SCROLL_DEBUG) smScrollLog(`LIST-SCROLL idx=${p.currentIndex}`);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [p.currentIndex, height]);

  return (
    <div className="practice__right" ref={containerRef}>
      {height > 0 && (
        <VariableSizeList
          ref={listRef}
          height={height}
          width="100%"
          itemCount={sentences.length}
          itemSize={getSize}
          itemData={itemData}
          itemKey={(idx) => sentences[idx]?.id ?? idx}
          overscanCount={8}
          className="sentence-list"
        >
          {Row}
        </VariableSizeList>
      )}
    </div>
  );
}
