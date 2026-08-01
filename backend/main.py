import os
import re
import json
import sqlite3
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel

from db import get_db, init_db

# ── Config ──────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "shadowingmaster-dev-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

app = FastAPI(title="ShadowingMaster API")

app.add_middleware(
    CORSMiddleware,
    # 开发期放行任意 localhost 端口（Vite 5173 / Kimi 预览 7100 及重映射端口）
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging ─────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = datetime.utcnow()
    response = await call_next(request)
    elapsed = (datetime.utcnow() - start).total_seconds() * 1000
    print(f"{request.method} {request.url.path} → {response.status_code} ({elapsed:.1f}ms)")
    return response


# ── Auth helpers ────────────────────────────────────────────────
# 直接用 bcrypt（passlib 1.7.4 与 bcrypt>=4.1 不兼容会 500）；bcrypt 上限 72 字节，显式截断
def verify_password(plain, hashed):
    return bcrypt.checkpw(plain.encode()[:72], hashed.encode())


def get_password_hash(password):
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if user is None:
        raise credentials_exception
    return dict(user)


# ── Pydantic models ─────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class VideoOut(BaseModel):
    id: int
    youtube_id: str
    title: str
    duration_seconds: Optional[int]
    thumbnail_url: Optional[str]
    video_path: Optional[str]
    sentence_count: int
    description: Optional[str] = None
    tags: Optional[list[str]] = None


class SentenceOut(BaseModel):
    id: int
    sentence_index: int
    start_time: float
    end_time: float
    english_text: str
    chinese_text: Optional[str]


class ParseRequest(BaseModel):
    url: str


class NoteIn(BaseModel):
    content: str


# ── YouTube 链接解析 + 异步解析任务 ──────────────────────────
YT_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def parse_youtube_id(url: str) -> Optional[str]:
    m = YT_ID_RE.search(url or "")
    return m.group(1) if m else None


# 邮箱格式：轻量正则，避免引入 email-validator 新依赖（依赖白名单之外）
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def run_parse_job(job_id: int, url: str):
    """后台线程：复用 fetch_video.fetch 跑 下载+字幕解析+中英入库，回写任务状态。"""
    def set_status(status: str, video_id: Optional[int] = None, error: Optional[str] = None):
        conn = get_db()
        conn.execute(
            "UPDATE parse_jobs SET status=?, video_id=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (status, video_id, error, job_id),
        )
        conn.commit()
        conn.close()

    set_status("processing")
    try:
        # 延迟导入，避免 yt-dlp 缺失时拖垮整个 API 启动
        from fetch_video import fetch
        video_id = fetch(url)
        set_status("done", video_id=video_id)
    except Exception as e:
        err = str(e)[:500]
        set_status("failed", error=err)
        print(f"[parse_job {job_id}] failed: {err}")


# ── Auth routes ─────────────────────────────────────────────────
@app.post("/api/auth/register", response_model=UserOut)
def register(user: UserCreate):
    email = (user.email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if not user.password or len(user.password) < 8:
        raise HTTPException(status_code=400, detail="密码至少需要 8 位")
    conn = get_db()
    cursor = conn.cursor()
    hashed = get_password_hash(user.password)
    try:
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            (email, hashed),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    conn.close()
    return {"id": user_id, "email": user.email}


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db()
    email = (form_data.username or "").strip().lower()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email,)
    ).fetchone()
    conn.close()
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token = create_access_token(
        {"sub": str(user["id"])},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserOut)
def read_me(current_user=Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"]}


# ── Media（视频/封面，支持 Range 拖拽） ─────────────────────────
MEDIA_DIR = Path(__file__).parent / "media"
MEDIA_TYPES = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


@app.get("/media/{file_name}")
def get_media(file_name: str, request: Request):
    base = MEDIA_DIR.resolve()
    full = (base / file_name).resolve()
    if not str(full).startswith(str(base)) or not full.is_file():
        raise HTTPException(status_code=404, detail="Media not found")
    media_type = MEDIA_TYPES.get(full.suffix.lower(), "application/octet-stream")
    range_header = request.headers.get("range")
    if not range_header:
        return FileResponse(full, media_type=media_type)
    size = full.stat().st_size
    m = re.match(r"bytes=(\d+)-(\d*)", range_header)
    if not m:
        raise HTTPException(status_code=416, detail="Invalid Range")
    start = int(m.group(1))
    end = min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
    with open(full, "rb") as f:
        f.seek(start)
        data = f.read(end - start + 1)
    return Response(
        data, status_code=206, media_type=media_type,
        headers={
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(data)),
        },
    )


