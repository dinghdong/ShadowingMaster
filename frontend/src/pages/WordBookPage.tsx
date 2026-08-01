import { AppState } from "../useApp";
import { Icon } from "../components/Icon";
import { WordBookCard } from "../components/WordBookCard";
import { LoginGate } from "../components/LoginGate";

// ─── 生词本页 ───
export default function WordBookPage({ app }: { app: AppState }) {
  const p = app;
  return (
    <div className="app">
      <div className="navbar">
        <button className="icon-btn icon-btn--plain navbar__back" onClick={() => p.setPage("list")} aria-label="返回"><Icon name="arrowLeft" size={22} /></button>
        <div className="navbar__title">我的生词本</div>
      </div>
      <div className={`page-pad${p.user ? " wordbook-grid" : ""}`}>
        {!p.user ? <LoginGate app={p} title="生词本" hint="登录后查看你收藏的生词" returnPage="wordbook" /> :
         p.wordBook.length === 0 ? <div className="empty">还没有收藏生词</div> :
         p.wordBook.map((w: any) => <WordBookCard key={w.id} w={w} p={p} />)}
      </div>
    </div>
  );
}
