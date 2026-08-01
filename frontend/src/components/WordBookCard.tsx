import { AppState } from "../useApp";
import { Icon } from "./Icon";

// ─── 生词本条目：中文释义 / 例句 / 来源（视频·句序）───
export function WordBookCard({ w, p }: { w: any; p: AppState }) {
  const zh = w.definition_zh || w.definition;
  const hasSource = w.video_id && w.sentence_id;
  return (
    <div
      key={w.id}
      onClick={() => p.openWordDetail(w)}
      className="list-card list-card--sm fade-up list-card--click"
      style={{ marginBottom: "var(--sp-3)" }}
    >
      <div className="row row--between" style={{ marginBottom: "var(--sp-1)" }}>
        <div className="title-strong" style={{ fontSize: "var(--fs-title)" }}>{w.word}</div>
        <div className="link-btn" style={{ color: "var(--primary)", flexShrink: 0, marginLeft: "var(--sp-2)" }}>
          查看详情
        </div>
      </div>
      <div className="wb-def">{zh || "暂无释义"}</div>
      {w.example && (
        <div className="wb-example">
          “{w.example}”
          {w.example_zh && <span className="wb-example-zh">“{w.example_zh}”</span>}
        </div>
      )}
      {hasSource && (
        <div className="wb-source">
          <Icon name="film" size={12} />
          <span className="wb-source__title">{w.video_title || "未知视频"}</span>
          <span className="wb-source__sep">·</span>
          <span>第{(w.sentence_index ?? 0) + 1}句</span>
        </div>
      )}
    </div>
  );
}
