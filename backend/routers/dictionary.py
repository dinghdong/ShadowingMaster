"""在线释义 / 翻译代理。

把第三方字典与翻译 API 收口到后端，解决两个线上问题：
1. 前端浏览器直连外国主机（dictionaryapi.dev / MyMemory）在国内常超时、被重置；
2. dictionaryapi.dev 对「词库没有的词」返回 502 而非 404，被误判为报错。

本路由从伦敦服务器拉取（稳定），带重试 + 超时，把 502/404/超时统一规范成
`{found:false}`，并缓存成功结果，避免重复外呼与冷启动抖动。
"""
import json
import time

import requests
from fastapi import APIRouter, Query

from core.db import get_db

router = APIRouter(prefix="/api", tags=["dictionary"])

DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en/"
TRANSLATE_API = "https://api.mymemory.translated.net/get"
HTTP_TIMEOUT = 8
RETRIES = 2  # 在首次尝试之外再重试 2 次（上游 502 常自愈）


# ── 缓存（仅缓存成功结果，缺词/故障不缓存，避免把瞬时故障固化） ──────────
def _get_cache(word: str):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT payload FROM dictionary_cache WHERE word = ? AND status = 'ok'",
            (word,),
        ).fetchone()
    finally:
        conn.close()
    return json.loads(row["payload"]) if row else None


def _set_cache(word: str, payload: dict):
    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO dictionary_cache(word, payload, status, updated_at)
               VALUES(?,?, 'ok', CURRENT_TIMESTAMP)
               ON CONFLICT(word) DO UPDATE SET
                 payload=excluded.payload, status='ok', updated_at=CURRENT_TIMESTAMP""",
            (word, json.dumps(payload)),
        )
        conn.commit()
    finally:
        conn.close()


def _fetch_dictionary(word: str) -> dict | None:
    """拉取 dictionaryapi.dev 并规范化为 {found, phonetic, meanings}。全失败返回 None。"""
    url = DICTIONARY_API + word
    for attempt in range(1 + RETRIES):
        try:
            r = requests.get(url, timeout=HTTP_TIMEOUT)
            if r.status_code == 200:
                data = r.json()
                entry = data[0] if isinstance(data, list) and data else {}
                phonetic = entry.get("phonetic") or next(
                    (p.get("text") for p in entry.get("phonetics", []) if p.get("text")), ""
                )
                meanings: list[dict] = []
                for m in entry.get("meanings", []):
                    pos = m.get("partOfSpeech", "")
                    for d in m.get("definitions", []):
                        meanings.append({
                            "partOfSpeech": pos,
                            "definition": d.get("definition", ""),
                            "example": d.get("example"),
                        })
                        if len(meanings) >= 3:
                            break
                    if len(meanings) >= 3:
                        break
                return {"found": True, "phonetic": phonetic, "meanings": meanings}
            # 404 / 502 / 其它非 200 → 视为未找到（不抛错，不缓存）
            return {"found": False}
        except Exception:
            # 瞬时故障：退避后重试
            if attempt < RETRIES:
                time.sleep(1 * (attempt + 1))
    return None


@router.get("/dictionary")
def get_dictionary(word: str = Query(..., min_length=1, description="要查询的英文单词")):
    w = word.strip().lower()
    cached = _get_cache(w)
    if cached is not None:
        return cached
    result = _fetch_dictionary(w)
    if result is None:
        # 上游全部失败：当作未找到，但不缓存，下次再试
        return {"found": False}
    _set_cache(w, result)
    return result


@router.get("/translate")
def translate(q: str = Query(..., min_length=1), langpair: str = "en|zh-CN"):
    """代理 MyMemory 翻译（en→zh-CN 等），失败返回 {translatedText: null} 不抛错。"""
    try:
        r = requests.get(
            TRANSLATE_API, params={"q": q, "langpair": langpair}, timeout=HTTP_TIMEOUT
        )
        if r.status_code != 200:
            return {"translatedText": None}
        data = r.json()
        t = (data.get("responseData") or {}).get("translatedText")
        return {"translatedText": t if t else None}
    except Exception:
        return {"translatedText": None}
