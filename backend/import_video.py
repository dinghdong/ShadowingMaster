"""一次性导入脚本（Slice 1 骨架）：把 yt-dlp 下载的 <youtube_id>.en.vtt 解析成句级字幕入库。
用法：python import_video.py <youtube_id> <title>
Slice 2 会把它泛化成完整的爬取 CLI。
"""
import html
import re
import json
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Optional

BACKEND = Path(__file__).parent

# 生产用 DATA_DIR 把 media 与 app.db 一起指向挂载卷（/data），开发期退回仓库内路径。
# 此前这两个常量硬编码为容器内的 /app/backend/media 与 /app/app.db，而 API 侧的
# core.config.MEDIA_DIR / core.db.DB_PATH 走的是 DATA_DIR —— 两边不一致的后果是：
#   * 下载产物写进容器可写层，**每次重新部署即全部丢失**；
#   * .vtt 又不在 _upload_assets 的上传清单里（只传 mp4 与封面），丢了就没有副本，
#     backfill_word_timings 因此找不到字幕、静默跳过所有视频；
#   * API 从 /data/media 读，导入器往别处写，只有 OSS 开启时才侥幸不出事。
# 统一到 core 的解析结果，消除这处分叉。
from core.config import MEDIA_DIR  # noqa: E402  （置于 BACKEND 定义后，便于上方注释就近说明）
from core.db import DB_PATH        # noqa: E402

MEDIA = MEDIA_DIR

TS_RE = re.compile(r"(\d+):(\d+):(\d+)\.(\d+)")
TAG_RE = re.compile(r"<[^>]+>")
SKIP_RE = re.compile(r"^\[.*\]$")  # [Music] / [Applause] 等
BRACKET_RE = re.compile(r"\[[^\]]*\]")  # 句中混入的 [music] 等标记，直接剔除
# YouTube 自动字幕常在句首加 ">>" 表示说话人切换（VTT 里是 &gt;&gt;），纯字幕噪声，整段剔除
SPEAKER_RE = re.compile(r"^>+\s*")
# TED / 社区翻译字幕首条 cue 常是译者署名（中文轨尤其明显），不是台词内容，整行剔除。
CREDITS_RE = re.compile(
    r"^\s*(翻译人员|校对人员|译者|审校|字幕翻译|Translator|Reviewer|Translated by|Reviewed by)\s*[:：]",
    re.IGNORECASE,
)


def clean_text(s: str) -> str:
    """清洗一行字幕原文：去 VTT 标签 → 解码 HTML 实体（&gt; &nbsp; &amp; …）→
    非断空格归一 → 去 [music] 等标记 → 去句首说话人标记 >>。"""
    s = TAG_RE.sub("", s)
    s = html.unescape(s)
    s = s.replace("\xa0", " ")  # &nbsp; → 普通空格
    s = BRACKET_RE.sub("", s)
    s = SPEAKER_RE.sub("", s).strip()
    return s


def ts_to_sec(ts: str) -> float:
    m = TS_RE.search(ts)
    h, mnt, s, ms = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return h * 3600 + mnt * 60 + s + ms / 1000


CJK_RE = re.compile(r"[\u4e00-\u9fff\u3040-\u30ff]")


def join_texts(parts) -> str:
    """拼接字幕片段：中日文不用空格分隔（否则译文里会出现「它们 有非常」这种断裂），
    拉丁文仍用空格。"""
    parts = [p for p in parts if p]
    if not parts:
        return ""
    sep = "" if any(CJK_RE.search(p) for p in parts) else " "
    return sep.join(parts)


