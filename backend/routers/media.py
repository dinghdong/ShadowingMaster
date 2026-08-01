"""媒体文件路由：视频/封面，支持 Range 拖拽播放。"""
import re

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response

from core.config import MEDIA_DIR, MEDIA_TYPES

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{file_name}")
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
