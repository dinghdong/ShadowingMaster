import { useState } from "react";
import { AppState } from "../useApp";
import { WordBookCard } from "../components/WordBookCard";
import { WordPopup } from "../components/WordPopup";
import { Spinner } from "../components/Spinner";
import { LoginGate } from "../components/LoginGate";

// ─── 生词本页（顶部导航由 DesktopShell 统一提供）───
export default function WordBookPage({ app }: { app: AppState }) {
  const p = app;
  const [recentFirst, setRecentFirst] = useState(false);

  if (!p.user) {
    return (
      <div className="app">
        <div className="content-wrap">
          <LoginGate app={p} title="生词本" hint="登录后查看你收藏的生词" returnPage="wordbook" />
        </div>
        <WordPopup p={p} />
      </div>
    );
  }

  const q = (p.searchQuery || "").trim().toLowerCase();
  let words = p.wordBook.slice();
  if (q) words = words.filter((w: any) => (w.word || "").toLowerCase().includes(q) || (w.definition_zh || w.definition || "").toLowerCase().includes(q));
  if (recentFirst) words = words.slice().reverse();

  return (
    <div className="app">
      <div className="content-wrap">
        <div className="wb-head">
          <div>
            <div className="wb-head__title">我的生词本</div>
            <div className="wb-head__count">{p.wordbookLoading ? "加载中…" : `共 ${p.wordBook.length} 个单词`}</div>
          </div>
          <div className="filter-chips">
            <button className={`chip ${!recentFirst ? "chip--active" : ""}`} onClick={() => setRecentFirst(false)}>全部</button>
            <button className={`chip ${recentFirst ? "chip--active" : ""}`} onClick={() => setRecentFirst(true)}>最近添加</button>
          </div>
        </div>

        {p.wordbookLoading ? (
          // 加载态：显示骨架卡片网格，避免「还没收藏」空态闪现
          <div className="wordbook-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line skeleton" style={{ width: "50%" }} />
                <div className="skeleton-line skeleton" style={{ width: "92%" }} />
                <div className="skeleton-line skeleton" style={{ width: "72%" }} />
              </div>
            ))}
          </div>
        ) : words.length === 0 ? (
          <div className="empty">{p.wordBook.length === 0 ? "还没有收藏生词" : "没有匹配生词"}</div>
        ) : (
          <div className="wordbook-grid">
            {words.map((w: any) => <WordBookCard key={w.id} w={w} p={p} />)}
          </div>
        )}
      </div>
      <WordPopup p={p} />
    </div>
  );
}