def parse_vtt(path: Path, full_text: bool = False):
    """解析 YouTube 滚动式自动字幕：每条 cue 只取带卡拉OK标签的'新词行'，天然去重。

    full_text=True：改为拼接 cue 内全部行。用于**译文**字幕（如 zh-Hans）——
    译文的 <c> 标签对应的是源语言词边界，中文没有空格，只取"新词行"会把句子切碎，
    必须整条 cue 都取。
    """
    chunks = []
    lines = path.read_text(encoding="utf-8").splitlines()
    # 轨内出现卡拉OK时间戳 → YouTube 滚动式自动字幕。这类轨里夹着大量 10ms 的
    # 「桥接帧」（如 00:00:01.790 --> 00:00:01.800），整条 cue 只把上一行滚上去、
    # 没有带标签的新词行；若回退到拼接 cue_lines 就会把上一条的词再收一遍。
    rolling = any(KARAOKE_TS_RE.search(l) for l in lines)
    i = 0
    while i < len(lines):
        line = lines[i]
        if "-->" in line:
            start_s, end_s = [t.strip() for t in line.split("-->")[:2]]
            end_s = end_s.split()[0]  # 去掉 align:start 等后缀
            i += 1
            cue_lines = []
            new_line = ""
            # cue 以严格空行结尾；纯空白行（含 position 对齐空格）属于 cue 内容，跳过即可
            while i < len(lines) and lines[i] != "":
                raw = lines[i]
                had_tag = bool(TAG_RE.search(raw))
                clean = clean_text(raw)
                if clean and CREDITS_RE.match(clean):
                    clean = ""  # 译者署名行：丢弃，避免混进第一句台词
                if clean:
                    cue_lines.append(clean)
                    if had_tag:
                        new_line = clean
                i += 1
            # 优先取带卡拉OK标签的"新词行"（YouTube 自动字幕，天然去重）；
            # 无标签时（人工字幕/TED 等非自动字幕）回退到拼接全部 cue 行。
            if full_text:
                text = join_texts(cue_lines)
            elif new_line.strip():
                text = new_line.strip()
            elif rolling:
                # 滚动轨的桥接/翻页帧：无新词行 = 无新内容，整条丢弃。
                # 否则会产出 "many many a many many a person struggle with" 这类重复。
                text = ""
            elif cue_lines:
                text = " ".join(cue_lines)
            else:
                text = ""
            if text:
                chunks.append((ts_to_sec(start_s), ts_to_sec(end_s), text))
        else:
            i += 1
    return chunks


KARAOKE_TS_RE = re.compile(r"<(\d\d:\d\d:\d\d\.\d+)>")


def _word_dur(w: str) -> float:
    """末词时长估算（秒）：按字符数线性外推，约 12 字符/秒 + 起停开销。

    只在**没有下一个词可以界定收尾**时使用。不能直接拿 cue 结束时间当末词结尾——
    说完后字幕常挂在屏幕上等转场音乐走完（实测有 cue 说完 0.4s、却挂满 14s），
    照搬会把句子的 end_time 推到音乐里去。
    """
    return min(1.2, max(0.20, 0.085 * len(w) + 0.15))


def _line_word_times(line: str, cue_st: float, cue_en: float):
    """一行带卡拉OK标签的字幕 → [(t0, word), ...]。

    形如：front<00:00:07.560><c> of</c><00:00:07.680><c> you</c>
    时间戳标记的是其**后面**内容的起点；行首那段没有标签，用 cue 起点。
    单个标签内偶尔含多词（<c> the thing</c>），段内按词数均分。
    """
    parts = KARAOKE_TS_RE.split(line)
    segs = []
    head = clean_text(parts[0]).strip()
    if head:
        segs.append((cue_st, head))
    j = 1
    while j + 1 < len(parts):
        segs.append((ts_to_sec(parts[j]), clean_text(parts[j + 1]).strip()))
        j += 2

    out = []
    for k, (t, text) in enumerate(segs):
        ws = text.split()
        if not ws:
            continue
        nxt = segs[k + 1][0] if k + 1 < len(segs) else cue_en
        span = max(nxt - t, 0.0)
        for m, w in enumerate(ws):
            out.append((t + span * m / len(ws), w))
    return out


