// ─── 单句操作按钮（复制 / 收藏 / 笔记）───
export function ActionBtn({ children, onClick, active, badge, label }: { children: React.ReactNode; onClick: () => void; active?: boolean; badge?: boolean; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`action-btn ${active ? "action-btn--active" : ""}`}
    >
      {children}
      {badge && <span className="action-btn__dot" />}
    </button>
  );
}
