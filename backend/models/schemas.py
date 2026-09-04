"""全部 Pydantic 响应/请求模型，从 main.py 搬出集中管理。"""
from typing import Optional

from pydantic import BaseModel


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
    # 逐词时间戳 [[t0, t1], ...]（绝对秒），与 english_text.split() 一一对应。
    # 来源于字幕轨自带的词级时间戳；人工字幕轨没有该信息时为 None，
    # 前端回退到句内线性插值（精度较差，但不影响可用）。
    word_timings: Optional[list[list[float]]] = None


class ParseRequest(BaseModel):
    url: str


class NoteIn(BaseModel):
    content: str
