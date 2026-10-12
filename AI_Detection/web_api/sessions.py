"""
สถานะของผู้ใช้ 1 คน (1 WebSocket)

- TrainingSession: โหมดฝึก — ประเมินต่อเนื่องจาก 6 วินาทีล่าสุด (เหมือน cell 5 Test ใน siamese_learn)
- TestSession: โหมดทดสอบ — นับถอยหลัง → รอยกมือ → จับเวลา 4 วิ → ผล (เหมือน siamese_test_mode)

ทั้งสองคลาสรับ (เวลา, features, framing) ทีละเฟรม และไม่ยุ่งกับกล้อง/MediaPipe
จึงทดสอบได้ด้วยคลิปจาก dataset โดยไม่ต้องเปิดกล้อง (ดู check_offline.py)
"""
import json
from collections import deque
from datetime import datetime

import numpy as np

import config
import salute_rules as rules_lib
from scorer import feedback_items, resample_fixed


def framing_message(framing):
    if not framing["body"]:
        return "ตรวจไม่เจอตัว - ถอยให้เห็นทั้งตัว"
    if not framing["head"] and not framing["feet"]:
        return "หัวและเท้าหลุดเฟรม - ถอยห่างกล้องให้เห็นทั้งตัว"
    if not framing["head"]:
        return "หัวหลุดเฟรม - ถอยห่างกล้องให้เห็นทั้งตัว"
    if not framing["feet"]:
        return "เท้าหลุดเฟรม - ถอยห่างกล้องให้เห็นทั้งตัว"
    return None


# =====================================================================
# โหมดฝึก
# =====================================================================
class TrainingSession:
    mode = "training"

    def __init__(self, scorer):
        self.scorer = scorer
        self.buffer = deque()            # (time, features)
        self.error_history = deque(maxlen=config.FEEDBACK_HISTORY)
        self.score_history = deque(maxlen=5)
        self.last_predict = 0.0
        self.last_result = None
        self.passed = False

    def reset(self):
        self.buffer.clear()
        self.error_history.clear()
        self.score_history.clear()
        self.last_result = None

    def handle_command(self, command, now):
        if command.get("type") == "reset":
            # เริ่มฝึกรอบใหม่ (หลังผ่าน หรือกดเริ่มใหม่)
            self.reset()
            self.passed = False
        return {"state": "warming_up", "result": None}

    def update(self, now, features, framing):
        if self.passed:
            # ผ่านแล้ว → หยุดประเมิน (ยังส่งโครงกระดูกให้วาดตามปกติ) จนกว่าจะสั่ง reset
            return {"state": "passed", "message": None, "result": self.last_result}

        if features is None:
            self.reset()
            return {"state": "no_body", "message": framing_message(framing), "result": None}

        self.buffer.append((now, features))

        while now - self.buffer[0][0] > config.CLIP_SECONDS:
            self.buffer.popleft()

        buffered = now - self.buffer[0][0]
        ready = buffered >= config.CLIP_SECONDS - 0.3

        if ready and now - self.last_predict >= config.PREDICT_INTERVAL:
            self.last_predict = now
            self.last_result = self._evaluate(now)

        return {
            "state": "running" if ready else "warming_up",
            "buffer_seconds": round(min(buffered, config.CLIP_SECONDS), 1),
            "message": framing_message(framing),
            "result": self.last_result,
        }

    def _evaluate(self, now):
        times, frames = zip(*self.buffer)
        sequence = resample_fixed(times, frames, now)

        siamese = self.scorer.similarity(sequence)
        self.score_history.append(siamese["similarity"])
        self.error_history.append(self.scorer.errors(sequence))

        # แสดงเฉพาะข้อที่เจอซ้ำอย่างน้อย 2 ใน 3 ครั้งล่าสุด (กันข้อความกระพริบ)
        need = min(2, len(self.error_history))
        errors = [
            code for code in rules_lib.PRIORITY
            if sum(code in found for found in self.error_history) >= need
        ][:config.MAX_FEEDBACK]

        similarity = round(float(np.mean(self.score_history)), 1)

        if not errors and similarity > config.PASS_SIMILARITY:
            self.passed = True
            status, message = "passed", "ผ่าน! ท่าถูกต้อง"
        elif errors:
            status, message = "fix", "ต้องแก้ไข"
        elif siamese["is_similar"]:
            status, message = "correct", "ท่าถูกต้อง ดีมาก!"
        else:
            status, message = "not_similar", "ท่ายังไม่ตรงกับต้นแบบ ลองทำใหม่อีกครั้ง ให้ครบจังหวะ"

        return {
            "status": status,
            "message": message,
            "similarity": similarity,
            "distance": siamese["distance"],
            "is_similar": siamese["is_similar"],
            "errors": feedback_items(errors),
        }


