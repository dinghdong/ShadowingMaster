import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "app.db"


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
        """
    )

    # 迁移：videos 表补 description / tags 两列（已存在则跳过，兼容旧库）
    for col, ctype in (("description", "TEXT"), ("tags", "TEXT")):
        exists = cursor.execute(
            "SELECT COUNT(*) FROM pragma_table_info('videos') WHERE name=?", (col,)
        ).fetchone()[0]
        if not exists:
            cursor.execute(f"ALTER TABLE videos ADD COLUMN {col} {ctype}")

    # 迁移：word_books 表补全「中文释义 / 例句 / 例句中文」三列，并在读取时 JOIN 出
    # 来源（视频标题 + 句序）所需的关联字段。已存在则跳过，兼容旧库。
    for col, ctype in (("example", "TEXT"), ("definition_zh", "TEXT"), ("example_zh", "TEXT")):
        exists = cursor.execute(
            "SELECT COUNT(*) FROM pragma_table_info('word_books') WHERE name=?", (col,)
        ).fetchone()[0]
        if not exists:
            cursor.execute(f"ALTER TABLE word_books ADD COLUMN {col} {ctype}")

    conn.commit()
    conn.close()
    print("Database initialized.")
