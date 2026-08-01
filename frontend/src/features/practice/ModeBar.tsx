import { AppState } from "../../useApp";
import { Icon } from "../../components/Icon";

// ─── 模式分段控件（精听 / 跟读 / 听写 / 挖空 + 字幕开关）───
export function ModeBar({ p }: { p: AppState }) {
  return (
    <div className="practice__modebar" onClick={(e) => e.stopPropagation()}>
      {(["view", "shadow", "dictation", "cloze"] as const).map((m) => (
        <button key={m} onClick={() => p.setPracticeMode(m)}
          className={`chip ${p.practiceMode === m ? "chip--active" : ""}`}>
          {m === "view" ? "精听" : m === "shadow" ? "跟读" : m === "dictation" ? "听写" : "挖空"}
        </button>
      ))}
      {p.practiceMode === "view" && p.currentSentence && (
        <button
          className="practice__subtitle-toggle"
          onClick={() => p.revealIntensive()}
        >
          <Icon name={p.subtitleHidden ? "eye" : "eyeOff"} size={14} />
          {p.subtitleHidden ? "显示字幕" : "隐藏字幕"}
        </button>
      )}
    </div>
  );
}
