/**
 * ShadowingMaster 线性图标系统（替代 emoji）。
 * 1.5 描边、currentColor 着色，零依赖、可随主题变色。
 * 用法：<Icon name="mic" size={20} />
 */
import React from "react";

export type IconName =
  | "user" | "book" | "plus" | "lock" | "film" | "clock" | "lines"
  | "mic" | "stop" | "volume" | "trophy" | "chart" | "copy"
  | "star" | "starFill" | "note" | "eye" | "eyeOff"
  | "play" | "pause" | "gear" | "close" | "redo" | "check"
  | "arrowLeft" | "arrowRight" | "reply" | "spinner" | "checkCircle"
  | "sun" | "moon" | "target";

// 填充型图标（实心）
const FILLED = new Set<IconName>(["play", "pause", "stop", "starFill"]);

const PATHS: Record<IconName, React.ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6.5 8-6.5S20 16 20 20" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z" />
      <path d="M5 4v16" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="0" width="18" height="18" rx="2" transform="translate(0 3)" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lines: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3" />
      <path d="M10 14h4M9 20h6M12 14v6" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20V13M12 20V5M19 20v-8" />
      <path d="M3 20h18" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  star: (
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
  ),
  starFill: (
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
  ),
  note: (
    <>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4M6.5 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.3-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  play: <path d="M7 5l12 7-12 7z" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.2" height="14" rx="1" />
      <rect x="13.8" y="5" width="3.2" height="14" rx="1" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  redo: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  check: <path d="M5 12l5 5L20 6" />,
  arrowLeft: <path d="M15 5l-7 7 7 7" />,
  arrowRight: <path d="M9 5l7 7-7 7" />,
  reply: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
    </>
  ),
  spinner: <path d="M12 3a9 9 0 1 0 9 9" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.5,
  className,
  spin,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  spin?: boolean;
  style?: React.CSSProperties;
}) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        ...(spin ? { animation: "sm-spin 0.8s linear infinite" } : null),
        ...style,
      }}
      aria-hidden={true}
      focusable={false}
    >
      {PATHS[name]}
    </svg>
  );
}