def parse_vtt_words(path: Path):
    """从 YouTube 自动字幕抽**真实**词级时间戳 → [(t0, t1, word), ...]。

    轨内完全没有卡拉OK标签（人工字幕 / TED 等）时返回 None，
    由 merge_sentences 回退到 words_stream() 的 cue 内线性插值。

    每个词的 t1 取「下一个词的起点」与「按词长估算的收尾」中较小者：
    前者保证不越界，后者保证句末不会被拖进转场音乐里。
    """
    lines = path.read_text(encoding="utf-8").splitlines()
    raw = []  # [(t0, word, cue_en)]
    i = 0
    while i < len(lines):
        if "-->" not in lines[i]:
            i += 1
            continue
        start_s, end_s = [t.strip() for t in lines[i].split("-->")[:2]]
        cue_st, cue_en = ts_to_sec(start_s), ts_to_sec(end_s.split()[0])
        i += 1
        while i < len(lines) and lines[i] != "":
            line = lines[i]
            i += 1
            if not KARAOKE_TS_RE.search(line):
                continue  # 无标签行 = 滚动上来的旧内容
            for t0, w in _line_word_times(line, cue_st, cue_en):
                raw.append((t0, w, cue_en))
    if not raw:
        return None

    out = []
    for k, (t0, w, cue_en) in enumerate(raw):
        limit = raw[k + 1][0] if k + 1 < len(raw) else cue_en
        t1 = t0 + _word_dur(w)
        if limit > t0:
            t1 = min(t1, limit)
        out.append((t0, max(t1, t0 + 0.01), w))  # 只保证非零长度，不越过下一个词
    return out


TERMINAL = (".", "?", "!", "…")


def ends_sentence(word: str) -> bool:
    """词去掉收尾引号/括号后是否以句末标点结尾（即真实句子边界）。"""
    return word.rstrip("\"'”’)]").endswith(TERMINAL)


def words_stream(chunks):
    """词块展平成词流 [(t0, t1, word)]；块内按词序线性插值。

    ⚠️ 这是**没有真实词级时间戳时**的回退方案：它假设一条 cue 内每个词等时长，
    真人说话并非匀速（同一条 cue 里相邻两词可能停顿 1s 以上），且 cue 常在说完后
    仍挂着等转场音乐，所以精度有限。有 <ts><c> 标签的轨请走 parse_vtt_words()。
    """
    words = []
    for start, end, text in chunks:
        ws = text.split()
        if not ws:
            continue
        span = max(end - start, 0.3)
        step = span / len(ws)
        for i, w in enumerate(ws):
            words.append((start + step * i, start + step * (i + 1), w))
    return words


def merge_sentences(chunks, words=None, max_gap=3.0):
    """分句：源字幕带标点时按标点断句（高上限防呆）；无标点（纯自动字幕）回退到词数/时长规则。
    最后把不足 3 词的碎片并入前一句（前一句本身不是完整句时）。

    words：词流 [(t0, t1, word)]。优先传 parse_vtt_words() 抽出的**真实**词级时间戳；
    None 时回退到 words_stream() 的 cue 内线性插值。

    返回 [(start, end, text, timings)]。timings 是该句每个词的 [t0, t1]（绝对秒），
    与 text.split() 严格一一对应，落库后供前端卡拉OK逐词高亮。
    **words 为 None 时 timings 一律为 None**（等分插值不冒充实测值，理由见函数体注释）。

    end 取末词的**结束**时间（旧实现取的是末词起点再补 0.4s 固定尾巴，既截掉了末词
    本身的时长，又在末词被拖长时对不上）。
    """
    # words is None → 只有 words_stream() 的 cue 内等分插值可用。它仍然拿来**分句**
    # （句子边界靠词流的时间间隔与标点推断），但绝不能当作 word_timings 落库：
    # 前端一旦看到 word_timings 存在且长度匹配，就会关掉线性回退、完全信任它做逐词高亮
    # （见 shared.ts 的 activeWordIndex），于是等分插值被当成实测数据用——句首准、句尾飘。
    # 这比没有数据更糟：word_timings 为 NULL 时前端自己插值，至少是诚实的近似，
    # 而且日后能一眼看出哪些视频还缺真实时间戳。
    real_timings = words is not None
    words = words if words is not None else words_stream(chunks)
    if not words:
        return []
    punct_ratio = sum(1 for _, _, w in words if ends_sentence(w)) / len(words)
    punctuated = punct_ratio > 0.04
    max_words, max_span = (25, 15.0) if punctuated else (10, 9.0)

    sents, buf = [], []
    for t0, t1, w in words:
        if buf and (t0 - buf[-1][0]) > max_gap:
            sents.append(buf)
            buf = []
        buf.append((t0, t1, w))
        if ends_sentence(w) or len(buf) >= max_words or (t0 - buf[0][0]) >= max_span:
            sents.append(buf)
            buf = []
    if buf:
        sents.append(buf)

    out = []
    for b in sents:
        if not b:
            continue
        text = " ".join(w for _, _, w in b)
        tim = [[round(t0, 3), round(t1, 3)] for t0, t1, _ in b]
        if out and len(b) < 3 and out[-1][2] and not ends_sentence(out[-1][2].split()[-1]):
            ps, _pe, pt, ptim = out.pop()
            out.append((ps, b[-1][1], f"{pt} {text}", ptim + tim))
        else:
            out.append((b[0][0], b[-1][1], text, tim))
    # 首字母大写不改变词数，timings 与 text.split() 仍一一对应
    return [(st, en, t[0].upper() + t[1:], tim if real_timings else None)
            for st, en, t, tim in out if t]


