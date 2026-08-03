import os, asyncio, subprocess, json
from pathlib import Path
import edge_tts

HOME = Path("/Users/dingdongdong/Workspace/AI-APP/ShadowingMaster/docs/product-intro/remotion/voice")
HOME.mkdir(parents=True, exist_ok=True)

VOICE = "zh-CN-XiaoxiaoNeural"  # 温暖女声，适合产品介绍

# 每段：开始秒、文案（与画面场景对齐）
SCENES = [
    (0.0,  "学了这么多年英语，开口还是没底气？其实不是你不努力，是少了跟读这一环。"),
    (8.0,  "回声跟读，练出地道口语。像影子一样紧跟原声，复述每一句。"),
    (16.0, "三步，把原声变成你的口语。看原声、逐句跟读、查词积累，闭环练熟。"),
    (24.0, "为跟读而生的每一处细节。智能高亮难词、点词即查、进度可视、海量素材。"),
    (34.0, "现在，开始你的第一次跟读。访问 shadowingmaster 点 genisource 点 studio。"),
]
TOTAL = 41.5
BREATH = 0.4  # 场景之间留白

async def gen():
    clips = []
    for i, (start, text) in enumerate(SCENES):
        end = SCENES[i + 1][0] if i + 1 < len(SCENES) else TOTAL
        slot = round(end - start, 3)
        mp3 = HOME / f"scene_{i}.mp3"
        comm = edge_tts.Communicate(text, VOICE, rate="+4%")
        await comm.save(str(mp3))
        clips.append((slot, mp3, i))
        print(f"scene {i}: slot={slot}s  -> {mp3.name}")
    return clips

def build_timeline(clips):
    ff = "/opt/homebrew/bin/ffmpeg"
    inputs = []
    filters = []
    for slot, mp3, i in clips:
        inputs += ["-i", str(mp3)]
        # 取前 slot-BREATH 秒（自然朗读），补静音到整段长，避免相邻硬切
        take = round(slot - BREATH, 3)
        filters.append(f"[{i}]atrim=0:{take},apad,atrim=0:{slot}[a{i}]")
    concat = "".join(f"[a{i}]" for _, _, i in clips)
    filters.append(f"{concat}concat=n={len(clips)}:v=0:a=1[out]")
    out = HOME / "narration.wav"
    cmd = [ff, "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]", str(out)]
    subprocess.run(cmd, check=True)
    print("narration ->", out)
    return out

if __name__ == "__main__":
    clips = asyncio.run(gen())
    build_timeline(clips)
