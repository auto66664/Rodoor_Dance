"""
เริ่ม SaluteAI Web API

    cd AI_Detection
    py -3.10 web_api/run_server.py

แล้วเปิด http://127.0.0.1:8000/api/health เพื่อเช็กว่าพร้อม
"""
import os
import sys
from pathlib import Path

import uvicorn

WEB_API_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(WEB_API_DIR))
os.chdir(WEB_API_DIR)

import config  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("server:app", host=config.HOST, port=config.PORT, log_level="info")
