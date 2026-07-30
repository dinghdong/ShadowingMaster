import os
import re
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from db import get_db, init_db

# ── Config ──────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "shadowingmaster-dev-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

app = FastAPI(title="ShadowingMaster API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)


def get_password_hash(password):
    return pwd_context.hash(password)


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


class SentenceOut(BaseModel):
    id: int
    sentence_index: int
    start_time: float
    end_time: float
    english_text: str
    chinese_text: Optional[str]


# ── Auth routes ─────────────────────────────────────────────────
@app.post("/api/auth/register", response_model=UserOut)
def register(user: UserCreate):
    conn = get_db()
    cursor = conn.cursor()
    hashed = get_password_hash(user.password)
    try:
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            (user.email, hashed),
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
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?", (form_data.username,)
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
@app.get("/api/videos", response_model=list[VideoOut])
def list_videos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


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
        "video": dict(video),
        "sentences": [dict(s) for s in sentences],
    }


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
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM word_books WHERE user_id = ? ORDER BY created_at DESC",
        (current_user["id"],),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/wordbook")
def add_word(
    word: str,
    definition: Optional[str] = None,
    video_id: Optional[int] = None,
    sentence_id: Optional[int] = None,
    current_user=Depends(get_current_user),
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO word_books (user_id, word, definition, video_id, sentence_id) VALUES (?, ?, ?, ?, ?)",
        (current_user["id"], word, definition, video_id, sentence_id),
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
