"""
ภาพจากเว็บ → MediaPipe Holistic → vector 218 ค่า/เฟรม

ต้องเหมือนตอนอัด dataset ใน siamese_learn.ipynb ทุกอย่าง (Holistic, model_complexity=1,
flip ภาพแนวนอน, normalize เทียบกึ่งกลางไหล่) ไม่งั้นค่าที่ได้จะต่างจาก dataset และโมเดลจะเพี้ยน
"""
import cv2
import mediapipe as mp
import numpy as np

from config import MAX_FRAME_WIDTH

mp_holistic = mp.solutions.holistic

# Pose joints ที่ใช้ (index ของ MediaPipe Pose) — เหมือน cell 1 ใน notebook
POSE_JOINTS = {
    "face": list(range(0, 11)),   # จมูก ตา หู ปาก (11 จุด)
    "shoulders": [11, 12],
    "elbows": [13, 14],
    "wrists": [15, 16],
    "hips": [23, 24],             # สะโพก (ต้นขา)
    "knees": [25, 26],            # เข่า
    "ankles": [27, 28],           # ข้อเท้า
}
POSE_INDEXES = [i for group in POSE_JOINTS.values() for i in group]

HAND_POINTS = 21

# 23 pose x (x, y, z, visibility) + 2 มือ x 21 x (x, y, z) = 92 + 126 = 218
FEATURES = len(POSE_INDEXES) * 4 + 2 * HAND_POINTS * 3


def create_holistic():
    """1 session (1 ผู้ใช้) ใช้ 1 ตัว — Holistic จำการ tracking ระหว่างเฟรม จึงห้ามแชร์ข้าม session"""
    return mp_holistic.Holistic(
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )


def decode_frame(data):
    """bytes (JPEG/PNG จากเบราว์เซอร์) → ภาพ BGR ที่ flip แล้ว (เหมือน cv2.flip ตอนอัด)"""
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)

    if image is None:
        return None

    height, width = image.shape[:2]

    if width > MAX_FRAME_WIDTH:
        scale = MAX_FRAME_WIDTH / width
        image = cv2.resize(image, (MAX_FRAME_WIDTH, int(height * scale)))

    return cv2.flip(image, 1)


def process_frame(holistic, image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    rgb.flags.writeable = False
    return holistic.process(rgb)


def extract_landmarks(results):
    """เหมือน extract_landmarks ใน notebook ทุกบรรทัด"""
    if results.pose_landmarks is None:
        return None

    landmarks = results.pose_landmarks.landmark

    left_shoulder = landmarks[11]
    right_shoulder = landmarks[12]

    center_x = (left_shoulder.x + right_shoulder.x) / 2
    center_y = (left_shoulder.y + right_shoulder.y) / 2

    scale = np.sqrt(
        (left_shoulder.x - right_shoulder.x) ** 2
        + (left_shoulder.y - right_shoulder.y) ** 2
    )
    scale = max(scale, 1e-6)

    values = []

    for index in POSE_INDEXES:
        landmark = landmarks[index]
        values.extend([
            (landmark.x - center_x) / scale,
            (landmark.y - center_y) / scale,
            landmark.z / scale,
            landmark.visibility,
        ])

    # ถ้าตรวจไม่เจอมือข้างไหน ใส่ 0 แทน
    for hand in [results.left_hand_landmarks, results.right_hand_landmarks]:
        if hand is None:
            values.extend([0.0] * HAND_POINTS * 3)
            continue

        for landmark in hand.landmark:
            values.extend([
                (landmark.x - center_x) / scale,
                (landmark.y - center_y) / scale,
                landmark.z / scale,
            ])

    return np.array(values, dtype=np.float32)


def framing(results):
    """หัว (จมูก) และเท้า (ข้อเท้า) อยู่ในภาพจริงไหม — ดูจากพิกัด ไม่ใช่ visibility"""
    if results.pose_landmarks is None:
        return {"body": False, "head": False, "feet": False}

    lm = results.pose_landmarks.landmark
    inside = lambda p: 0.0 <= p.x <= 1.0 and 0.0 <= p.y <= 1.0

    return {
        "body": True,
        "head": inside(lm[0]),
        "feet": inside(lm[27]) and inside(lm[28]),
    }


def landmarks_payload(results):
    """
    จุดสำหรับวาดโครงกระดูกบนเว็บ (พิกัด 0–1 ของภาพที่ flip แล้ว)
    → ฝั่งเว็บต้องแสดงวิดีโอแบบกระจก (CSS transform: scaleX(-1)) แล้ววาดจุดตามพิกัดนี้ตรง ๆ
    """
    def points(landmark_list, with_visibility=False):
        if landmark_list is None:
            return None
        if with_visibility:
            return [[round(p.x, 4), round(p.y, 4), round(p.visibility, 3)] for p in landmark_list.landmark]
        return [[round(p.x, 4), round(p.y, 4)] for p in landmark_list.landmark]

    return {
        "pose": points(results.pose_landmarks, with_visibility=True),
        "left_hand": points(results.left_hand_landmarks),
        "right_hand": points(results.right_hand_landmarks),
    }


# เส้นเชื่อมจุด (ให้เว็บใช้วาด) — ส่งไปครั้งเดียวตอนเชื่อมต่อ
POSE_CONNECTIONS = sorted([list(c) for c in mp_holistic.POSE_CONNECTIONS])
HAND_CONNECTIONS = sorted([list(c) for c in mp_holistic.HAND_CONNECTIONS])
