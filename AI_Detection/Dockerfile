# SaluteAI Web API (AI server) — ใช้ deploy ขึ้น Google Cloud Run / Railway / Render / Fly.io
#   build:  docker build -t salute-ai .        (รันในโฟลเดอร์ AI_Detection)
#   run:    docker run -p 8000:8000 -e PORT=8000 salute-ai
FROM python:3.10-slim

# ไลบรารีระบบที่ OpenCV / MediaPipe ต้องใช้
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    SAVE_RESULTS=0 \
    PORT=8080

WORKDIR /app

COPY web_api/requirements-deploy.txt ./requirements.txt
RUN pip install -r requirements.txt

# เฉพาะไฟล์ที่ AI server ใช้: กฎ + โมเดล + ท่าต้นแบบ (dataset/correct) + โค้ด API
COPY salute_rules.py ./
COPY models ./models
COPY dataset/correct ./dataset/correct
COPY web_api ./web_api

# โมเดลที่เทรน/เซฟบน Windows เก็บชื่อน้ำหนักด้วย "\" → แปลงเป็น "/" ให้ Linux โหลดได้
RUN python web_api/fix_keras_paths.py models/encoder.keras

EXPOSE 8080
CMD ["python", "web_api/run_server.py"]
