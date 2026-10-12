"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SALUTE_AI_URL,
  blendLandmarks,
  drawSkeleton,
  socketUrl,
  type Command,
  type Connections,
  type Landmarks,
  type ServerMessage,
  type SessionMode,
} from "../../lib/salute-ai";
import { createLocalLandmarker, type LocalLandmarker } from "../../lib/local-landmarker";

const FRAME_INTERVAL_MS = 100; // ~10 FPS (เท่ากับตอนอัด dataset)
const JPEG_QUALITY = 0.7;
// ส่งภาพล่วงหน้าได้หลายภาพโดยไม่ต้องรอคำตอบ — เซิร์ฟเวอร์อยู่ไกล (ไป-กลับ ~0.3–0.4 วินาที)
// ถ้ารอทีละภาพ จะได้แค่ ~2–3 ภาพ/วินาที → AI ได้ข้อมูลน้อยกว่าตอนอัด dataset (10 FPS) แล้วผลเพี้ยน
// 6 ภาพ = รองรับเวลาไป-กลับได้ถึง ~0.6 วินาทีโดยยังได้ 10 FPS
const MAX_IN_FLIGHT = 6;
const SMOOTHING = 0.45; // จุดจากเซิร์ฟเวอร์ (มาช้า/ห่าง) — ต่อ 1 เฟรมจอ, ยิ่งมากยิ่งตามไว
const LOCAL_SMOOTHING = 0.7; // จุดจากเบราว์เซอร์ (ทันที) — ลดอาการสั่นเล็กน้อย

export type ConnectionStatus = "starting" | "connected" | "camera_error" | "server_error" | "closed";

/**
 * เปิดกล้อง + เชื่อม WebSocket กับ SaluteAI Web API
 * ส่งภาพ ~10 ภาพ/วินาที (ค้างรอคำตอบได้ไม่เกิน MAX_IN_FLIGHT ภาพ) แล้ววาดโครงกระดูกบน overlay canvas
 */
export function useSaluteSession(mode: SessionMode) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("starting");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [latest, setLatest] = useState<ServerMessage | null>(null);
  const [aspect, setAspect] = useState(4 / 3);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let animation = 0;
    let inFlight = 0;
    let connections: Connections | null = null;
    let target: Landmarks | null = null;
    let shown: Landmarks | null = null;
    let local: LocalLandmarker | null = null;
    let lastVideoTime = -1;
    const capture = document.createElement("canvas");

    // วาดทุกเฟรมจอ — ขยับจุดเข้าหาผลล่าสุดแบบนุ่ม ๆ แทนการกระโดดตอนผลมาถึง
    const render = () => {
      animation = requestAnimationFrame(render);
      const overlay = overlayRef.current;
      const video = videoRef.current;
      if (!overlay || !video?.videoWidth) return;

      // มีตัวหาจุดในเบราว์เซอร์ → ใช้วาดแทนผลจากเซิร์ฟเวอร์ (ตรงกับภาพทันที)
      if (local && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          target = local.detect(video, performance.now());
        } catch {
          local.close();
          local = null;
        }
      }

      shown = target ? blendLandmarks(shown, target, local ? LOCAL_SMOOTHING : SMOOTHING) : null;
      if (overlay.width !== overlay.clientWidth) overlay.width = overlay.clientWidth;
      if (overlay.height !== overlay.clientHeight) overlay.height = overlay.clientHeight;
      drawSkeleton(overlay, shown ?? undefined, connections, video.videoWidth, video.videoHeight);
    };

    const tick = () => {
      if (cancelled) return;
      timer = setTimeout(tick, FRAME_INTERVAL_MS);
      sendFrame();
    };

    const sendFrame = () => {
      const video = videoRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN || inFlight >= MAX_IN_FLIGHT) return;
      if (!video || video.readyState < 2 || !video.videoWidth) return;

      // ภาพจากกล้องตรง ๆ (ไม่ mirror) — เซิร์ฟเวอร์ flip ให้เองเหมือนตอนอัด dataset
      capture.width = video.videoWidth;
      capture.height = video.videoHeight;
      capture.getContext("2d")?.drawImage(video, 0, 0);
      const capturedAt = Date.now() / 1000;

      inFlight += 1;

      capture.toBlob(
        (blob) => {
          if (!blob || cancelled || !socket || socket.readyState !== WebSocket.OPEN) {
            inFlight = Math.max(0, inFlight - 1);
            return;
          }
          // [เวลาถ่าย 8 byte] + JPEG → เซิร์ฟเวอร์จัดจังหวะเวลาตามตอนถ่าย ไม่ใช่ตอนที่ภาพมาถึง
          const header = new ArrayBuffer(8);
          new DataView(header).setFloat64(0, capturedAt, true);
          socket.send(new Blob([header, blob]));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    const start = async () => {
      // 1) เส้นเชื่อมจุดสำหรับวาดโครงกระดูก + เช็กว่าเซิร์ฟเวอร์เปิดอยู่
      try {
        const response = await fetch(`${SALUTE_AI_URL}/api/info`);
        connections = (await response.json()).connections;
      } catch {
        if (!cancelled) {
          setStatus("server_error");
          setErrorDetail("เชื่อมต่อ AI server ไม่ได้");
        }
        return;
      }

      // 2) กล้อง
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) {
          setStatus("camera_error");
          setErrorDetail(error instanceof Error ? error.message : String(error));
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
          video.play().catch(() => {});
        };
      }

      // 3) WebSocket
      socket = new WebSocket(socketUrl(mode));
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        tick();
        render();

        // โหลดโมเดลวาดโครงกระดูกในเบราว์เซอร์ (ไม่ได้ = ใช้จุดจากเซิร์ฟเวอร์ต่อไป)
        createLocalLandmarker()
          .then((landmarker) => {
            if (cancelled) landmarker.close();
            else local = landmarker;
          })
          .catch(() => {});
      };

      socket.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);

        if (message.type === "frame" || message.type === "error") inFlight = Math.max(0, inFlight - 1);
        if (message.type === "frame" && !local) target = message.landmarks ?? null;

        if (message.type === "frame" || message.type === "state") {
          setLatest((previous) => ({ ...previous, ...message }));
        }
      };

      socket.onerror = () => {
        if (!cancelled) {
          setStatus("server_error");
          setErrorDetail("การเชื่อมต่อกับ AI server ขาด");
        }
      };

      socket.onclose = () => {
        if (!cancelled) setStatus((current) => (current === "connected" ? "closed" : current));
      };
    };

    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(animation);
      local?.close();
      socket?.close();
      socketRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [mode]);

  const send = useCallback((command: Command) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command));
  }, []);

  return { videoRef, overlayRef, status, errorDetail, latest, aspect, send };
}
