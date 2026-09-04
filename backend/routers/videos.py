"""视频路由：列表 / 详情 / YouTube 异步解析任务 / 任务状态查询。"""
import json
import threading
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from core.config import parse_youtube_id
from core.db import get_db
from core.security import get_current_user
from core.oss import get_serve_url, delete_object
from models.schemas import VideoOut, ParseRequest
from services.parse_job import run_parse_job

router = APIRouter(prefix="/api/videos", tags=["videos"])


def video_to_dict(r) -> dict:
    """把 videos 行转 dict，并把 tags 的 JSON 字符串解析为数组（容错）。"""
    d = dict(r)
    # 媒体路径：OSS 启用时解析为绝对公开 URL，否则保持相对路径（前端拼 API host）
    d["video_path"] = get_serve_url(d.get("video_path"))
    d["thumbnail_url"] = get_serve_url(d.get("thumbnail_url"))
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


def sentence_to_dict(r) -> dict:
    """把 sentences 行转 dict，并把 word_timings 的 JSON 字符串还原为二维数组。

    容错：列缺失/为 NULL/内容损坏一律给 None —— 前端据此回退到线性插值，
    不会因为一条脏数据整页崩掉。
    """
    d = dict(r)
    raw = d.get("word_timings")
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            d["word_timings"] = parsed if isinstance(parsed, list) else None
        except (json.JSONDecodeError, ValueError):
            d["word_timings"] = None
    else:
        d["word_timings"] = None
    return d


@router.get("", response_model=list[VideoOut])
def list_videos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [video_to_dict(r) for r in rows]


@router.get("/{video_id}")
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
        "sentences": [sentence_to_dict(s) for s in sentences],
    }


@router.post("/parse")
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


@router.delete("/{video_id}")
def delete_video(video_id: int, current_user=Depends(get_current_user)):
    """删除视频及其全部关联数据（句子/生词/进度/单词本/收藏/笔记），并尽力清理媒体文件。

    仅已登录用户可调用；生产环境建议仅管理员账户持有 token。
    """
    conn = get_db()
    video = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Video not found")

    sentence_ids = [r["id"] for r in conn.execute(
        "SELECT id FROM sentences WHERE video_id = ?", (video_id,)
    ).fetchall()]

    # 子表先于父表删除，避免外键约束报错
    if sentence_ids:
        placeholders = ",".join("?" * len(sentence_ids))
        conn.execute(f"DELETE FROM favorites WHERE sentence_id IN ({placeholders})", sentence_ids)
        conn.execute(f"DELETE FROM notes WHERE sentence_id IN ({placeholders})", sentence_ids)
    conn.execute("DELETE FROM vocabulary_words WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM word_books WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM user_progress WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM sentences WHERE video_id = ?", (video_id,))
    # 保留解析任务记录，仅解除与视频的关联
    conn.execute("UPDATE parse_jobs SET video_id = NULL WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
    conn.commit()
    conn.close()

    # 尽力清理媒体（OSS 对象或本地文件）；失败不影响已完成的 DB 删除
    for media in (video.get("video_path"), video.get("thumbnail_url")):
        if not media:
            continue
        if delete_object(media):
            continue
        if not str(media).startswith(("http://", "https://")):
            local = Path(media.lstrip("/"))
            if not local.is_absolute():
                local = Path(__file__).parent.parent.parent / media.lstrip("/")
            try:
                local.unlink(missing_ok=True)
            except OSError:
                pass

    return {"deleted": True, "video_id": video_id}


@router.get("/jobs/{job_id}")
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