# =====================================================================
# โหมดทดสอบ
# =====================================================================
class TestSession:
    mode = "test"

    def __init__(self, scorer, num_attempts=config.NUM_ATTEMPTS):
        self.scorer = scorer
        self.num_attempts = num_attempts
        self.results = []
        self.sequences = []
        self.state = "idle"
        self.state_since = 0.0
        self.message = None
        self.saved_files = None
        self._reset_attempt()

    # -------------------------
    # คำสั่งจากเว็บ
    # -------------------------
    def handle_command(self, command, now):
        kind = command.get("type")

        if kind == "start" and self.state in ("idle", "result", "summary"):
            if self.state == "result":
                self._finish()   # บันทึกผลรอบที่แล้วลง results/ ก่อนเริ่มใหม่
            if self.state == "summary":
                self.results, self.sequences, self.saved_files = [], [], None
            self.num_attempts = int(command.get("num_attempts", self.num_attempts))
            self._go("countdown", now)

        elif kind == "next" and self.state == "result":
            if len(self.results) >= self.num_attempts:
                self._finish()
            else:
                self._go("countdown", now)

        elif kind == "save_correct" and self.state == "result":
            self._save_correct()

        elif kind == "stop":
            self._finish()

        return self._payload(now)

    # -------------------------
    # ทีละเฟรม
    # -------------------------
    def update(self, now, features, framing):
        if self.state == "countdown" and now - self.state_since >= config.COUNTDOWN_SECONDS:
            self._go("waiting", now)

        if self.state in ("waiting", "recording"):
            self._track(now, features, framing)

        return self._payload(now, framing)

    def _track(self, now, features, framing):
        self.message = None

        if features is None:
            # ตัวหลุดเฟรม → เริ่มรอยกมือใหม่
            self.buffer.clear()
            self.onset_time = None
            self.state = "waiting"
            self.message = framing_message(framing)
            return

        self.buffer.append((now, features))

        if self.state == "recording":
            self.framing_counts[0] += 1
            self.framing_counts[1] += framing["head"]
            self.framing_counts[2] += framing["feet"]

            if now - self.onset_time >= config.POST_ONSET_SECONDS:
                self._score(now)
            return

        # --- waiting: เก็บย้อนหลังแค่ CLIP_SECONDS แล้วหาจังหวะเริ่มยกมือ ---
        while self.buffer and now - self.buffer[0][0] > config.CLIP_SECONDS:
            self.buffer.popleft()

        recent = [f for t, f in self.buffer if now - t <= config.PRE_ONSET_SECONDS]

        # notebook (10 FPS) ใช้ 5 เฟรมแรก = 0.5 วินาทีแรกเป็นท่ายืนตรง — ที่นี่นับเป็นเวลาแทนจำนวนเฟรม
        # เพื่อให้ยังจับการยกมือได้ถ้าภาพมาไม่ครบ 10 FPS
        if len(recent) >= 4:
            heights = rules_lib.wrist_height(np.array(recent))
            base = float(np.median(heights[:max(2, len(recent) // 4)]))

            if base >= rules_lib.HAND_DOWN_Y and base - heights[-1] > rules_lib.ONSET_RISE:
                self.onset_time = now
                self.state = "recording"
                return

            if heights[-1] < rules_lib.HAND_DOWN_Y and base < rules_lib.HAND_DOWN_Y:
                self.message = "ลดมือลงข้างลำตัวก่อน แล้วค่อยยกมือ"

        if now - self.state_since >= config.WAIT_TIMEOUT:
            self._score(now)   # ไม่ยกมือภายในเวลา → ประเมินช่วงล่าสุด (จะได้ "ไม่ได้ทำท่า")

    def _score(self, now):
        if len(self.buffer) < config.MIN_SCORE_FRAMES:
            self.message = "เก็บเฟรมได้น้อยเกินไป - ทดสอบครั้งนี้ใหม่"
            self._go("countdown", now)
            return

        times, frames = zip(*self.buffer)
        sequence = resample_fixed(times, frames, times[-1])

        total = self.framing_counts[0]
        framing_ratio = {
            "head": round(self.framing_counts[1] / total, 2) if total else 1.0,
            "feet": round(self.framing_counts[2] / total, 2) if total else 1.0,
        }

        result = self.scorer.score_attempt(sequence, framing_ratio)
        result["attempt"] = len(self.results) + 1

        self.results.append(result)
        self.sequences.append(sequence)
        self.state = "result"
        self.state_since = now

    def _save_correct(self):
        """ครั้งที่ทำถูก (ไม่ผิดกฎ) → บันทึกเป็นท่าถูกใน dataset/correct (เหมือนปุ่ม C ใน notebook)"""
        result = self.results[-1]

        if result["errors"] or result.get("saved_as_correct"):
            return

        indexes = [int(d.name) for d in config.CORRECT_DIR.iterdir() if d.is_dir() and d.name.isdigit()]
        folder = config.CORRECT_DIR / str(max(indexes) + 1 if indexes else 0)
        folder.mkdir(parents=True)

        for frame_num, keypoints in enumerate(self.sequences[-1]):
            np.save(folder / f"{frame_num}.npy", keypoints)

        result["saved_as_correct"] = folder.name

    def _finish(self):
        self.state = "summary"

        if self.results and config.SAVE_RESULTS and self.saved_files is None:
            config.RESULTS_DIR.mkdir(exist_ok=True)
            stamp = f"web_{datetime.now():%Y%m%d_%H%M%S}"
            json_path = config.RESULTS_DIR / f"test_{stamp}.json"
            json_path.write_text(
                json.dumps({"summary": self._summary(), "attempts": self.results}, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            np.save(config.RESULTS_DIR / f"test_{stamp}_sequences.npy", np.stack(self.sequences))
            self.saved_files = json_path.name

    # -------------------------
    # Helpers
    # -------------------------
    def _reset_attempt(self):
        self.buffer = deque()
        self.onset_time = None
        self.framing_counts = [0, 0, 0]

    def _go(self, state, now):
        self.state = state
        self.state_since = now
        self._reset_attempt()

        if state != "countdown":
            self.message = None

    def _summary(self):
        if not self.results:
            return None

        accuracies = [r["accuracy"] for r in self.results]
        counts = {}

        for r in self.results:
            for e in r["errors"]:
                counts.setdefault(e["code"], {**e, "count": 0})["count"] += 1

        return {
            "overall_accuracy": round(float(np.mean(accuracies)), 1),
            "best": max(accuracies),
            "worst": min(accuracies),
            "passed": sum(r["passed"] for r in self.results),
            "attempts": len(self.results),
            "common_errors": sorted(counts.values(), key=lambda e: -e["count"]),
        }

    def _payload(self, now, framing=None):
        payload = {
            "state": self.state,
            "attempt": min(len(self.results) + (self.state not in ("result", "summary")), self.num_attempts),
            "num_attempts": self.num_attempts,
            "message": self.message,
        }

        if framing is not None and self.state in ("idle", "countdown"):
            payload["message"] = self.message or framing_message(framing)
            payload["ready"] = framing_message(framing) is None

        if self.state == "countdown":
            payload["countdown"] = max(1, config.COUNTDOWN_SECONDS - int(now - self.state_since))
        elif self.state == "waiting":
            payload["wait_remaining"] = round(max(0.0, config.WAIT_TIMEOUT - (now - self.state_since)), 1)
        elif self.state == "recording":
            payload["elapsed"] = round(min(now - self.onset_time, config.POST_ONSET_SECONDS), 1)
            payload["duration"] = config.POST_ONSET_SECONDS
        elif self.state == "result":
            payload["result"] = self.results[-1]
            payload["can_save_correct"] = not self.results[-1]["errors"] and not self.results[-1].get("saved_as_correct")
        elif self.state == "summary":
            payload["summary"] = self._summary()
            payload["results"] = self.results
            payload["saved_file"] = self.saved_files

        return payload
