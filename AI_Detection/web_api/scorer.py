"""
โหลดโมเดล + ให้คะแนน (ใช้ร่วมกันทุก session)

- Siamese (encoder.keras): ท่าโดยรวมคล้ายท่าต้นแบบแค่ไหน
- salute_rules.py: ผิดตรงไหน (feedback 10 ข้อ)
ตรรกะเหมือน siamese_learn.ipynb cell 5 (โหมดฝึก) และ siamese_test_mode.ipynb (โหมดทดสอบ)
"""
import threading

import numpy as np
import tensorflow as tf

import config
import salute_rules as rules_lib


def resample_fixed(times, frames, end_time, seconds=config.CLIP_SECONDS, length=config.SEQUENCE_LENGTH):
    """เลือกเฟรมทุก 0.1 วิ ย้อนหลัง `seconds` จาก end_time (เวลาจริง ไม่ยืด/หด)"""
    times = np.asarray(times, dtype=np.float64)
    targets = np.linspace(end_time - seconds, end_time, length)
    indexes = np.abs(times[None, :] - targets[:, None]).argmin(axis=1)
    return np.stack([frames[i] for i in indexes]).astype(np.float32)


def feedback_items(codes):
    return [
        {"code": code, "name": rules_lib.FEEDBACK_TH[code][0], "tip": rules_lib.FEEDBACK_TH[code][1]}
        for code in codes
    ]


class SaluteScorer:
    def __init__(self):
        for path in [config.ENCODER_PATH, config.THRESHOLD_PATH, config.RULES_PATH]:
            if not path.exists():
                raise FileNotFoundError(
                    f"ไม่พบ {path} - รัน cell 2 → 3 → 4 → 4.5 ใน siamese_learn.ipynb ก่อน"
                )

        self.threshold = float(config.THRESHOLD_PATH.read_text().strip())
        self.rules = rules_lib.load_rules(config.RULES_PATH)
        self.encoder = tf.keras.models.load_model(config.ENCODER_PATH, compile=False)
        self._lock = threading.Lock()   # TensorFlow predict ทีละ request

        expected = (rules_lib.ALIGN_LENGTH, rules_lib.SIAMESE_FEATURES)
        actual = tuple(self.encoder.input_shape[1:])

        if actual != expected:
            raise ValueError(
                f"encoder รับ input {actual} แต่ salute_rules ให้ {expected} - เทรนใหม่ (cell 2 → 3 → 4)"
            )

        self.reload_references()

    def reload_references(self):
        """ท่าต้นแบบ = dataset/correct (ตัดตามจุดเริ่มยกมือ) → embedding เก็บไว้"""
        references = []

        for folder in sorted(
            (d for d in config.CORRECT_DIR.iterdir() if d.is_dir() and d.name.isdigit()),
            key=lambda d: int(d.name)
        ):
            try:
                clip = rules_lib.load_clip(folder, config.SEQUENCE_LENGTH)
            except (FileNotFoundError, ValueError):
                continue

            aligned = rules_lib.siamese_input(clip, fallback_to_start=False)

            if aligned is not None:
                references.append(aligned)

        if not references:
            raise RuntimeError("ไม่พบท่าต้นแบบใน dataset/correct")

        self.reference_count = len(references)
        self.reference_embeddings = self._embed(np.stack(references))

    def _embed(self, batch):
        with self._lock:
            return self.encoder(batch, training=False).numpy()

    # -------------------------
    # Siamese
    # -------------------------
    def similarity(self, sequence):
        """คลิป (60, 218) → ระยะห่าง / % ความคล้าย / คล้ายต้นแบบไหม"""
        embedding = self._embed(rules_lib.siamese_input(sequence)[np.newaxis, ...])
        distances = np.linalg.norm(self.reference_embeddings - embedding, axis=1)

        # ระยะเฉลี่ยกับท่าต้นแบบที่ใกล้ที่สุด 3 คลิป
        distance = float(np.mean(np.sort(distances)[:3]))
        similarity = 100.0 * float(np.clip(1.0 - distance / (2.0 * self.threshold), 0.0, 1.0))

        return {
            "distance": round(distance, 4),
            "similarity": round(similarity, 1),
            "is_similar": distance <= self.threshold,
        }

    def errors(self, sequence):
        return rules_lib.detect_errors(sequence, self.rules)

    # -------------------------
    # โหมดทดสอบ: คะแนนรวม (ผิด 1 อย่าง หัก 10%)
    # -------------------------
    def score_attempt(self, sequence, framing_ratio=None):
        siamese = self.similarity(sequence)
        errors = self.errors(sequence)
        total_rules = len(rules_lib.PRIORITY)

        deductions = []

        if errors and errors[0] in ("no_salute", "wrong_hand"):
            # ไม่ได้ทำท่า / ใช้มือผิดข้าง = ผิดทั้งท่า
            rules_passed = 0
            deductions.append({"reason": rules_lib.FEEDBACK_TH[errors[0]][0], "amount": 100})
        else:
            rules_passed = total_rules - len(errors)

            for code in errors:
                deductions.append({"reason": rules_lib.FEEDBACK_TH[code][0], "amount": config.PENALTY_PER_ERROR})

        framing_ratio = framing_ratio or {"head": 1.0, "feet": 1.0}
        body_visible = (
            framing_ratio["head"] >= config.MIN_IN_FRAME
            and framing_ratio["feet"] >= config.MIN_IN_FRAME
        )

        # มองไม่เห็นทั้งตัว (หัว/เท้าหลุดเฟรม) → ประเมินไม่ได้ = 0 คะแนน
        if not body_visible:
            deductions = [{"reason": "มองไม่เห็นทั้งตัว (หัวหรือเท้าหลุดเฟรม)", "amount": 100}]

        # ความแม่นยำ = ความคล้ายท่าต้นแบบ (Siamese) − 10% ต่อเกณฑ์ที่ไม่ผ่าน
        # (ไม่ผ่านทั้ง 10 เกณฑ์ / ไม่ทำท่า / ใช้มือผิดข้าง / ไม่เห็นทั้งตัว = −100% → 0%)
        penalty = min(100, sum(d["amount"] for d in deductions))

        return {
            **siamese,
            "accuracy": round(max(0.0, siamese["similarity"] - penalty), 1),
            "passed": bool(siamese["is_similar"] and not errors and body_visible),
            "rules_passed": rules_passed,
            "total_rules": total_rules,
            "penalty": penalty,
            "deductions": deductions,
            "errors": feedback_items(errors),
            "framing": framing_ratio,
            "body_visible": body_visible,
        }
