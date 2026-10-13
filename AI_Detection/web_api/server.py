"""
SaluteAI Web API (FastAPI)

รัน:  py -3.10 web_api/run_server.py      (จากโฟลเดอร์ AI_Detection)

Endpoints
- GET  /api/health          เช็กว่าเซิร์ฟเวอร์และโมเดลพร้อม
- GET  /api/info            ค่าตั้งต้น + รายการ feedback + เส้นเชื่อมจุดสำหรับวาดโครงกระดูก
- WS   /ws/training         โหมดฝึก (realtime feedback)
- WS   /ws/test             โหมดทดสอบ (นับถอยหลัง → จับเวลา → คะแนน)

รูปแบบข้อความ WebSocket ดู README.md
"""
import asyncio
import json
import struct
import time

import config  # noqa: F401  (ตั้ง sys.path ให้ import salute_rules ได้)
import salute_rules as rules_lib
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from features import (
    HAND_CONNECTIONS,
    POSE_CONNECTIONS,
    create_holistic,
    decode_frame,
    extract_landmarks,
    framing,
    landmarks_payload,
    process_frame,
)
from scorer import SaluteScorer
from sessions import TestSession, TrainingSession

app = FastAPI(title="SaluteAI Web API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_origin_regex=config.ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

scorer = SaluteScorer()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "references": scorer.reference_count,
        "threshold": scorer.threshold,
    }


@app.get("/api/info")
def info():
    return {
        "feedback": {code: {"name": name, "tip": tip} for code, (name, tip) in rules_lib.FEEDBACK_TH.items()},
        "config": {
            "clip_seconds": config.CLIP_SECONDS,
            "countdown_seconds": config.COUNTDOWN_SECONDS,
            "post_onset_seconds": config.POST_ONSET_SECONDS,
            "wait_timeout": config.WAIT_TIMEOUT,
            "num_attempts": config.NUM_ATTEMPTS,
            "penalty_per_error": config.PENALTY_PER_ERROR,
            "recommended_fps": 10,
        },
        "connections": {"pose": POSE_CONNECTIONS, "hand": HAND_CONNECTIONS},
    }


class FrameClock:
    """
    เวลาของแต่ละภาพ = เวลาที่ "ถ่าย" บนเครื่องผู้ใช้ (ไม่ใช่เวลาที่มาถึงเซิร์ฟเวอร์)
    → เน็ตช้า/กระตุก ภาพมาไม่สม่ำเสมอ ก็ยังเว้นระยะ 0.1 วิ ตรงกับตอนอัด dataset

    เว็บส่ง: [เวลาถ่าย 8 byte (float64, วินาที)] + JPEG — ถ้าไม่มี header (เว็บรุ่นเก่า) ใช้เวลาที่มาถึงแทน
    แปลงเป็นนาฬิกาเซิร์ฟเวอร์ด้วย offset ที่น้อยที่สุด (= เวลาเดินทางของภาพที่มาเร็วสุด)
    """

    def __init__(self):
        self.offset = None
        self.last = 0.0

    def split(self, data, arrived):
        if len(data) > 10 and data[8:10] == b"\xff\xd8":   # JPEG เริ่มด้วย FF D8
            captured = struct.unpack("<d", data[:8])[0]
            offset = arrived - captured
            self.offset = offset if self.offset is None else min(self.offset, offset)
            stamp = captured + self.offset
            data = data[8:]
        else:
            stamp = arrived

        self.last = max(stamp, self.last)   # ห้ามย้อนเวลา
        return data, self.last


def _process(holistic, session, data, stamp):
    """งานหนัก (MediaPipe + TensorFlow) — รันใน thread แยก ไม่ให้ server ค้าง"""
    image = decode_frame(data)

    if image is None:
        return {"type": "error", "message": "อ่านภาพไม่ได้ (ต้องเป็น JPEG/PNG)"}

    results = process_frame(holistic, image)
    session.aspect = image.shape[1] / image.shape[0]   # ใช้แก้มุมศอกให้ตรงกับภาพจริง
    frame_framing = framing(results)
    payload = session.update(stamp, extract_landmarks(results), frame_framing)

    return {
        "type": "frame",
        "mode": session.mode,
        "framing": frame_framing,
        "landmarks": landmarks_payload(results),
        **payload,
    }


async def _run_session(websocket: WebSocket, session):
    await websocket.accept()
    holistic = create_holistic()
    clock = FrameClock()

    try:
        await websocket.send_json({"type": "hello", "mode": session.mode})

        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            if message.get("bytes") is not None:
                # 1 ภาพ (JPEG) ต่อ 1 ข้อความ → ตอบผล 1 ข้อความ
                data, stamp = clock.split(message["bytes"], time.time())
                reply = await asyncio.to_thread(_process, holistic, session, data, stamp)
                await websocket.send_json(reply)

            elif message.get("text") is not None:
                try:
                    command = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "คำสั่งต้องเป็น JSON"})
                    continue

                payload = session.handle_command(command, time.time())
                await websocket.send_json({"type": "state", "mode": session.mode, **payload})

    except WebSocketDisconnect:
        pass
    finally:
        holistic.close()


@app.websocket("/ws/training")
async def training_socket(websocket: WebSocket):
    await _run_session(websocket, TrainingSession(scorer))


@app.websocket("/ws/test")
async def test_socket(websocket: WebSocket):
    await _run_session(websocket, TestSession(scorer))
