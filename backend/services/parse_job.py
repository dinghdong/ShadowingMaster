"""解析任务服务：后台线程跑「下载+字幕解析+中英入库」，回写任务状态。

从 main.py 抽离，解除 Web 服务对 CLI 脚本的顶层耦合：
- 仅在此处延迟 import `fetch_video.fetch`（yt-dlp 缺失时不拖垮 API 启动）；
- 调用方（routers/videos.py）只调 `run_parse_job(job_id, url)`，不感知下载细节。
"""
from typing import Optional

from core.db import get_db


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
