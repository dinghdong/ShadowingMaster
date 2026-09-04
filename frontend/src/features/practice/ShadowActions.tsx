import { AppState } from "../../useApp";
import { Sentence } from "../../shared";
import { Icon } from "../../components/Icon";

// ─── 跟读模式：每句录音 / 播放录音 / 评价分数 ───
export function ShadowActions({ p, s, idx }: { p: AppState; s: Sentence; idx: number }) {
  const rec = p.recordings[s.id];
  const isRec = p.recordingId === s.id;
  return (
    <>
      <button
        aria-label={`record-${idx}`}
        onClick={() => (isRec ? p.stopRecord() : p.startRecord(s.id))}
        title={isRec ? "停止录音" : "录音"}
        className={`action-btn ${isRec ? "action-btn--recording" : ""}`}
        style={isRec ? { background: "var(--danger)", borderColor: "var(--danger)", color: "var(--on-primary)" } : undefined}
      >
        <Icon name={isRec ? "stop" : "mic"} size={15} />
      </button>
      <button
        aria-label={`play-record-${idx}`}
        onClick={() => p.playRecord(s.id)}
        title="播放录音"
        disabled={!rec?.url}
        className="action-btn"
        style={{ opacity: rec?.url ? 1 : 0.4 }}
      >
        <Icon name="volume" size={15} />
      </button>
      {rec?.score ? (
        <button
          aria-label={`eval-${idx}`}
          onClick={() => p.openEval(s.id)}
          title="评价详情"
          className="score-badge"
          style={{ height: 28, padding: "0 10px" }}
        >
          <Icon name="trophy" size={13} /> {rec.score.overall}
        </button>
      ) : (
        <button aria-label={`eval-${idx}`} onClick={() => p.openEval(s.id)} title="评价详情" className="action-btn">
          <Icon name="chart" size={15} />
        </button>
      )}
    </>
  );
}
