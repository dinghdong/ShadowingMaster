"""学习进度路由：拉取 / 更新（按 user+video upsert）。"""
from fastapi import APIRouter, Depends

from core.db import get_db
from core.security import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("")
def get_progress(current_user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM user_progress WHERE user_id = ?", (current_user["id"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/{video_id}")
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