# ── Video routes ────────────────────────────────────────────────
def video_to_dict(r) -> dict:
    """把 videos 行转 dict，并把 tags 的 JSON 字符串解析为数组（容错）。"""
    d = dict(r)
    raw = d.get("tags")
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            d["tags"] = parsed if isinstance(parsed, list) else [raw]
        except (json.JSONDecodeError, ValueError):
            d["tags"] = [raw]
    else:
        d["tags"] = []
    return d


@app.get("/api/videos", response_model=list[VideoOut])
def list_videos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [video_to_dict(r) for r in rows]


@app.get("/api/videos/{video_id}")
def get_video(video_id: int):
    conn = get_db()
    video = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Video not found")
    sentences = conn.execute(
        "SELECT * FROM sentences WHERE video_id = ? ORDER BY sentence_index",
        (video_id,),
    ).fetchall()
    conn.close()
    return {
        "video": video_to_dict(video),
        "sentences": [dict(s) for s in sentences],
    }


# ── 用户提交 YouTube 链接，后端异步解析 ──────────────────────
@app.post("/api/videos/parse")
def parse_video(req: ParseRequest, current_user=Depends(get_current_user)):
    """已登录用户提交 YouTube 链接：校验 → 去重 → 建任务 → 后台线程跑下载+解析+中英入库。"""
    yt_id = parse_youtube_id(req.url)
    if not yt_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    conn = get_db()
    # 已入库该视频 → 直接返回，避免重复下载
    existing = conn.execute(
        "SELECT id FROM videos WHERE youtube_id = ?", (yt_id,)
    ).fetchone()
    if existing:
        conn.close()
        return {"job_id": None, "video_id": existing["id"], "status": "done", "already_exists": True}

    # 同一用户对该链接已有进行中/已完成任务 → 复用，不重复触发
    job = conn.execute(
        "SELECT * FROM parse_jobs WHERE user_id = ? AND youtube_id = ? ORDER BY id DESC LIMIT 1",
        (current_user["id"], yt_id),
    ).fetchone()
    if job and job["status"] in ("pending", "processing"):
        conn.close()
        return {"job_id": job["id"], "status": job["status"]}
    if job and job["status"] == "done":
        conn.close()
        return {"job_id": job["id"], "video_id": job["video_id"], "status": "done"}

    cur = conn.execute(
        "INSERT INTO parse_jobs (user_id, youtube_id, url, status) VALUES (?, ?, ?, 'pending')",
        (current_user["id"], yt_id, req.url),
    )
    job_id = cur.lastrowid
    conn.commit()
    conn.close()

    threading.Thread(target=run_parse_job, args=(job_id, req.url), daemon=True).start()
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/videos/jobs/{job_id}")
def get_parse_job(job_id: int, current_user=Depends(get_current_user)):
    """查询某个解析任务的状态（仅任务提交者本人可见）。"""
    conn = get_db()
    job = conn.execute(
        "SELECT * FROM parse_jobs WHERE id = ? AND user_id = ?",
        (job_id, current_user["id"]),
    ).fetchone()
    conn.close()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return dict(job)


