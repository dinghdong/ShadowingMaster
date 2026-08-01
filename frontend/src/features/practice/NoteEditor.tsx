import { useState } from "react";
import { AppState } from "../../useApp";
import { Sentence } from "../../shared";

// ─── 笔记内联编辑器 ───
export function NoteEditor({ s, p }: { s: Sentence; p: AppState }) {
  const [val, setVal] = useState(p.notes[s.id] || "");
  return (
    <div onClick={(e) => e.stopPropagation()} className="card card--pad" style={{ marginTop: "var(--sp-2)" }}>
      <textarea
        className="input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="写点笔记…"
        rows={3}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-1)" }}>
        <button className="btn btn--sm btn--ghost" onClick={() => p.closeNote()}>取消</button>
        <button className="btn btn--sm btn--primary" onClick={() => { p.saveNoteFor(s.id, val); p.closeNote(); }}>保存</button>
      </div>
    </div>
  );
}
