import { useState } from "react";
import { AppState } from "../useApp";
import { Icon } from "../components/Icon";
import { ThemeMode } from "../theme-mode";

// ─── 登录 / 注册页 ───
export default function LoginPage({ app, theme, onToggleTheme }: { app: AppState; theme: ThemeMode; onToggleTheme: () => void }) {
  const p = { ...app, theme, onToggleTheme };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localErr, setLocalErr] = useState("");
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const validate = (): string => {
    if (!EMAIL_RE.test(email.trim())) return "邮箱格式不正确";
    if (password.length < 8) return "密码至少需要 8 位";
    return "";
  };
  const submit = () => {
    setLocalErr("");
    const ve = validate();
    if (ve) { setLocalErr(ve); return; }
    if (mode === "login") p.handleLogin(email.trim(), password);
    else p.handleRegister(email.trim(), password);
  };
  const switchMode = (m: "login" | "register") => { setMode(m); setLocalErr(""); };
  const shownErr = localErr || p.error;
  return (
    <div className="app app--flush" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", position: "relative" }}>
      <button className="icon-btn icon-btn--plain" aria-label="切换主题" onClick={p.onToggleTheme}
        style={{ position: "absolute", top: 16, right: 16 }}>
        <Icon name={p.theme === "dark" ? "sun" : "moon"} size={22} />
      </button>

      <div style={{ fontSize: "var(--fs-brand)", fontWeight: "var(--fw-heavy)", color: "var(--primary)", marginBottom: "var(--sp-2)" }}>ShadowingMaster</div>
      <div className="meta" style={{ marginBottom: 40 }}>英语口语跟读训练</div>

      <div className="auth-card fade-up">
        <div className="auth-head segmented">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`segmented__btn ${mode === m ? "segmented__btn--active" : ""}`}>
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <input className="input" placeholder="邮箱" value={email}
            onChange={(e) => { setEmail(e.target.value); if (localErr) setLocalErr(""); }} />
          <input className="input" placeholder="密码（至少 8 位）" type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); if (localErr) setLocalErr(""); }} />
          {shownErr && <div className="hint--box">{shownErr}</div>}
          <button className="btn btn--primary btn--block" onClick={submit}>{mode === "login" ? "登 录" : "注 册"}</button>
          <button className="link-btn" style={{ width: "100%", justifyContent: "center", marginTop: "var(--sp-1)" }}
            onClick={() => p.setPage("list")}>先逛逛 →</button>
        </div>
      </div>
    </div>
  );
}
