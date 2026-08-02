import { AppState } from "../useApp";
import { Icon } from "../components/Icon";
import { LoginGate } from "../components/LoginGate";

// ─── 添加视频页（顶部导航由 DesktopShell 统一提供）───
export default function AddVideoPage({ app }: { app: AppState }) {
  const p = app;

  if (!p.user) {
    return (
      <div className="app add-page">
        <div className="content-wrap">
          <LoginGate app={p} title="添加视频" hint="登录后即可提交 YouTube 视频自动解析跟读" returnPage="add" />
        </div>
      </div>
    );
  }

  const status = p.parseJob?.status;
  const pct = status === "processing" ? 55 : status === "done" ? 100 : 10;
  const statusText =
    status === "done" ? "解析完成"
      : status === "processing" ? "正在下载视频并解析中英文字幕…"
        : "任务已提交，排队中…";

  return (
    <div className="app add-page">
      <div className="content-wrap" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="card card--pad fade-up">
          <div className="title-strong" style={{ marginBottom: "var(--sp-1)" }}>粘贴 YouTube 链接，自动解析成跟读视频</div>
          <div className="hint" style={{ marginBottom: "var(--sp-4)" }}>
            提交后系统会自动下载视频、解析中英文字幕并入库，完成后直接打开跟读页。解析通常需几十秒到几分钟，请耐心等待。
          </div>

          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <input
              className="input"
              value={p.parseInput}
              onChange={(e) => p.setParseInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !p.parseJob) p.submitVideoUrl(p.parseInput); }}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={!!p.parseJob}
              style={{ opacity: p.parseJob ? 0.7 : 1 }}
            />
            <button
              className="btn btn--primary"
              onClick={() => p.submitVideoUrl(p.parseInput)}
              disabled={!!p.parseJob || !p.parseInput.trim()}
            >{p.parseJob ? "解析中…" : "解析"}</button>
          </div>

          {p.parseJob && (
            <div style={{ marginTop: "var(--sp-4)" }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="meta" style={{ marginTop: "var(--sp-2)" }}>
                {status === "processing" ? <Icon name="spinner" size={13} spin /> : status === "done" ? <Icon name="checkCircle" size={13} /> : null} {statusText}
              </div>
            </div>
          )}

          {p.parseError && <div className="hint--box">{p.parseError}</div>}
        </div>

        <div className="meta" style={{ marginTop: "var(--sp-4)", textAlign: "center" }}>
          支持 youtube.com/watch?v=…、youtu.be/… 等格式（含列表参数亦可）
        </div>
      </div>
    </div>
  );
}
