"""
สร้างไฟล์เสียง feedback ล่วงหน้า — รันครั้งเดียว แล้วเว็บเล่นไฟล์เอง (เล่นได้ทุกเบราว์เซอร์)

    cd AI_Detection
    py -3.10 web_api/generate_voices.py            # สร้างเฉพาะประโยคที่ยังไม่มี / ข้อความหรือเสียงเปลี่ยน
    py -3.10 web_api/generate_voices.py --list     # ดูรายการประโยค (ไม่เรียก API)
    py -3.10 web_api/generate_voices.py --force    # สร้างใหม่ทั้งหมด

เสียง (--engine)
    auto    (ค่าเริ่มต้น) มี Botnoi API key → Botnoi "โตโต้" / ไม่มี → Microsoft Edge TTS
    botnoi  Botnoi Voice เสียงโตโต้ (ต้องมี API key, เสีย point)
    edge    Microsoft Edge TTS เสียงไทย (ฟรี ไม่ต้องใช้ key ต้องต่อเน็ตตอนสร้าง)

Botnoi API key: ใส่ใน web_api/.env  →  BOTNOI_API_KEY=xxxxxxxx
(ได้จาก voice.botnoi.ai → Developer / API, ไฟล์ .env ไม่ถูก commit ขึ้น git)
ใส่ key แล้วรันใหม่ → ไฟล์เสียง Edge ถูกแทนที่ด้วยเสียงโตโต้อัตโนมัติ

ไฟล์ที่ได้: rodoorweb/public/sounds/salute/<key>.mp3 + manifest.json
เพิ่ม/แก้ข้อความ feedback ใน salute_rules.py (FEEDBACK_TH) แล้วรันสคริปต์นี้ใหม่ — สร้างเฉพาะประโยคที่เปลี่ยน
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

WEB_API_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(WEB_API_DIR))

import config  # noqa: E402
import salute_rules as rules_lib  # noqa: E402

# -------------------------
# Botnoi Voice (Developer API อย่างเป็นทางการ)
# -------------------------
API_URL = "https://api-voice.botnoi.ai/openapi/v1/generate_audio"
SPEAKER = "30"        # โตโต้ (เลขจาก Voice Studio)
SPEED = 0.9           # 0–2 (1 = ปกติ)
VOLUME = 2.0          # 0–2 (Voice Studio 200% = 2.0)
LANGUAGE = "th"

# -------------------------
# Microsoft Edge TTS (ฟรี)
# -------------------------
EDGE_VOICE = "th-TH-NiwatNeural"     # ชาย (หญิง: th-TH-PremwadeeNeural)
EDGE_RATE = "-5%"                    # ช้าลงเล็กน้อยให้ฟังชัด

OUTPUT_DIR = config.BASE_DIR.parent / "public" / "sounds" / "salute"

# ประโยคที่ต้องเว้นจังหวะ: key → [(คำ, เว้นหลังคำนี้กี่วินาที), ...]
# สร้างทีละคำ ตัดช่วงเงียบหัว-ท้ายออก แล้วต่อกันด้วยช่วงเงียบตามที่กำหนด (จังหวะแม่นทุกเสียง)
VOICE_SEQUENCES = {
    "command": [("ตรงหน้า", 0.5), ("วันทยหัตถ์", 0.5), ("ยกอก", 0.7), ("อึ้บ", 0.0)],
}


def sequence_text(parts):
    return " ".join(f"{word} [{pause}]" if pause else word for word, pause in parts)


# ประโยคที่พูดในโหมดฝึก: key → ข้อความ
# (ข้อความสถานะต้องตรงกับ STATUS_SPEECH / COMMAND ใน app/components/salute-ai/training-panel.tsx)
VOICE_LINES = {
    **{key: sequence_text(parts) for key, parts in VOICE_SEQUENCES.items()},
    "passed": "ผ่าน ท่าถูกต้อง",
    "correct": "ท่าถูกต้อง ดีมาก",
    "not_similar": "ท่ายังไม่ตรงกับต้นแบบ ลองทำใหม่อีกครั้ง",
    "no_body": "ถอยให้เห็นทั้งตัว",
    # feedback แต่ละข้อ = บอกจุดที่ผิด + วิธีแก้ (ต้องตรงกับ voiceLine ใน training-panel.tsx)
    **{code: f"{name} {tip}" for code, (name, tip) in rules_lib.FEEDBACK_TH.items()},
}


def load_api_key():
    """คืน Botnoi API key หรือ None"""
    key = os.environ.get("BOTNOI_API_KEY")
    env_file = WEB_API_DIR / ".env"

    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("BOTNOI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")

    return key or None


def post_json(url, payload, headers):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def generate_botnoi(text, api_key, save_path):
    payload = {
        "text": text,
        "speaker": SPEAKER,
        "volume": VOLUME,
        "speed": SPEED,
        "type_media": "mp3",
        "save_file": "true",
        "language": LANGUAGE,
        "page": "user",
    }

    try:
        data = post_json(API_URL, payload, {"Botnoi-Token": api_key})
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")[:300]
        hint = " (API key ผิด หรือหมดอายุ)" if error.code in (401, 403) else ""
        raise RuntimeError(f"Botnoi ตอบ HTTP {error.code}{hint}: {body}") from None

    audio_url = data.get("audio_url")

    if not audio_url:
        raise RuntimeError(f"ไม่พบ audio_url ในคำตอบ: {data}")

    with urllib.request.urlopen(audio_url, timeout=60) as response:
        save_path.write_bytes(response.read())

    return data.get("point") or data.get("used_points")


def generate_edge(text, save_path):
    import edge_tts

    asyncio.run(edge_tts.Communicate(text, EDGE_VOICE, rate=EDGE_RATE).save(str(save_path)))


# -------------------------
# ต่อเสียงหลายคำ + เว้นจังหวะ (ใช้ ffmpeg จาก imageio-ffmpeg)
# -------------------------
SAMPLE_RATE = 24000
SILENCE_LEVEL = 400          # แอมพลิจูดต่ำกว่านี้ = เงียบ (int16)
EDGE_PAD_SECONDS = 0.03      # เหลือช่วงเงียบหัว-ท้ายคำไว้นิดหน่อย ไม่ให้เสียงขาด


def _ffmpeg():
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def _decode(path):
    import numpy as np

    raw = subprocess.run(
        [_ffmpeg(), "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16)


def _trim_silence(samples):
    import numpy as np

    loud = np.where(np.abs(samples.astype(np.int32)) > SILENCE_LEVEL)[0]

    if not len(loud):
        return samples

    pad = int(EDGE_PAD_SECONDS * SAMPLE_RATE)
    return samples[max(0, loud[0] - pad):loud[-1] + pad]


def _encode(samples, save_path):
    subprocess.run(
        [_ffmpeg(), "-v", "error", "-y", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "-",
         "-b:a", "64k", str(save_path)],
        input=samples.tobytes(), check=True,
    )


def generate_sequence(parts, synthesize, save_path):
    """parts = [(คำ, เว้นหลังคำกี่วินาที)] → ไฟล์เดียวที่เว้นจังหวะตามกำหนด"""
    import numpy as np

    pieces = []

    with tempfile.TemporaryDirectory() as tmp:
        for index, (word, pause) in enumerate(parts):
            word_path = Path(tmp) / f"{index}.mp3"
            synthesize(word, word_path)
            pieces.append(_trim_silence(_decode(word_path)))
            # ช่วงเงียบที่เผื่อไว้หัว-ท้ายคำนับรวมในจังหวะด้วย
            gap = max(0.0, pause - 2 * EDGE_PAD_SECONDS) if pause else 0.0
            pieces.append(np.zeros(int(gap * SAMPLE_RATE), dtype=np.int16))

    _encode(np.concatenate(pieces), save_path)


def main():
    parser = argparse.ArgumentParser(description="สร้างไฟล์เสียง feedback (Botnoi / Edge TTS)")
    parser.add_argument("--list", action="store_true", help="แสดงรายการประโยค ไม่เรียก API")
    parser.add_argument("--force", action="store_true", help="สร้างใหม่ทั้งหมด")
    parser.add_argument("--engine", choices=["auto", "botnoi", "edge"], default="auto")
    args = parser.parse_args()

    api_key = load_api_key()
    engine = args.engine if args.engine != "auto" else ("botnoi" if api_key else "edge")

    if engine == "botnoi" and not api_key:
        sys.exit(
            "ไม่พบ Botnoi API key - ใส่ใน web_api/.env  →  BOTNOI_API_KEY=xxxxxxxx\n"
            "(หรือใช้ --engine edge เพื่อสร้างด้วยเสียงฟรีของ Microsoft)"
        )

    voice = f"botnoi:{SPEAKER}:{SPEED}" if engine == "botnoi" else f"edge:{EDGE_VOICE}:{EDGE_RATE}"

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    # สร้างใหม่เมื่อ: ยังไม่มีไฟล์ / ข้อความเปลี่ยน / เปลี่ยนเสียง
    todo = {
        key: text for key, text in VOICE_LINES.items()
        if args.force
        or manifest.get(key, {}).get("text") != text
        or manifest.get(key, {}).get("voice") != voice
        or not (OUTPUT_DIR / f"{key}.mp3").exists()
    }

    print(f"ประโยคทั้งหมด {len(VOICE_LINES)} | ต้องสร้าง {len(todo)} | เสียง: {voice}")

    for key, text in VOICE_LINES.items():
        print(f"  {'*' if key in todo else ' '} {key:22s} {text}")

    if args.list or not todo:
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = 0

    for key, text in todo.items():
        if engine == "botnoi":
            synthesize = lambda words, path: generate_botnoi(words, api_key, path)  # noqa: E731
        else:
            synthesize = generate_edge

        try:
            if key in VOICE_SEQUENCES:
                generate_sequence(VOICE_SEQUENCES[key], synthesize, OUTPUT_DIR / f"{key}.mp3")
            else:
                synthesize(text, OUTPUT_DIR / f"{key}.mp3")
            points = None
        except Exception as error:   # แสดงข้อผิดพลาดแล้วทำประโยคถัดไป
            failed += 1
            print(f"  ✗ {key}: {error}")
            continue

        manifest[key] = {"text": text, "file": f"{key}.mp3", "voice": voice}
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  ✓ {key}" + (f"  (ใช้ {points} point)" if points else ""))

    print(f"\nเสร็จ: {len(todo) - failed}/{len(todo)} ไฟล์ → {OUTPUT_DIR}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
