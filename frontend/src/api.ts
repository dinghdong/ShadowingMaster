const BASE = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);
  return fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).then(async (res) => {
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    return data;
  });
}

export function register(email: string, password: string) {
  return api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe() {
  return api("/api/auth/me");
}

export function fetchVideos() {
  return api("/api/videos");
}

export function fetchVideo(id: number) {
  return api(`/api/videos/${id}`);
}

export function getWordBook() {
  return api("/api/wordbook");
}

export function addWord(word: string, definition?: string, videoId?: number, sentenceId?: number) {
  // 后端契约：标量参数走 query string（JSON body 会 422）
  const q = new URLSearchParams({ word });
  if (definition) q.set("definition", definition);
  if (videoId) q.set("video_id", String(videoId));
  if (sentenceId) q.set("sentence_id", String(sentenceId));
  return api(`/api/wordbook?${q.toString()}`, { method: "POST" });
}

export function getProgress() {
  return api("/api/progress");
}

/** 上报播放位置（practiced 字段后端必填，位置记忆不用它，恒传 0） */
export function saveProgress(videoId: number, lastIndex: number) {
  return api(`/api/progress/${videoId}?last_index=${lastIndex}&practiced=0`, { method: "POST" });
}
