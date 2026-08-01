"""生词本路由：列表 / 新增 / 删除。"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.db import get_db
from core.security import get_current_user

router = APIRouter(prefix="/api/wordbook", tags=["wordbook"])


@router.get("")
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


@router.post("")
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


@router.delete("/{word_id}")
def delete_word(word_id: int, current_user=Depends(get_current_user)):
    conn = get_db()
    conn.execute(
        "DELETE FROM word_books WHERE id = ? AND user_id = ?",
        (word_id, current_user["id"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}
