"""
ค่าตั้งต้นของ AI ฝั่งเว็บ (ต้องตรงกับตอนอัด dataset / เทรนใน siamese_learn.ipynb)
"""
import os
import sys
from pathlib import Path

# AI_Detection/ (โฟลเดอร์แม่ของ web_api/) — ใช้ salute_rules.py, models/, dataset/ ร่วมกับ notebook
BASE_DIR = Path(__file__).resolve().parent.parent

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

MODELS_DIR = BASE_DIR / "models"
ENCODER_PATH = MODELS_DIR / "encoder.keras"
THRESHOLD_PATH = MODELS_DIR / "threshold.txt"
RULES_PATH = MODELS_DIR / "rules.json"
CORRECT_DIR = BASE_DIR / "dataset" / "correct"
RESULTS_DIR = BASE_DIR / "results"

# -------------------------
# Server
# -------------------------
# ตอน deploy (Cloud Run / Railway / Docker) ผู้ให้บริการส่ง PORT มาให้ → รับจากภายนอก (0.0.0.0)
# บนเครื่องตัวเองไม่มี PORT → เปิดเฉพาะในเครื่อง (127.0.0.1:8000)
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0" if "PORT" in os.environ else "127.0.0.1")

# เว็บที่อนุญาตให้เชื่อมต่อ: localhost + โดเมนจริงจาก ALLOWED_ORIGINS (คั่นด้วย ,)
# เช่น ALLOWED_ORIGINS=https://rodoor-dance.vercel.app
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *[o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()],
]
# preview deploy ของ Vercel (https://<ชื่อ>-<hash>-<ทีม>.vercel.app) ใส่เป็น regex ได้ เช่น
# ALLOWED_ORIGIN_REGEX=https://rodoor-dance-.*\.vercel\.app
ALLOWED_ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX") or None

# -------------------------
# Timing (เหมือน notebook)
# -------------------------
CLIP_SECONDS = 6              # ความยาวคลิปที่ประเมิน
SAMPLE_FPS = 10
SEQUENCE_LENGTH = CLIP_SECONDS * SAMPLE_FPS   # 60 เฟรม
MAX_FRAME_WIDTH = 640         # ภาพที่ใหญ่กว่านี้จะถูกย่อก่อนเข้า MediaPipe

# โหมดฝึก (realtime)
PREDICT_INTERVAL = 0.5        # ประเมินทุก 0.5 วินาที
FEEDBACK_HISTORY = 3          # แสดง feedback ที่เจอซ้ำอย่างน้อย 2 ใน 3 ครั้งล่าสุด
MAX_FEEDBACK = 3
PASS_SIMILARITY = 70          # ความคล้ายต้นแบบ (เฉลี่ย) เกินนี้ และไม่ผิดกฎข้อไหน = ผ่าน → หยุดประเมิน

# โหมดทดสอบ
NUM_ATTEMPTS = 1              # ทดสอบกี่ครั้งต่อรอบ (ต้องตรงกับ test-panel.tsx)
COUNTDOWN_SECONDS = 3
PRE_ONSET_SECONDS = 2.0       # เก็บช่วงยืนตรงก่อนยกมือ
POST_ONSET_SECONDS = CLIP_SECONDS - PRE_ONSET_SECONDS   # จับเวลาหลังเริ่มยกมือ 4 วินาที
WAIT_TIMEOUT = 10             # ไม่ยกมือภายในกี่วินาที = ไม่ได้ทำท่า
PENALTY_PER_ERROR = 10        # ผิด 1 อย่าง หัก 10%
SIAMESE_PENALTY = 10          # ท่าโดยรวมไม่คล้ายต้นแบบ หักอีก 10%
MIN_SCORE_FRAMES = 15         # ได้ภาพน้อยกว่านี้ใน 6 วิ (< 2.5 FPS) = เน็ตช้าเกินไป ให้ทดสอบใหม่
MIN_IN_FRAME = 0.8            # หัว/เท้าต้องอยู่ในภาพ ≥ 80% ของเวลาจับเวลา
SAVE_RESULTS = os.environ.get("SAVE_RESULTS", "1") == "1"   # บันทึกผลทดสอบลง results/ (บน cloud ปิดได้)