def _split_karaoke_line(line: str, cue_st: float, cue_en: float):
    """把带卡拉OK时间戳的行切成 [(t0, t1, 文本), ...]。

    形如：清洗<00:00:00.493><c>奶酪刨</c><00:00:00.826><c>丝器</c>
    时间戳标记的是其后内容的**开始**，因此第 i 段的区间 = [ts_i, ts_{i+1})，
    末段收尾于 cue 结束时间。
    """
    toks = re.split(r"<(\d\d:\d\d:\d\d\.\d+)>", line)
    if len(toks) < 3:  # 无时间戳 → 整行按 cue 跨度处理
        return [(cue_st, cue_en, line)]

    marks = []
    i = 1
    while i + 1 < len(toks):
        marks.append((ts_to_sec(toks[i]), toks[i + 1]))
        i += 2

    segs = []
    if toks[0].strip():
        segs.append((cue_st, marks[0][0], toks[0]))
    for j, (ts, body) in enumerate(marks):
        t1 = marks[j + 1][0] if j + 1 < len(marks) else cue_en
        if body.strip():
            segs.append((ts, t1, body))
    return segs


# 单独的括号/引号片段：滚动轨把 "[笑声]" 拆成 '[' '笑声' ']' 三帧逐词推进，
# 逐帧清洗时 BRACKET_RE 匹配不到完整括号，会留下 '[笑声'、']xxx' 这类残片。
STRAY_BRACKET_RE = re.compile(r"^[\[\]\(\)（）【】「」<>]+$")
# 音效/现场提示：非台词内容。英文原文里就有 "(Laughter)"，中文侧再带一遍是冗余，
# 且被滚动帧拆散后会变成 "[音乐就" 这类残片混进译文 → 整帧丢弃。
SOUND_RE = re.compile(
    r"^[\[\(（【]?\s*(音乐|音乐声|笑声|掌声|欢呼|鼓掌|咳嗽|噪声|背景音|"
    r"Music|Laughter|Applause|Cheering|Noise)\s*[\]\)）】]?[.!?。…]*$",
    re.IGNORECASE,
)


