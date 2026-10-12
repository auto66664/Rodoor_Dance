"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SALUTE_AI_URL,
  drawSkeleton,
  socketUrl,
  type Command,
  type Connections,
  type ServerMessage,
  type SessionMode,
} from "../../lib/salute-ai";

const FRAME_INTERVAL_MS = 100; // ~10 FPS (เท่ากับตอนอัด dataset)
const JPEG_QUALITY = 0.7;

export type ConnectionStatus = "starting" | "connected" | "camera_error" | "server_error" | "closed";

/**
 * เปิดกล้อง + เชื่อม WebSocket กับ SaluteAI Web API
 * ส่งภาพทีละเฟรม (รอคำตอบก่อนส่งเฟรมถัดไป) แล้ววาดโครงกระดูกบน overlay canvas
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
    let waitingReply = false;
    let lastSentAt = 0;
    let connections: Connections | null = null;
    const capture = document.createElement("canvas");

    const sendFrame = () => {
      const video = videoRef.current;

      if (cancelled || !socket || socket.readyState !== WebSocket.OPEN || waitingReply) return;

      if (!video || video.readyState < 2 || !video.videoWidth) {
        timer = setTimeout(sendFrame, FRAME_INTERVAL_MS);
        return;
      }

      // ภาพจากกล้องตรง ๆ (ไม่ mirror) — เซิร์ฟเวอร์ flip ให้เองเหมือนตอนอัด dataset
      capture.width = video.videoWidth;
      capture.height = video.videoHeight;
      capture.getContext("2d")?.drawImage(video, 0, 0);

      waitingReply = true;
      lastSentAt = performance.now();

      capture.toBlob(
        (blob) => {
          if (!blob || cancelled || !socket || socket.readyState !== WebSocket.OPEN) {
            waitingReply = false;
            return;
          }
          socket.send(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    const scheduleNext = () => {
      const wait = Math.max(0, FRAME_INTERVAL_MS - (performance.now() - lastSentAt));
      timer = setTimeout(sendFrame, wait);
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
        sendFrame();
      };

      socket.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);

        if (message.type === "frame" || message.type === "error") {
          waitingReply = false;
          scheduleNext();
        }

        if (message.type === "frame") {
          const overlay = overlayRef.current;
          const video = videoRef.current;
          if (overlay && video?.videoWidth) {
            overlay.width = overlay.clientWidth;
            overlay.height = overlay.clientHeight;
            drawSkeleton(overlay, message.landmarks, connections, video.videoWidth, video.videoHeight);
          }
        }

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
