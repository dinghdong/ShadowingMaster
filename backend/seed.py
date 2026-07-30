import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "app.db"
conn = sqlite3.connect(str(DB_PATH))
cursor = conn.cursor()

# Insert sample videos
cursor.executemany(
    """
    INSERT OR IGNORE INTO videos (youtube_id, title, duration_seconds, thumbnail_url, sentence_count)
    VALUES (?, ?, ?, ?, ?)
    """,
    [
        ("dQw4w9WgXcQ", "How to Learn English Faster", 154, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", 12),
        ("abc123def", "Daily English Conversation #1", 105, "https://i.ytimg.com/vi/abc123def/hqdefault.jpg", 8),
        ("xyz789abc", "Job Interview Tips", 192, "https://i.ytimg.com/vi/xyz789abc/hqdefault.jpg", 15),
    ],
)

# Get video IDs
videos = cursor.execute("SELECT id FROM videos ORDER BY id").fetchall()

# Insert sample sentences for first video
if videos:
    vid = videos[0][0]
    cursor.executemany(
        """
        INSERT OR IGNORE INTO sentences (video_id, sentence_index, start_time, end_time, english_text, chinese_text)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (vid, 0, 0.0, 3.5, "Hello everyone, welcome back to our channel.", "大家好，欢迎回到我们的频道。"),
            (vid, 1, 3.5, 7.2, "Today we're going to talk about learning English faster.", "今天我们要讨论如何更快地学习英语。"),
            (vid, 2, 7.2, 11.0, "The key is consistent practice every single day.", "关键是每天坚持不懈地练习。"),
            (vid, 3, 11.0, 14.5, "Even fifteen minutes a day can make a huge difference.", "即使每天十五分钟也能带来巨大的改变。"),
            (vid, 4, 14.5, 18.0, "Shadowing is one of the most effective techniques.", "影子跟读是最有效的方法之一。"),
        ],
    )

conn.commit()
conn.close()
print("Sample data seeded.")
