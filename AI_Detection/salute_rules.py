"""
Feedback rules for SaluteAI.

Siamese บอกแค่ว่า "ท่าคล้ายท่าถูกแค่ไหน" ไฟล์นี้คือ logic ที่บอกว่า "ผิดตรงไหน"
โดยวัดค่าจากจุด MediaPipe (vector 218 ค่า/เฟรม เหมือนตอนอัด) แล้วเทียบกับเกณฑ์
ที่ได้จากการ calibrate กับ dataset (ท่าถูก + ท่าผิดที่ติด label)
"""
import json
from pathlib import Path

import numpy as np

# -------------------------
# Layout ของ vector 218 ค่า (ต้องตรงกับ extract_landmarks ใน notebook)
# -------------------------
POSE_INDEXES = list(range(0, 11)) + [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
HAND_POINTS = 21
HAND_START = len(POSE_INDEXES) * 4          # 92
FEATURES = HAND_START + 2 * HAND_POINTS * 3  # 218

NOSE, LEFT_EYE, RIGHT_EYE, LEFT_EAR, RIGHT_EAR = 0, 2, 5, 7, 8
L_ANKLE, R_ANKLE = 27, 28

# ข้อมือยกสูงกว่าแนวไหล่เกินค่านี้ (หน่วย = ความกว้างไหล่) ถือว่า "กำลังทำท่า"
RAISED_Y = -0.2

# ข้อความภาษาไทย: code → (ชื่อความผิด, คำแนะนำให้แก้)
FEEDBACK_TH = {
    "no_salute": ("ไม่ได้ทำท่าทาง", "กรุณายกมือขวาขึ้นทำวันทยหัตถ์ ปฏิบัติ"),
    "wrong_hand": ("ใช้มือผิดข้าง", "กรุณาใช้มือขวาทำวันทยหัตถ์ ปฏิบัติ"),
    "hand_low": ("ปลายนิ้วต่ำกว่าคิ้ว", "กรุณายกมือขึ้นให้ปลายนิ้วอยู่ระดับคิ้ว ปฏิบัติ"),
    "hand_high": ("ปลายนิ้วสูงกว่าคิ้ว", "กรุณาลดมือลงให้ปลายนิ้วอยู่ระดับคิ้ว ปฏิบัติ"),
    "elbow_at_shoulder": ("ศอกไม่กาง", "กางศอกประมาณสี่สิบห้าองศา ปฏิบัติ"),
    "body_tilted": ("ตัวเอียง", "ยืนตัวตรง ให้ไหล่ทั้งสองข้างเสมอกัน ปฏิบัติ"),
    "heels_apart": ("ขาไม่ชิดปลายเท้าไม่แยก", "ยืนตัวตรงขาชิด และปลายเท้าแยกประมาณสี่สิบห้าองศา ปฏิบัติ"),
    "no_head_turn": ("ไม่สะบัดหน้า", "ยกอกอึ้บ แล้วสะบัดหน้าไปทางซ้าย ปฏิบัติ"),
    "wrong_head_turn": ("สะบัดหน้าผิดข้าง", "สะบัดหน้าไปทางซ้าย ไม่ใช่ทางขวา ปฏิบัติ"),
    "left_arm_not_at_side": ("มือซ้ายไม่แนบลำตัว", "แนบมือซ้ายไว้ข้างลำตัวด้วย ปฏิบัติ"),
}

# กฎที่ปรับเกณฑ์จาก dataset: code → (ชื่อค่าที่วัด, ทิศ) "gt" = ผิดเมื่อค่ามากกว่าเกณฑ์
CALIBRATED_RULES = {
    "hand_low": ("wrist_to_eye", "gt"),
    "hand_high": ("tip_to_eye", "lt"),
    "elbow_at_shoulder": ("elbow_to_shoulder", "lt"),
    "body_tilted": ("tilt", "gt"),
    "heels_apart": ("ankle_gap", "gt"),
    "left_arm_not_at_side": ("other_arm_angle", "gt"),
    "no_head_turn": ("turn_left", "lt"),
    "wrong_head_turn": ("turn_right", "gt"),
}

# ลำดับการแสดงผล (สำคัญสุดก่อน)
PRIORITY = [
    "no_salute", "wrong_hand", "hand_low", "hand_high", "elbow_at_shoulder",
    "left_arm_not_at_side", "body_tilted", "heels_apart",
    "wrong_head_turn", "no_head_turn",
]


# -------------------------
# Helpers
# -------------------------
def pose(seq, index):
    k = POSE_INDEXES.index(index)
    return seq[:, 4 * k:4 * k + 4]          # (frames, [x, y, z, visibility])


def hand(seq, block):
    start = HAND_START + block * HAND_POINTS * 3
    return seq[:, start:start + HAND_POINTS * 3].reshape(-1, HAND_POINTS, 3)


def load_clip(folder, length=60):
    folder = Path(folder)
    return np.stack([np.load(folder / f"{i}.npy") for i in range(length)]).astype(np.float32)


# -------------------------
# Time alignment: เริ่มนับตอนเริ่มยกมือ (แต่ละคลิปยกมือไม่พร้อมกัน)
# -------------------------
ONSET_RISE = 0.4          # ข้อมือสูงขึ้นจากตอนยืนตรงเกินค่านี้ = เริ่มยกมือ (หน่วย = ความกว้างไหล่)
HAND_DOWN_Y = 0.5         # ข้อมือต่ำกว่าแนวไหล่เกินค่านี้ = มือแนบลำตัว
ALIGN_PRE_FRAMES = 3      # เก็บก่อนเริ่มยกมือ 0.3 วินาที
ALIGN_LENGTH = 40         # ความยาวที่ Siamese ใช้ = 4 วินาที นับจากเริ่มยกมือ (10 FPS)


def wrist_height(seq):
    """ตำแหน่ง y ของข้อมือข้างที่สูงกว่า (ค่าน้อย = สูง) ใช้ได้ทั้งมือขวาและมือผิดข้าง"""
    return np.minimum(pose(seq, 15)[:, 1], pose(seq, 16)[:, 1])


def find_onset(seq):
    """เฟรมแรกที่เริ่มยกมือ หรือ None ถ้าไม่ได้ยก / มือยกค้างตั้งแต่ต้นคลิป"""
    ys = wrist_height(seq)
    base = np.median(ys[:5])

    if base < HAND_DOWN_Y:
        return None

    rising = np.where(base - ys > ONSET_RISE)[0]
    return int(rising[0]) if len(rising) else None


def align_sequence(seq, fallback_to_start=True):
    """
    ตัดคลิปให้เริ่มก่อนยกมือ 0.3 วินาที ยาว ALIGN_LENGTH เฟรม
    หาจุดเริ่มยกมือไม่เจอ: fallback_to_start=True ใช้ต้นคลิปแทน, False คืน None
    """
    onset = find_onset(seq)

    if onset is None:
        if not fallback_to_start:
            return None
        start = 0
    else:
        start = max(0, onset - ALIGN_PRE_FRAMES)

    window = seq[start:start + ALIGN_LENGTH]

    if len(window) < ALIGN_LENGTH:
        pad = np.repeat(window[-1:], ALIGN_LENGTH - len(window), axis=0)
        window = np.concatenate([window, pad])

    return window.astype(np.float32)


# Siamese ใช้:
#   - pose x, y, visibility (ไม่ใช้ z = ความลึก: MediaPipe เดาจากภาพ 2D ไม่นิ่ง เปลี่ยนตามระยะ/มุมกล้อง)
#   - จุดมือเฉพาะ "มือที่ทำความเคารพ" x, y
# ไม่ใช้จุดมืออีกข้าง: ใน dataset ท่าถูกไม่เคยจับมือข้างนี้ได้เลย แต่ท่าผิดจับได้บ่อย
# Siamese เลยเรียนทางลัดผิด ๆ ว่า "เห็นมืออีกข้าง = ผิด" (ตำแหน่งแขนข้างนั้นยังมีจาก pose)
SALUTE_HAND_BLOCK = 0     # ภาพถูก flip → มือขวาที่ทำความเคารพ ถูกเก็บใน left_hand_landmarks (block 0)
_hand_start = HAND_START + SALUTE_HAND_BLOCK * HAND_POINTS * 3

SIAMESE_COLUMNS = [c for c in range(HAND_START) if c % 4 != 2] + [
    c for c in range(_hand_start, _hand_start + HAND_POINTS * 3)
    if (c - _hand_start) % 3 != 2
]
SIAMESE_FEATURES = len(SIAMESE_COLUMNS)    # 69 + 42 = 111


def siamese_input(seq, fallback_to_start=True):
    """คลิป (60, 218) → input ของ Siamese (ALIGN_LENGTH, SIAMESE_FEATURES) หรือ None"""
    aligned = align_sequence(seq, fallback_to_start)
    return None if aligned is None else aligned[:, SIAMESE_COLUMNS]


def detect_side(correct_seqs):
    """หาว่ามือที่ทำความเคารพคือ pose ข้างไหน (ภาพถูก flip จึงต้องดูจากข้อมูลจริง)"""
    top_15 = np.mean([pose(s, 15)[:, 1].min() for s in correct_seqs])
    top_16 = np.mean([pose(s, 16)[:, 1].min() for s in correct_seqs])

    if top_15 < top_16:
        side = {"wrist": 15, "elbow": 13, "shoulder": 11,
                "other_wrist": 16, "other_shoulder": 12}
    else:
        side = {"wrist": 16, "elbow": 14, "shoulder": 12,
                "other_wrist": 15, "other_shoulder": 11}

    # hand block (0 = left_hand_landmarks, 1 = right_hand_landmarks) ที่เจอมือที่ยกบ่อยกว่า
    rates = []
    for block in (0, 1):
        rates.append(np.mean([
            np.any(hand(s, block)[pose(s, side["wrist"])[:, 1] < RAISED_Y], axis=(1, 2)).mean()
            if np.any(pose(s, side["wrist"])[:, 1] < RAISED_Y) else 0.0
            for s in correct_seqs
        ]))
    side["hand_block"] = int(np.argmax(rates))

    # ระยะเฉลี่ยจากข้อมือถึงปลายนิ้ว (ใช้แทนเมื่อจับมือไม่ได้)
    offsets = []
    for s in correct_seqs:
        h = s[pose(s, side["wrist"])[:, 1] < RAISED_Y]
        fingers = hand(h, side["hand_block"])
        has_hand = np.any(fingers, axis=(1, 2))

        if has_hand.sum() >= 2:
            tips = fingers[has_hand][:, [8, 12], 1].min(axis=1)
            offsets.append(np.median(pose(h, side["wrist"])[has_hand, 1] - tips))

    side["tip_offset"] = float(np.median(offsets)) if offsets else 0.45

    return side


# -------------------------
# Measurements (1 คลิป → ค่าวัดหลายตัว)
# -------------------------
def clip_metrics(seq, side):
    wrist_y = pose(seq, side["wrist"])[:, 1]
    other_y = pose(seq, side["other_wrist"])[:, 1]

    raised = wrist_y < RAISED_Y
    other_raised = other_y < RAISED_Y

    m = {
        "raised": float(raised.mean()),
        "other_raised": float(other_raised.mean()),
    }

    # วัดเฉพาะช่วงที่ยกมือค้าง (ถ้าไม่ได้ยก ใช้ทั้งคลิป)
    hold = raised if raised.sum() >= 3 else np.ones(len(seq), dtype=bool)
    h = seq[hold]

    eye_y = (pose(h, LEFT_EYE)[:, 1] + pose(h, RIGHT_EYE)[:, 1]) / 2
    wrist_to_eye = pose(h, side["wrist"])[:, 1] - eye_y
    m["wrist_to_eye"] = float(np.median(wrist_to_eye))

    # ปลายนิ้ว (นิ้วชี้/นิ้วกลาง) เทียบระดับตา ถ้าจับมือไม่ได้ ใช้ข้อมือ - ระยะข้อมือถึงปลายนิ้ว
    fingers = hand(h, side["hand_block"])
    has_hand = np.any(fingers, axis=(1, 2))

    if has_hand.sum() >= 2:
        tips = fingers[has_hand][:, [8, 12], 1].min(axis=1)
        m["tip_to_eye"] = float(np.median(tips - eye_y[has_hand]))
    else:
        m["tip_to_eye"] = m["wrist_to_eye"] - side.get("tip_offset", 0.45)

    m["elbow_to_shoulder"] = float(np.median(
        pose(h, side["elbow"])[:, 1] - pose(h, side["shoulder"])[:, 1]
    ))

    # ตัวเอียง = ไหล่สูงต่ำไม่เท่ากัน + ศีรษะเยื้องออกจากแนวกึ่งกลางสะโพก
    shoulder_tilt = np.abs(pose(h, 11)[:, 1] - pose(h, 12)[:, 1])
    hip_center_x = (pose(h, 23)[:, 0] + pose(h, 24)[:, 0]) / 2
    head_offset = np.abs(pose(h, NOSE)[:, 0] - hip_center_x)
    m["tilt"] = float(np.median(shoulder_tilt + head_offset))

    m["ankle_gap"] = float(np.median(
        np.abs(pose(h, L_ANKLE)[:, 0] - pose(h, R_ANKLE)[:, 0])
    ))

    arm = pose(h, side["other_wrist"])[:, :2] - pose(h, side["other_shoulder"])[:, :2]
    m["other_arm_angle"] = float(np.median(
        np.degrees(np.arctan2(np.abs(arm[:, 0]), arm[:, 1]))
    ))

    # การหันหน้า: ตำแหน่งจมูกเทียบกึ่งกลางหู (สะบัดหน้าเป็นช่วงสั้น ๆ จึงดูค่าสุดขีด)
    ear_mid = (pose(seq, LEFT_EAR)[:, 0] + pose(seq, RIGHT_EAR)[:, 0]) / 2
    ear_gap = np.maximum(np.abs(pose(seq, LEFT_EAR)[:, 0] - pose(seq, RIGHT_EAR)[:, 0]), 1e-3)
    yaw = (pose(seq, NOSE)[:, 0] - ear_mid) / ear_gap
    yaw = yaw - np.median(yaw)
    turn_sign = side.get("turn_sign", -1.0)       # ทิศสะบัดหน้าที่ถูก (หาจากท่าถูก)
    m["turn_left"] = float(np.max(yaw * turn_sign))
    m["turn_right"] = float(np.max(-yaw * turn_sign))

    return m


# -------------------------
# Calibration
# -------------------------
def best_threshold(good, bad, direction):
    """หาเกณฑ์ที่แยก ท่าถูก (good) กับ ท่าผิด (bad) ได้ดีที่สุด แล้วเลือกกึ่งกลางช่วง"""
    good, bad = np.asarray(good), np.asarray(bad)
    values = np.unique(np.concatenate([good, bad]))
    candidates = (values[:-1] + values[1:]) / 2 if len(values) > 1 else values

    scores = []
    for t in candidates:
        if direction == "gt":
            tpr, fpr = (bad > t).mean(), (good > t).mean()
        else:
            tpr, fpr = (bad < t).mean(), (good < t).mean()
        scores.append(tpr - fpr)

    scores = np.array(scores)
    best = candidates[np.isclose(scores, scores.max())]

    return float((best.min() + best.max()) / 2)


def range_threshold(good, direction, margin=0.5):
    """ไม่มีตัวอย่างท่าผิด: ใช้ช่วงของท่าถูก + เผื่อขอบ"""
    good = np.asarray(good)
    lo, hi = np.percentile(good, [5, 95])
    spread = max(hi - lo, 1e-3)
    return float(hi + margin * spread if direction == "gt" else lo - margin * spread)


def calibrate(correct_seqs, labeled_seqs):
    """
    correct_seqs : list ของคลิปท่าถูก (60, 218)
    labeled_seqs : list ของ (คลิปท่าผิด, [error codes])
    """
    side = detect_side(correct_seqs)

    # ทิศสะบัดหน้าที่ถูก: ค่า yaw สุดขีดของท่าถูกเป็นลบหรือบวก
    signs = []
    for s in correct_seqs:
        ear_mid = (pose(s, LEFT_EAR)[:, 0] + pose(s, RIGHT_EAR)[:, 0]) / 2
        ear_gap = np.maximum(np.abs(pose(s, LEFT_EAR)[:, 0] - pose(s, RIGHT_EAR)[:, 0]), 1e-3)
        yaw = (pose(s, NOSE)[:, 0] - ear_mid) / ear_gap
        yaw = yaw - np.median(yaw)
        signs.append(yaw[np.argmax(np.abs(yaw))])
    side["turn_sign"] = float(np.sign(np.median(signs)) or -1.0)

    good = [clip_metrics(s, side) for s in correct_seqs]
    labeled = [(clip_metrics(s, side), errors) for s, errors in labeled_seqs]

    thresholds = {}
    for code, (metric, direction) in CALIBRATED_RULES.items():
        good_values = [m[metric] for m in good]
        bad_values = [m[metric] for m, errors in labeled if code in errors]

        if bad_values:
            t = best_threshold(good_values, bad_values, direction)
            source = f"{len(bad_values)} labeled clips"
        else:
            t = range_threshold(good_values, direction)
            source = "correct range only"

        thresholds[code] = {
            "metric": metric,
            "direction": direction,
            "threshold": round(t, 4),
            "source": source,
        }

    return {"side": side, "thresholds": thresholds}


def save_rules(rules, path):
    Path(path).write_text(json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8")


def load_rules(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


# -------------------------
# Detection
# -------------------------
def detect_errors(seq, rules, metrics=None):
    """คืน list ของ error code ที่เจอในคลิป เรียงตามความสำคัญ"""
    m = metrics or clip_metrics(seq, rules["side"])

    # ไม่ได้ทำท่า / ใช้มือผิดข้าง: ตัดสินก่อน แล้วไม่ต้องดูข้ออื่น
    if m["other_raised"] > 0.2 and m["other_raised"] > m["raised"]:
        return ["wrong_hand"]

    if m["raised"] < 0.15:
        return ["no_salute"]

    found = set()
    for code, rule in rules["thresholds"].items():
        value = m[rule["metric"]]
        t = rule["threshold"]

        if (rule["direction"] == "gt" and value > t) or (rule["direction"] == "lt" and value < t):
            found.add(code)

    # ยกศอกสูงทำให้ไหล่เอียงตามไปด้วย ไม่นับเป็นตัวเอียง
    if "elbow_at_shoulder" in found:
        found.discard("body_tilted")

    # สะบัดหน้าผิดข้าง ย่อมไม่ได้สะบัดไปทางที่ถูก ไม่ต้องเตือนซ้ำ
    if "wrong_head_turn" in found:
        found.discard("no_head_turn")

    return [code for code in PRIORITY if code in found]


def evaluate(correct_seqs, labeled_seqs, rules):
    """ตรวจว่ากฎจับได้ตรงกับ label แค่ไหน → dict ของผลรายกฎ"""
    report = {}
    correct_found = [detect_errors(s, rules) for s in correct_seqs]
    labeled_found = [(detect_errors(s, rules), errors) for s, errors in labeled_seqs]

    for code in PRIORITY:
        clips = [found for found, errors in labeled_found if code in errors]
        hits = sum(code in found for found in clips)
        false_alarms = sum(code in found for found in correct_found)
        false_alarms += sum(
            code in found for found, errors in labeled_found if code not in errors
        )
        report[code] = {
            "labeled": len(clips),
            "detected": hits,
            "false_alarms": false_alarms,
        }

    report["_correct_clean"] = sum(not found for found in correct_found)
    report["_correct_total"] = len(correct_seqs)

    return report
