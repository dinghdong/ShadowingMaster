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
  return api("/api/wordbook", {
    method: "POST",
    body: JSON.stringify({ word, definition, video_id: videoId, sentence_id: sentenceId }),
  });
}
