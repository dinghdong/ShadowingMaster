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


class ParseRequest(BaseModel):
    url: str


class NoteIn(BaseModel):
    content: str