def parse_zh_timed(path: Path):
    """解析中文译文轨 → [(start, end, 文本), ...]，切到「新内容」粒度并带精确时间戳。

    中文轨是**双行滚动窗口**：line1 = 上一行旧内容，line2 = 本行新内容。
    所以只取最后一行（line2）—— 旧内容已在它自己那条 cue 里收过了，再取就是重复。
    line2 为空白说明这条 cue 只是把上一行滚上去，没有新内容，直接跳过。

    line2 常带卡拉OK时间戳，可切到词组粒度；无标签时退回 cue 跨度。

    ⚠️ 必须**逐行**解析，不能用 re.split(r"\\n\\s*\\n") 分块：滚动轨的 line2 经常是
    单个空格 " "，贪婪的 \\s* 会把 " \\n\\n" 整段当成块分隔符吞掉，于是 content[-1]
    退化为 line1（旧内容）→ 每条 cue 的新内容被重复收两次（线上表现为
    「清洗奶酪刨丝器简直是一场清洗奶酪刨丝器简直是一场噩梦」）。

    返回按时间排序、互不重叠的片段，供 align_chinese 一对一归属到英文句。
    """
    lines = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()
    out = []
    i = 0
    while i < len(lines):
        if "-->" not in lines[i]:
            i += 1
            continue
        head = lines[i]
        start_s, end_s = [t.strip() for t in head.split("-->")[:2]]
        end_s = end_s.split()[0]  # 去掉 align:start 等后缀
        st, en = ts_to_sec(start_s), ts_to_sec(end_s)
        i += 1
        # cue 以**严格空行**结尾；纯空白行（" "）是滚动轨的有效内容行，必须保留
        body = []
        while i < len(lines) and lines[i] != "":
            body.append(lines[i])
            i += 1
        if not body:
            continue
        new_line = body[-1]
        if not new_line.strip():
            continue  # 纯滚动帧（line2 空白），无新内容
        for t0, t1, txt in _split_karaoke_line(new_line, st, en):
            clean = clean_text(txt)
            if not clean or SKIP_RE.match(clean) or CREDITS_RE.match(clean):
                continue
            if STRAY_BRACKET_RE.match(clean) or SOUND_RE.match(clean):
                continue  # '[' / ']' 等孤立括号残片、[笑声]/[音乐] 等音效帧
            # 括号被滚动帧拆到不同帧时，单帧里只剩半边括号（如 "，[就"），直接剥掉
            if ("[" in clean) != ("]" in clean):
                clean = clean.replace("[", "").replace("]", "").strip()
            out.append((t0, t1, clean))
    out.sort(key=lambda c: c[0])
    return out


def dedup_rolling(texts):
    """滚动字幕去重：部分译文轨是「双行滚动窗口」（line1 = 上一行旧内容，line2 = 本行新内容），
    相邻 cue 会重复携带旧行。若把 cue 全文直接按时间序拼接，译文会出现
    「清洗奶酪刨丝器简直是一场清洗奶酪刨丝器简直是一场噩梦」这类重复。

    做法：对时间序上相邻的 cue，把「与已累积译文尾部重合的前缀」视为滚动下来的旧内容，
    只保留增量后缀。非滚动轨（相邻 cue 无文本重叠）不会被误伤。

    安全阈值：只剥离长度 ≥2 的重合片段，避免单字巧合（如「的」）吃掉真实内容。
    """
    kept, acc = [], ""
    for t in texts:
        t = (t or "").strip()
        if not t:
            continue
        k = 0
        if acc:
            for i in range(min(len(acc), len(t)), 1, -1):
                if acc.endswith(t[:i]):
                    k = i
                    break
        rest = t[k:].strip()
        if rest:
            kept.append(rest)
            acc = join_texts(kept)
    return kept


def strip_rolling_track(chunks):
    """整条译文轨的「滚动差分」：按时间序把每个 chunk 里与前面已出现内容重合的前缀剥掉，
    只留真正的增量，空增量的帧（10ms 桥接帧）直接丢弃。

    为什么必须在轨级别做、而不能只在 align_chinese 的 bucket 内做：
    滚动 CC 轨（YouTube 自动翻译的 zh-Hans 等）每帧 cue = 上一窗口旧行 + 本行新内容，
    而 _zh_units() 会把连续若干帧聚成一条 unit —— 若这些帧未先做差分，重复就被
    **固化进 unit 文本内部**，此后 bucket 级的 dedup_rolling 只能比对 item 之间，
    对 item 内部的重复无能为力（实测出现「…收入将达到×3」）。
    同时，旧行的时间戳落在本句区间、内容却属上一句，正是「每句句首残留上一句尾巴」的来源；
    差分后每帧只剩增量，归属自然正确。

    非滚动轨（人工上传 / TED 那种干净 cue）相邻帧无文本重叠 → 逐帧 rest 等于原文，不受影响。
    安全阈值沿用 dedup_rolling：只剥离长度 ≥2 的重合，避免单字巧合吃掉真实内容。
    """
    out, acc = [], ""
    for st, en, t in chunks:
        t = (t or "").strip()
        if not t:
            continue
        k = 0
        if acc:
            for i in range(min(len(acc), len(t)), 1, -1):
                if acc.endswith(t[:i]):
                    k = i
                    break
        rest = t[k:].strip()
        if rest:
            out.append((st, en, rest))
            acc = join_texts([x[2] for x in out])
    return out


