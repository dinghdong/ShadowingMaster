"""一次性清理脚本：把 sentences 表里残留的 HTML 实体（&gt; &nbsp; &amp; …）
与 YouTube 自动字幕说话人标记 >> 清洗掉。

用法：
  python clean_entities.py            # 清理当前 app.db
  python clean_entities.py /path/to/app.db

仅改写 english_text（中文翻译由 Google 翻译时已自动剥离实体，无需动）。
幂等：只更新 clean_text(text) != text 的行。
"""
import sqlite3
import sys
from pathlib import Path

from import_video import clean_text, DB_PATH

ENT = __import__("re").compile(r"&(gt|lt|amp|nbsp|quot|#\d+|#x[0-9a-fA-F]+);")


def main():
    db = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_PATH
    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, english_text FROM sentences").fetchall()
    upd = 0
    for r in rows:
        e1 = clean_text(r["english_text"])
        if e1 != r["english_text"]:
            conn.execute("UPDATE sentences SET english_text=? WHERE id=?", (e1, r["id"]))
            upd += 1
    conn.commit()
    left = sum(1 for r in conn.execute("SELECT english_text FROM sentences").fetchall() if ENT.search(r["english_text"]))
    conn.close()
    print(f"已更新 {upd} 行，剩余含原始 HTML 实体的行：{left}")


if __name__ == "__main__":
    main()
