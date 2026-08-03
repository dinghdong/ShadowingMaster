import { useEffect, useState } from "react";
import { login, register, getMe } from "../api";
import { Page } from "../shared";

export interface AuthDeps {
  setPage: (pg: Page) => void;
  /** 未登录门禁回跳意图：记录用户原本想访问的受保护页，登录成功后回跳 */
  loginReturnRef: React.MutableRefObject<Page | null>;
  /** 登录/注册成功后刷新生词本（由 useApp 延迟绑定到 useWordBook） */
  refreshWordBook: () => void;
}

/**
 * 鉴权：当前用户 / 登录 / 注册 / 登出 / 错误文案本地化。
 * 从原 useApp 原样搬出（挂载时的 getMe 也在这里，顺序仍是最先发起）。
 */
export function useAuth(deps: AuthDeps) {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");
  // 登录/注册提交态：请求期间禁用按钮 + 转圈，防止重复提交
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  // 后端英文异常 → 中文提示
  const localizeError = (msg: string): string => {
    if (!msg) return "操作失败，请重试";
    if (msg.includes("already registered")) return "该邮箱已注册";
    if (msg.includes("Incorrect email or password")) return "邮箱或密码错误";
    if (msg.includes("邮箱格式不正确")) return "邮箱格式不正确";
    if (msg.includes("密码至少")) return "密码至少需要 8 位";
    return msg;
  };

  // 登录/注册成功后跳回门禁来源页；无来源则回列表
  const afterAuth = () => {
    const target = deps.loginReturnRef.current ?? "list";
    deps.loginReturnRef.current = null;
    deps.setPage(target);
  };

  const handleLogin = async (email: string, password: string) => {
    setError("");
    setSubmitting(true);
    try { await login(email, password); setUser(await getMe()); deps.refreshWordBook(); afterAuth(); }
    catch (e: any) { setError(localizeError(e.message) || "登录失败"); }
    finally { setSubmitting(false); }
  };

  const handleRegister = async (email: string, password: string) => {
    setError("");
    setSubmitting(true);
    try { await register(email, password); await login(email, password); setUser(await getMe()); deps.refreshWordBook(); afterAuth(); }
    catch (e: any) { setError(localizeError(e.message) || "注册失败"); }
    finally { setSubmitting(false); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); setUser(null); deps.setPage("list"); };

  return { user, error, submitting, handleLogin, handleRegister, handleLogout };
}
