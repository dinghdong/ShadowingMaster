import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "app.db"


def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
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
        """
    )

    conn.commit()
    conn.close()
    print("Database initialized.")
