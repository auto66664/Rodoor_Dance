# SaluteAI Web API

AI ฝั่งเว็บสำหรับท่าวันทยหัตถ์ — ใช้โมเดลและกฎชุดเดียวกับ notebook (`models/`, `salute_rules.py`)
โดยไม่แก้ไฟล์เดิม

```
เบราว์เซอร์ (localhost:3000/training/salute)
   │  เปิดกล้อง → ส่งภาพ JPEG ~10 เฟรม/วิ ทาง WebSocket
   ▼
web_api (FastAPI, localhost:8000)
   │  MediaPipe Holistic → vector 218 ค่า (เหมือนตอนอัด dataset)
   │  Siamese (encoder.keras) + กฎ feedback (salute_rules.py)
   ▼
ส่งกลับ JSON: จุดโครงกระดูก, สถานะ, คะแนน, feedback ภาษาไทย
```

| ปุ่มบนเว็บ | Endpoint | ตรรกะเดียวกับ |
|---|---|---|
| เริ่มฝึก | `ws://127.0.0.1:8000/ws/training` | `siamese_learn.ipynb` cell 5 Test (realtime) |
| ทดสอบ | `ws://127.0.0.1:8000/ws/test` | `siamese_test_mode.ipynb` |

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `config.py` | ค่าตั้งต้นทั้งหมด (port, เวลา, จำนวนครั้งทดสอบ, การหักคะแนน) |
| `features.py` | ภาพ → MediaPipe → 218 ค่า (copy จาก notebook ห้ามแก้ให้ต่างกัน) |
| `scorer.py` | โหลดโมเดล + ให้คะแนน (Siamese + กฎ) |
| `sessions.py` | สถานะผู้ใช้ 1 คน: `TrainingSession`, `TestSession` |
| `server.py` | FastAPI: HTTP + WebSocket |
| `run_server.py` | สคริปต์เริ่มเซิร์ฟเวอร์ |
| `check_offline.py` | ทดสอบโดยไม่ต้องเปิดกล้อง (ป้อนคลิปจาก dataset) |
| `generate_voices.py` | สร้างไฟล์เสียง feedback ด้วย Botnoi Voice |

## วิธีรัน

```bash
cd AI_Detection
py -3.10 -m pip install -r web_api/requirements.txt   # ครั้งแรกครั้งเดียว
py -3.10 web_api/run_server.py
```

เช็ก: เปิด http://127.0.0.1:8000/api/health → ต้องได้ `{"status":"ok", ...}`

ทดสอบโดยไม่ใช้กล้อง: `py -3.10 web_api/check_offline.py`

> หลังเทรนโมเดลใหม่ใน notebook (cell 2 → 3 → 4 → 4.5) ให้ **ปิดแล้วเปิดเซิร์ฟเวอร์ใหม่** เพื่อโหลดโมเดลใหม่

---

## สำหรับฝั่งเว็บ (Next.js)

### HTTP
- `GET /api/health` → `{ status, references, threshold }`
- `GET /api/info` → `{ feedback: {code: {name, tip}}, config: {...}, connections: { pose: [[a,b],...], hand: [[a,b],...] } }`
  ใช้ `connections` วาดเส้นโครงกระดูก

### การส่งภาพ (ทั้งสองโหมด)
- ส่ง **ภาพ JPEG เป็น binary message** 1 ภาพต่อ 1 ข้อความ ประมาณ **10 เฟรม/วินาที**
- ส่งภาพ **ไม่ต้อง mirror** (วาด `<video>` ลง canvas ตรง ๆ แล้ว `canvas.toBlob(..., "image/jpeg", 0.7)`) — เซิร์ฟเวอร์ flip ให้เองเหมือนตอนอัด
- **รอคำตอบของภาพก่อนหน้าก่อนส่งภาพถัดไป** (กันคิวล้น)
- พิกัดที่ตอบกลับ (`landmarks`) เป็นค่า 0–1 ของภาพที่ flip แล้ว → แสดง `<video>` แบบกระจก (`transform: scaleX(-1)`) แล้ววาดจุดบน canvas ซ้อนด้านบน **โดยไม่ต้องกลับด้าน**

ทุกเฟรมได้คำตอบ:
```jsonc
{
  "type": "frame",
  "mode": "training" | "test",
  "framing": { "body": true, "head": true, "feet": true },   // หัว/เท้าอยู่ในภาพไหม
  "landmarks": {
    "pose": [[x, y, visibility], ... 33 จุด] | null,
    "left_hand": [[x, y], ... 21 จุด] | null,
    "right_hand": [[x, y], ... 21 จุด] | null
  },
  "message": "ข้อความเตือน เช่น เท้าหลุดเฟรม" | null,
  ...ค่าตามโหมด (ด้านล่าง)
}
```

### โหมดฝึก `/ws/training`
ส่งภาพไปเรื่อย ๆ ได้เลย ไม่ต้องส่งคำสั่ง

| `state` | ความหมาย |
|---|---|
| `no_body` | ตรวจไม่เจอตัว |
| `warming_up` | กำลังเก็บข้อมูล 6 วินาทีแรก (`buffer_seconds`) |
| `running` | ประเมินแล้ว ดู `result` |

