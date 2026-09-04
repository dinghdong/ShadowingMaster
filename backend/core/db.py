"""DB 连接与 schema 初始化（含增量迁移，兼容旧库）。
原 backend/db.py 迁移至此；DB_PATH 解析随目录层级调整。
"""
import sqlite3
from pathlib import Path

from core.config import DATA_DIR

# 本文件位于 backend/core/，故 .parent=backend/core, .parent.parent=backend, .parent.parent.parent=项目根。
# 生产通过 DATA_DIR 把库文件指向挂载卷（如 /data/app.db），避免直接挂载 /app 遮挡应用代码。
DB_PATH = (Path(DATA_DIR) / "app.db") if DATA_DIR else (Path(__file__).parent.parent.parent / "app.db")


def get_db():
    # timeout + busy_timeout：后台解析线程与请求线程并发写库时避免 "database is locked"
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youtube_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            duration_seconds INTEGER,
            thumbnail_url TEXT,
            video_path TEXT,
            sentence_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sentences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            sentence_index INTEGER NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            english_text TEXT NOT NULL,
            chinese_text TEXT,
            word_timings TEXT,               -- 逐词 [t0, t1] JSON 数组，卡拉OK高亮用
            FOREIGN KEY (video_id) REFERENCES videos(id)
        );

        CREATE TABLE IF NOT EXISTS vocabulary_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            sentence_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            definition TEXT,
            FOREIGN KEY (video_id) REFERENCES videos(id),
            FOREIGN KEY (sentence_id) REFERENCES sentences(id)
        );

        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            last_sentence_index INTEGER DEFAULT 0,
            practiced_sentences INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (video_id) REFERENCES videos(id),
            UNIQUE(user_id, video_id)
        );

        CREATE TABLE IF NOT EXISTS word_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            definition TEXT,
            video_id INTEGER,
            sentence_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (video_id) REFERENCES videos(id),
            FOREIGN KEY (sentence_id) REFERENCES sentences(id)
        );

        CREATE TABLE IF NOT EXISTS parse_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            youtube_id TEXT,
            url TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
            error TEXT,
            video_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sentence_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (sentence_id) REFERENCES sentences(id),
            UNIQUE(user_id, sentence_id)
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sentence_id INTEGER NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (sentence_id) REFERENCES sentences(id),
            UNIQUE(user_id, sentence_id)
        );

        CREATE TABLE IF NOT EXISTS dictionary_cache (
            word TEXT PRIMARY KEY,
            payload TEXT NOT NULL,           -- 规范化后的 JSON 响应
            status TEXT NOT NULL,            -- 'ok' | 'notfound'
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    # 迁移：videos 表补 description / tags 两列（已存在则跳过，兼容旧库）
    for col, ctype in (("description", "TEXT"), ("tags", "TEXT")):
        exists = cursor.execute(
            "SELECT COUNT(*) FROM pragma_table_info('videos') WHERE name=?", (col,)
        ).fetchone()[0]
        if not exists:
            cursor.execute(f"ALTER TABLE videos ADD COLUMN {col} {ctype}")

    # 迁移：sentences 表补 word_timings 列 —— 每句逐词 [t0, t1] 的 JSON 数组（绝对秒），
    # 与 english_text.split() 一一对应，供前端卡拉OK按真实语音节奏高亮。
    # 旧库该列为 NULL，前端自动回退到句内线性插值（老行为）。
    exists = cursor.execute(
        "SELECT COUNT(*) FROM pragma_table_info('sentences') WHERE name=?", ("word_timings",)
    ).fetchone()[0]
    if not exists:
        cursor.execute("ALTER TABLE sentences ADD COLUMN word_timings TEXT")

    # 迁移：word_books 表补全「中文释义 / 例句 / 例句中文」三列
    for col, ctype in (("example", "TEXT"), ("definition_zh", "TEXT"), ("example_zh", "TEXT")):
        exists = cursor.execute(
            "SELECT COUNT(*) FROM pragma_table_info('word_books') WHERE name=?", (col,)
        ).fetchone()[0]
        if not exists:
            cursor.execute(f"ALTER TABLE word_books ADD COLUMN {col} {ctype}")

    conn.commit()
    conn.close()
    print("Database initialized.")