CJK_TERMINAL = "。？！…．?!;"


def _zh_units(zh_chunks):
    """把细粒度中文字幕片段按句末标点聚成「中文句」→ [(start, end, 文本), ...]。

    滚动轨把「。」也作为独立的一帧推出来（如 '是' '的' '。' 三帧），所以必须按
    **标点**重新聚合，否则单看片段无法判断句子边界。每条 unit 以遇到句末标点收尾，
    未收尾的尾巴（正在滚动显示中的半句）也保留，避免丢字。
    """
    units, buf = [], []
    for st, en, text in zh_chunks:
        buf.append((st, en, text))
        if text and text[-1] in CJK_TERMINAL:
            units.append((buf[0][0], buf[-1][1], join_texts([t for _, _, t in buf]), list(buf)))
            buf = []
    if buf:
        units.append((buf[0][0], buf[-1][1], join_texts([t for _, _, t in buf]), list(buf)))
    return units


def _dp_assign(units, sents, gap=0.6):
    """单调 DP：把中文句分配到英文句，最大化「时间中心接近度」并惩罚空句。

    为什么用 DP 而不是逐句贪心：两轨都有 ±0.3s 抖动，且滚动 CC 轨相邻英文句的
    时间区间互相重叠（窗口里同时显示上下两行）。贪心在长英文句处会一路吞掉属于
    下一句的译文，表现为「上一句译文拖个尾巴、下一句整句为空」。

    DP 的三个转移（i=英文句, j=中文句）：
      1. 本句以 unit j 开头  dp[i-1][j-1] + score
      2. 本句续接 unit j     dp[i][j-1]   + score
      3. 本句留空            dp[i-1][j]   - gap
    score = -|unit 时间中心 - 英文句时间中心|（秒）。gap 让「留白」有代价，
    从而在长句处自然让位给后续句子，而不是一路吞并。
    """
    n, m = len(units), len(sents)
    ucen = [(u[0] + u[1]) / 2.0 for u in units]
    ecen = [(a + b) / 2.0 for a, b, *_ in sents]
    NEG = float("-inf")
    dp = [[NEG] * (n + 1) for _ in range(m + 1)]
    bk = [[0] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0.0
    for i in range(1, m + 1):
        dp[i][0] = dp[i - 1][0] - gap
    for i in range(1, m + 1):
        dpi, dpim1, bki = dp[i], dp[i - 1], bk[i]
        ei = ecen[i - 1]
        for j in range(1, n + 1):
            sc = -abs(ucen[j - 1] - ei)
            best, code = dpim1[j - 1] + sc, 1
            cont = dpi[j - 1] + sc
            if cont > best:
                best, code = cont, 2
            skip = dpim1[j] - gap
            if skip > best:
                best, code = skip, 0
            dpi[j] = best
            bki[j] = code
    assign = [[] for _ in range(m)]
    i, j = m, n
    while i > 0 and j > 0:
        code = bk[i][j]
        if code == 0:
            i -= 1
            continue
        assign[i - 1].append(j - 1)
        j -= 1
        if code == 1:
            i -= 1
    return assign


def _spill_targets(i, ust, uen, sents):
    """某条中文句（unit）除了 DP 指定的英文句 i 之外，还真正「覆盖」了哪些英文句。

    判据：unit 的时间区间覆盖该英文句时长的 ≥50% **且** ≥0.6s。加绝对下限是因为短句
    （<1.2s，对话类视频很常见）上 50% 判据会被 ±0.3s 的边界抖动触发，把一句话的译文
    劈成两半（实测出现「是」/「的。」这种碎片）。
    """
    targets = [i]
    k = i + 1
    while k < len(sents):
        st, en = sents[k][0], sents[k][1]
        if st >= uen:
            break
        if min(uen, en) - max(ust, st) >= max(0.5 * (en - st), 0.6):
            targets.append(k)
        k += 1
    k = i - 1
    while k >= 0:
        st, en = sents[k][0], sents[k][1]
        if en <= ust:
            break
        if min(uen, en) - max(ust, st) >= max(0.5 * (en - st), 0.6):
            targets.insert(0, k)
        k -= 1
    return targets


def align_chinese(sents, zh_chunks):
    """把中文字幕（YouTube 官方译文轨）按时间轴对齐到已切好的英文句子。

    英文句子是我们自己按标点/词数合并出来的，与中文字幕的 cue 边界并不一致，
    所以这里做的是「区间重叠拼接」而非一一对应：
    - 与该英文句时间区间有重叠的中文 cue，按时间序拼接成该句的译文；
    - 完全没有重叠时（译文轨时间轴漂移/缺失片段），退化为取中心点最近的一条 cue，
      避免整句中文为空而把句子推回机器翻译。
    """
    if not zh_chunks:
        return []
    # 滚动 CC 轨（自动翻译译文）先做全轨差分，去掉每帧重复携带的上一窗口旧内容。
    # 必须放在 _zh_units 之前：unit 一旦把未去重的帧拼起来，重复就固化在 unit 内部了。
    zh_chunks = strip_rolling_track(zh_chunks)
    if not zh_chunks:
        return []

    units = _zh_units(zh_chunks)
    buckets = [[] for _ in sents]

    if units and len(units) * len(sents) <= 3_000_000:
        # 主干路径：先按句末标点把中文聚成「句」，再做单调 DP 对齐。
        #
        # 为什么不能只按时间归属？滚动字幕轨（CC）的相邻英文句时间区间是**互相重叠**的
        # （窗口里同时显示上下两行），且中英两轨各自有 ±0.3s 抖动。按中点/最大重叠归属
        # 会把「下一句的开头」判给上一句，表现为译文句首多一个字、下一句少一个字。
        for i, uidxs in enumerate(_dp_assign(units, sents)):
            for uid in uidxs:
                ust, uen, utext, frags = units[uid]
                targets = _spill_targets(i, ust, uen, sents)
                if len(targets) == 1:
                    buckets[i].append((ust, utext))
                    continue
                # 译文常把相邻两句用「，」连成一条 unit，而英文仍切成两句 →
                # unit 内退回到片段级，按时间重叠分给各自那一句。
                for fst, fen, ftext in frags:
                    best_k, best_ov = i, None
                    for k in targets:
                        ov = min(fen, sents[k][1]) - max(fst, sents[k][0])
                        if best_ov is None or ov > best_ov:
                            best_k, best_ov = k, ov
                    buckets[best_k].append((fst, ftext))
    else:
        # 兜底：中文句数与英文句数差得远（译文轨缺段、或英文字幕本就未按句合并），
        # 仍按时间一对一归属，保证每个片段只进一句、不重复。
        for zst, zen, ztext in zh_chunks:
            mid = (zst + zen) / 2
            hit = None
            for i, (st, en, *_) in enumerate(sents):
                if st <= mid <= en:
                    hit = i
                    break
            if hit is None:
                best_i, best_d = None, None
                for i, (st, en, *_) in enumerate(sents):
                    d = abs((st + en) / 2 - mid)
                    if best_d is None or d < best_d:
                        best_i, best_d = i, d
                hit = best_i
            buckets[hit].append((zst, ztext))

    out = []
    for items in buckets:
        items.sort()  # 按时间序
        # 兜底去重：个别轨的 line2 仍可能重复携带上一行
        out.append(join_texts(dedup_rolling([t for _, t in items])))
    return out


def probe_duration(mp4: Path) -> Optional[int]:
    # ffmpeg 缺失时返回 None，由调用方回退到 yt-dlp 元信息里的 duration
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp4)],
            capture_output=True, text=True, check=True,
        )
        return int(float(out.stdout.strip()))
    except Exception:
        return None


