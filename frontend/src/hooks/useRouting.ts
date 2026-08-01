import { useEffect, useRef, useState } from "react";
import { Page } from "../shared";

/**
 * History 路由（零依赖，无 #）：/ 落地页、/app 列表、/video/:id 跟读、/wordbook、/profile、/add、/login。
 * 从原 useApp 原样搬出：parsePath / applyPath / popstate 监听 / setPage / openVideo。
 */
export interface JumpTarget {
  videoId: number;
  sentenceId: number;
}

export function useRouting() {
  const parsePath = (path?: string): { page: Page; videoId: number | null } => {
    const p = (path ?? window.location.pathname).replace(/\/+$/, "") || "/";
    const m = p.match(/^\/video\/(\d+)$/);
    if (m) return { page: "player", videoId: Number(m[1]) };
    if (p === "/wordbook") return { page: "wordbook", videoId: null };
    if (p === "/profile") return { page: "profile", videoId: null };
    if (p === "/add") return { page: "add", videoId: null };
    if (p === "/login") return { page: "login", videoId: null };
    if (p === "/app") return { page: "list", videoId: null };
    return { page: "landing", videoId: null };
  };

  // 解析当前 path 并回流 state（前进/后退、直达链接都走它）
  const applyPath = (path?: string) => {
    const r = parsePath(path);
    setPageState(r.page);
    if (r.videoId != null) setCurrentVideoId(r.videoId);
  };

  const [page, setPageState] = useState<Page>(() => parsePath().page);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(() => parsePath().videoId);

  // path 变化同步到 state（浏览器前进/后退、直达链接同样生效）
  useEffect(() => {
    const onPop = () => applyPath();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 页面导航统一走 History API；pushState + 显式回流 state（pushState 不触发 popstate）
  const setPage = (pg: Page) => {
    const path = pg === "landing" ? "/" : pg === "list" ? "/app" : `/${pg}`;
    window.history.pushState({}, "", path);
    applyPath(path);
  };

  const openVideo = (id: number) => {
    const path = `/video/${id}`;
    window.history.pushState({}, "", path);
    applyPath(path);
  };

  // 位置记忆 / 生词跳原句：生词跳转优先于进度恢复（由 useWordBook 写入、useVideos 消费）
  const jumpTargetRef = useRef<JumpTarget | null>(null);

  return { page, currentVideoId, setPage, openVideo, jumpTargetRef };
}
