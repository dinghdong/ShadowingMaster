import { AppState } from "../../useApp";
import { Sentence } from "../../shared";
import { Icon } from "../../components/Icon";

// ─── 句子进度小标签（右侧列表用）───
export function ProgChips({ p, s }: { p: AppState; s: Sentence }) {
  const rec = p.recordings[s.id];
  const chips: React.ReactNode[] = [];
  if (rec?.score) chips.push(<span key="shadow" className="prog-chip prog-chip--score"><Icon name="trophy" size={11} /> {rec.score.overall}</span>);
  if (p.dictationChecked[s.id]) chips.push(<span key="dict" className="prog-chip prog-chip--ok"><Icon name="check" size={11} /> 听写</span>);
  if (p.clozeChecked[s.id]) chips.push(<span key="cloze" className="prog-chip prog-chip--ok"><Icon name="check" size={11} /> 挖空</span>);
  if (p.favorites.has(s.id)) chips.push(<span key="fav" className="prog-chip prog-chip--fav"><Icon name="starFill" size={11} /> 收藏</span>);
  if (p.notes[s.id]) chips.push(<span key="note" className="prog-chip prog-chip--note"><Icon name="note" size={11} /> 笔记</span>);
  return <div className="tag-row">{chips}</div>;
}