def ingest(youtube_id: str, title: str, duration: Optional[int] = None, description: Optional[str] = None, tags: Optional[list] = None) -> int:
    """把 media/ 下已下载的 <youtube_id>.en.vtt/.mp4 解析入库，返回 video_id。
    duration 可选：ffmpeg 缺失时由调用方传入 yt-dlp 元信息里的时长。
    description / tags 可选：来自 yt-dlp 元信息，tags 以 JSON 字符串入库。
    """
    vtt = MEDIA / f"{youtube_id}.en.vtt"
    mp4 = MEDIA / f"{youtube_id}.mp4"
    if not vtt.exists() or not mp4.exists():
        missing = []
        if not vtt.exists():
            missing.append(str(vtt))
        if not mp4.exists():
            missing.append(str(mp4))
        raise FileNotFoundError(
            f"导入失败：{', '.join(missing)} 不存在。"
            "通常是 yt-dlp 未成功下载完整视频或英文字幕，请检查下载阶段日志。"
        )

    # 优先用字幕轨自带的真实词级时间戳（YouTube 自动字幕的 <ts><c> 标签）；
    # 人工字幕轨没有标签 → parse_vtt_words 返回 None → 回退 cue 内线性插值。
    word_stream = parse_vtt_words(vtt)
    sents = merge_sentences(parse_vtt(vtt), words=word_stream)
    print(f"词级时间戳：{'真实（' + str(len(word_stream)) + ' 词）' if word_stream else '无标签轨，回退线性插值'}")
    if duration is None:
        duration = probe_duration(mp4) or 0

    # 中文译文：优先用 YouTube 官方译文轨（zh-Hans 等，由 fetch_video 下载为 *.zh.vtt）。
    # 相比调第三方翻译 API，官方译文无限流、质量更好，且时间轴与英文字幕同源。
    # 只有在译文轨缺失/未覆盖到的句子上，才留给 translate_video 走机器翻译补漏。
    zh_map = []
    zh_vtt = MEDIA / f"{youtube_id}.zh.vtt"
    if zh_vtt.exists():
        zh_chunks = parse_vtt(zh_vtt, full_text=True)
        zh_map = align_chinese(sents, zh_chunks)
        filled = sum(1 for x in zh_map if x)
        print(f"中文字幕轨：{len(zh_chunks)} 条，覆盖 {filled}/{len(sents)} 句")

    # 封面：ffmpeg 缺失时 yt-dlp 可能只产出 webp/png，按扩展名依次查找
    thumb_url = None
    for ext in ("jpg", "webp", "png"):
        if (MEDIA / f"{youtube_id}.{ext}").exists():
            thumb_url = f"/media/{youtube_id}.{ext}"
            break

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    old = conn.execute("SELECT id FROM videos WHERE youtube_id = ?", (youtube_id,)).fetchone()
    if old:
        conn.execute("DELETE FROM sentences WHERE video_id = ?", (old["id"],))
        conn.execute("DELETE FROM videos WHERE id = ?", (old["id"],))
    cur = conn.execute(
        "INSERT INTO videos (youtube_id, title, duration_seconds, thumbnail_url, video_path, sentence_count, description, tags) VALUES (?,?,?,?,?,?,?,?)",
        (youtube_id, title, duration, thumb_url, f"/media/{youtube_id}.mp4", len(sents), description, json.dumps(tags or [], ensure_ascii=False)),
    )
    vid = cur.lastrowid
    conn.executemany(
        "INSERT INTO sentences (video_id, sentence_index, start_time, end_time, english_text, chinese_text, word_timings) VALUES (?,?,?,?,?,?,?)",
        # tim 为 None（无真实词级时间戳）时写 SQL NULL，不能走 json.dumps —— 它会产出
        # 字符串 "null"，前端拿到的就是个非空值，反而绕过了回退判断。
        [(vid, idx, st, en, text, (zh_map[idx] if idx < len(zh_map) else None),
          json.dumps(tim, separators=(",", ":")) if tim else None)
         for idx, (st, en, text, tim) in enumerate(sents)],
    )
    conn.commit()
    conn.close()
    print(f"导入完成：video_id={vid}，{len(sents)} 句，时长 {duration}s")
    for st, en, t, _tim in sents[:5]:
        print(f"  [{st:6.1f}-{en:6.1f}] {t}")
    return vid


def main():
    ingest(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    main()
