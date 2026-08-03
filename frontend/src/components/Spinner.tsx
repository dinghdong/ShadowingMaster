// 统一品牌旋转器：描边环动画 + 可选文案。
// 所有加载态走它，禁止散落裸文本「Loading… / 加载中…」。
// size: sm(按钮内/行内) / md(默认) / lg(整块/全局)
// center: true → 渲染 .loading-state 居中包裹（整块区域）；false → 行内 .spinner-row（spinner + 文案）

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
  center?: boolean;
};

function ring(size: "sm" | "md" | "lg") {
  const cls = size === "md" ? "spinner" : `spinner spinner--${size}`;
  return <span className={cls} aria-hidden="true" />;
}

export function Spinner({ size = "md", label, center = false }: SpinnerProps) {
  if (center) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        {ring(size)}
        {label ? <span className="loading-state__text">{label}</span> : null}
      </div>
    );
  }
  if (label) {
    return (
      <span className="spinner-row" role="status" aria-live="polite">
        {ring(size)}
        <span className="loading-state__text">{label}</span>
      </span>
    );
  }
  return (
    <span className="spinner-row" role="status" aria-label="加载中">
      {ring(size)}
    </span>
  );
}