# ── Progress routes ─────────────────────────────────────────────
@app.get("/api/progress")
def get_progress(current_user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM user_progress WHERE user_id = ?", (current_user["id"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/progress/{video_id}")
def update_progress(
    video_id: int, last_index: int, practiced: int, current_user=Depends(get_current_user)
):
    conn = get_db()
    conn.execute(
        """
        INSERT INTO user_progress (user_id, video_id, last_sentence_index, practiced_sentences)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, video_id) DO UPDATE SET
            last_sentence_index = excluded.last_sentence_index,
            practiced_sentences = excluded.practiced_sentences,
            updated_at = CURRENT_TIMESTAMP
        """,
        (current_user["id"], video_id, last_index, practiced),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Word book routes ────────────────────────────────────────────
@app.get("/api/wordbook")
def get_wordbook(current_user=Depends(get_current_user)):
    # 关联 videos（来源视频标题）与 sentences（来源句序），让前端直接展示「从哪里加入生词本」
    conn = get_db()
    rows = conn.execute(
        """
        SELECT wb.*,
               v.title AS video_title,
               s.sentence_index AS sentence_index
        FROM word_books wb
        LEFT JOIN videos v ON v.id = wb.video_id
        LEFT JOIN sentences s ON s.id = wb.sentence_id
        WHERE wb.user_id = ?
        ORDER BY wb.created_at DESC
        """,
        (current_user["id"],),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/wordbook")
def add_word(
    word: str,
    definition: Optional[str] = None,
    definition_zh: Optional[str] = None,
    example: Optional[str] = None,
    example_zh: Optional[str] = None,
    video_id: Optional[int] = None,
    sentence_id: Optional[int] = None,
    current_user=Depends(get_current_user),
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO word_books "
        "(user_id, word, definition, definition_zh, example, example_zh, video_id, sentence_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (current_user["id"], word, definition, definition_zh, example, example_zh, video_id, sentence_id),
    )
    conn.commit()
    word_id = cursor.lastrowid
    conn.close()
    return {"id": word_id, "word": word}


@app.delete("/api/wordbook/{word_id}")
def delete_word(word_id: int, current_user=Depends(get_current_user)):
    conn = get_db()
    conn.execute(
        "DELETE FROM word_books WHERE id = ? AND user_id = ?",
        (word_id, current_user["id"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 句子标注（收藏 / 笔记） ──────────────────────────────────
@app.get("/api/videos/{video_id}/annotations")
def get_my_annotations(video_id: int, current_user=Depends(get_current_user)):
    """当前用户在本视频各句中的收藏状态与笔记内容，批量返回避免 N+1。"""
    conn = get_db()
    fav_rows = conn.execute(
        "SELECT f.sentence_id FROM favorites f JOIN sentences s ON s.id=f.sentence_id "
        "WHERE f.user_id=? AND s.video_id=?",
        (current_user["id"], video_id),
    ).fetchall()
    note_rows = conn.execute(
        "SELECT n.sentence_id, n.content FROM notes n JOIN sentences s ON s.id=n.sentence_id "
        "WHERE n.user_id=? AND s.video_id=?",
        (current_user["id"], video_id),
    ).fetchall()
    conn.close()
    return {
        "favorites": [r["sentence_id"] for r in fav_rows],
        "notes": {r["sentence_id"]: r["content"] for r in note_rows},
    }


@app.post("/api/sentences/{sentence_id}/favorite")
def toggle_favorite(sentence_id: int, current_user=Depends(get_current_user)):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM favorites WHERE user_id=? AND sentence_id=?",
        (current_user["id"], sentence_id),
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM favorites WHERE id=?", (existing["id"],))
        is_fav = False
    else:
        conn.execute(
            "INSERT INTO favorites (user_id, sentence_id) VALUES (?, ?)",
            (current_user["id"], sentence_id),
        )
        is_fav = True
    conn.commit()
    conn.close()
    return {"sentence_id": sentence_id, "is_favorite": is_fav}


@app.post("/api/sentences/{sentence_id}/note")
def save_note(sentence_id: int, req: NoteIn, current_user=Depends(get_current_user)):
    conn = get_db()
    content = req.content
    # 空内容视为删除笔记
    if not content or not content.strip():
        conn.execute(
            "DELETE FROM notes WHERE user_id=? AND sentence_id=?",
            (current_user["id"], sentence_id),
        )
    else:
        conn.execute(
            "INSERT INTO notes (user_id, sentence_id, content, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(user_id, sentence_id) DO UPDATE SET content=excluded.content, updated_at=CURRENT_TIMESTAMP",
            (current_user["id"], sentence_id, content),
        )
    conn.commit()
    conn.close()
    return {"sentence_id": sentence_id, "content": content or ""}


# ── Health ──────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Init on startup ─────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