```jsonc
"result": {
  "status": "correct" | "fix" | "not_similar",
  "message": "ท่าถูกต้อง ดีมาก!" | "ต้องแก้ไข" | "ท่ายังไม่ตรงกับต้นแบบ ...",
  "similarity": 87.5,          // % ความคล้ายต้นแบบ (เฉลี่ย 5 ครั้งล่าสุด)
  "is_similar": true,
  "errors": [ { "code": "hand_low", "name": "ปลายนิ้วต่ำกว่าคิ้ว", "tip": "ยกมือขึ้นให้ปลายนิ้วอยู่ระดับคิ้ว" } ]
}
```
คำสั่ง (ไม่บังคับ): `{"type": "reset"}` ล้างข้อมูลแล้วเริ่มใหม่

### โหมดทดสอบ `/ws/test`
ส่งภาพตลอดเวลา + ส่งคำสั่งเป็น JSON text ตามปุ่มบนเว็บ

| คำสั่ง | ใช้ตอน |
|---|---|
| `{"type": "start", "num_attempts": 3}` | `idle` หรือ `summary` → เริ่มทดสอบ |
| `{"type": "next"}` | `result` → ครั้งถัดไป / สรุปผล |
| `{"type": "save_correct"}` | `result` → บันทึกครั้งนี้เป็นท่าถูกใน dataset (ใช้ได้เมื่อ `can_save_correct`) |
| `{"type": "stop"}` | ทุกเมื่อ → ไปหน้าสรุปผล |

คำสั่งได้คำตอบ `{"type": "state", ...}` (รูปแบบเดียวกับเฟรม แต่ไม่มี `landmarks`)

| `state` | แสดงอะไร | ค่าที่ใช้ |
|---|---|---|
| `idle` | หน้าพร้อม — ปุ่มเริ่มกดได้เมื่อ `ready` | `ready`, `message` |
| `countdown` | นับถอยหลัง 3–2–1 | `countdown` |
| `waiting` | "ยกมือทำวันทยหัตถ์เมื่อพร้อม" (เริ่มจับเวลาอัตโนมัติตอนยกมือ) | `wait_remaining` |
| `recording` | กำลังจับเวลา | `elapsed` / `duration` (4 วิ) |
| `result` | ผลครั้งนี้ | `result`, `can_save_correct` |
| `summary` | สรุปทุกครั้ง | `summary`, `results`, `saved_file` |

ทุก state มี `attempt`, `num_attempts`

```jsonc
"result": {
  "accuracy": 90.0,              // เริ่ม 100 ผิด 1 อย่างหัก 10
  "passed": false,
  "similarity": 78.8, "is_similar": true,
  "rules_passed": 9, "total_rules": 10,
  "penalty": 10,
  "deductions": [ { "reason": "ปลายนิ้วสูงกว่าคิ้ว", "amount": 10 } ],
  "errors": [ { "code": "hand_high", "name": "ปลายนิ้วสูงกว่าคิ้ว", "tip": "ลดมือลงให้ปลายนิ้วอยู่ระดับคิ้ว" } ],
  "body_visible": true,          // false = หัว/เท้าหลุดเฟรม ผลอาจไม่แม่น
  "attempt": 1
}

"summary": {
  "overall_accuracy": 93.3,      // ความแม่นยำรวม
  "best": 100.0, "worst": 80.0,
  "passed": 2, "attempts": 3,
  "common_errors": [ { "code": "...", "name": "...", "tip": "...", "count": 2 } ]
}
```

---

## เสียงพูด feedback
โหมดฝึกพูดคำสั่ง "ตรงหน้า วันทยหัตถ์ ยก อก อึ้บ" แล้วพูด feedback ทีละข้อ จากไฟล์เสียงที่สร้างไว้ล่วงหน้า
(`rodoorweb/public/sounds/salute/*.mp3` — เล่นได้ทุกเบราว์เซอร์ ไม่เรียก TTS ระหว่างฝึก)

```bash
py -3.10 web_api/generate_voices.py --list     # ดูประโยค
py -3.10 web_api/generate_voices.py            # สร้าง/อัปเดตเฉพาะที่เปลี่ยน
```

| เสียง | ใช้เมื่อ |
|---|---|
| Microsoft Edge TTS `th-TH-NiwatNeural` (ฟรี) | ยังไม่มี Botnoi API key (ตอนนี้ใช้ตัวนี้) |
| Botnoi Voice "โตโต้" (speaker 30) | ใส่ `BOTNOI_API_KEY=...` ใน `web_api/.env` แล้วรันสคริปต์ใหม่ → แทนที่เสียง Edge อัตโนมัติ |

- แก้ข้อความ feedback ใน `salute_rules.py` → รันสคริปต์ใหม่ (สร้างเฉพาะประโยคที่เปลี่ยน)
- เปลี่ยนเสียง Edge: แก้ `EDGE_VOICE` (`th-TH-PremwadeeNeural` = หญิง) แล้วรันใหม่
- ข้อความ "command / passed / no_body / not_similar" ต้องตรงกับ `training-panel.tsx`

## เพิ่มท่าผิดใหม่ (หลังขึ้นเว็บแล้ว)
1. เพิ่มชื่อใน `ERROR_INFO` (notebook cell 1) และ `FEEDBACK_TH` + กฎใน `CALIBRATED_RULES` / `PRIORITY` (`salute_rules.py`)
2. อัดท่าผิดใหม่ด้วย `ERROR_TYPE = "ชื่อใหม่"`
3. รัน cell 2 → 3 → 4 → 4.5
4. `py -3.10 web_api/generate_voices.py` สร้างเสียงของท่าใหม่
5. ปิด-เปิด `run_server.py` ใหม่ — **เว็บไม่ต้องแก้** (ข้อความ feedback มาจาก API)
