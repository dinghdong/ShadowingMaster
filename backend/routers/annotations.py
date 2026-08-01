"""句子标注路由：收藏（toggle）/ 笔记（upsert）/ 批量查询某视频的标注。"""
from fastapi import APIRouter, Depends

from core.db import get_db
from core.security import get_current_user
from models.schemas import NoteIn

router = APIRouter(tags=["annotations"])


@router.get("/api/videos/{video_id}/annotations")
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


@router.post("/api/sentences/{sentence_id}/favorite")
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


@router.post("/api/sentences/{sentence_id}/note")
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
