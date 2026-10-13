"""
ทดสอบ AI ฝั่งเว็บโดยไม่ต้องเปิดกล้อง: ป้อนคลิปจาก dataset เข้า session ทีละเฟรม (เหมือนเว็บส่งมา 10 FPS)

    cd AI_Detection
    py -3.10 web_api/check_offline.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402
import salute_rules as rules_lib  # noqa: E402
from scorer import SaluteScorer  # noqa: E402
from sessions import TestSession, TrainingSession  # noqa: E402

FULL_BODY = {"body": True, "head": True, "feet": True}


def stream(clip, idle_frames=20, tail_frames=60):
    """ยืนตรงก่อน idle_frames เฟรม → คลิปจริง → ค้างท่าสุดท้าย"""
    return [clip[0]] * idle_frames + list(clip) + [clip[-1]] * tail_frames


def run_test_mode(scorer, clip):
    session = TestSession(scorer, num_attempts=1)
    now = 1000.0
    session.handle_command({"type": "start"}, now)

    for features in stream(clip, idle_frames=100):   # นับถอยหลัง 3 วิ + ยืนตรงเก็บข้อมูล 6 วิ
        now += 0.1
        payload = session.update(now, features, FULL_BODY)

        if payload["state"] == "result":
            return payload["result"]

    return None


def run_training_mode(scorer, clip):
    session = TrainingSession(scorer)
    now = 1000.0
    last = None

    for features in stream(clip):
        now += 0.1
        last = session.update(now, features, FULL_BODY)["result"] or last

    return last


def main():
    scorer = SaluteScorer()
    print(f"โหลดโมเดลแล้ว: ท่าต้นแบบ {scorer.reference_count} คลิป | threshold {scorer.threshold:.4f}\n")

    labels = json.loads((config.BASE_DIR / "dataset/incorrect/labels.json").read_text(encoding="utf-8"))
    first_of_each = {}
    for k, v in labels.items():
        first_of_each.setdefault(v[0], k)

    cases = [("ท่าถูก (correct/5)", config.CORRECT_DIR / "5")] + [
        (rules_lib.FEEDBACK_TH[code][0], config.BASE_DIR / "dataset/incorrect" / folder)
        for code, folder in first_of_each.items()
    ]

    print("โหมดทดสอบ (นับถอยหลัง → รอยกมือ → จับเวลา 4 วิ):")
    for name, folder in cases:
        r = run_test_mode(scorer, rules_lib.load_clip(folder))
        errors = ", ".join(e["name"] for e in r["errors"]) or "-"
        print(f"  {name:24s} ความแม่นยำ {r['accuracy']:5.1f}%  คล้าย {r['similarity']:5.1f}%  "
              f"{'ผ่าน' if r['passed'] else 'ไม่ผ่าน':7s} ผิด: {errors}")

    print("\nโหมดฝึก (realtime):")
    for name, folder in cases[:4]:
        r = run_training_mode(scorer, rules_lib.load_clip(folder))
        errors = ", ".join(e["name"] for e in r["errors"]) or "-"
        print(f"  {name:24s} {r['status']:12s} คล้าย {r['similarity']:5.1f}%  feedback: {errors}")

    # ท่าจริงที่บันทึกจากโหมดทดสอบใน notebook (ถ้ามี) — ต้องได้ผลเหมือน notebook
    live_files = sorted(config.RESULTS_DIR.glob("test_2*_sequences.npy"))
    if live_files:
        import numpy as np
        live = np.concatenate([np.load(f) for f in live_files])
        scores = [scorer.score_attempt(s) for s in live]
        print(f"\nท่าจริงจาก results/ ({len(live)} ครั้ง): "
              + " ".join(f"{r['similarity']:.0f}%{'✓' if r['is_similar'] else '✗'}" for r in scores))


if __name__ == "__main__":
    main()
