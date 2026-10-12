"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, CheckCircle2, Loader2, Maximize, Minimize, ServerCrash, X } from "lucide-react";
import type { SessionMode } from "../../lib/salute-ai";
import { useSaluteSession } from "./use-salute-session";
import TrainingHud from "./training-panel";
import TestPanel, { TestOverlay, TestResultOverlay } from "./test-panel";

const titles: Record<SessionMode, string> = {
  training: "ฝึกท่าเคารพตรงหน้า",
  test: "ทดสอบท่าเคารพตรงหน้า",
};

export default function SaluteSessionModal({ mode, onClose }: { mode: SessionMode; onClose: () => void }) {
  const { videoRef, overlayRef, status, errorDetail, latest, send } = useSaluteSession(mode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const connected = status === "connected";

  // ปิดด้วยปุ่ม Esc / ล็อกไม่ให้หน้าเว็บด้านหลังเลื่อน / ออกจากเต็มจอเมื่อปิด
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
    };
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const previousOverflow = document.body.style.overflow;

    onFullscreen();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  // วาดทับทั้งหน้าเว็บ (ไม่ให้เมนูด้านบนของเว็บบัง)
  return createPortal(
    <div className="fixed inset-0 z-100 overflow-hidden bg-black text-white">
      {/* ---------- กล้องเต็มจอ ---------- */}
      {/* แสดงแบบกระจก ให้ผู้ใช้ขยับแล้วเห็นเหมือนส่องกระจก */}
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      {/* พิกัดจากเซิร์ฟเวอร์เป็นของภาพที่ flip แล้ว → วาดตรง ๆ ไม่ต้องกลับด้าน */}
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* ---------- แถบด้านบน ---------- */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-linear-to-b from-black/60 to-transparent px-4 pt-3 pb-8 sm:px-6">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[#3ddc84]" : "bg-[#91a0b2]"}`} />
          <h2 className="text-lg font-bold drop-shadow sm:text-2xl">{titles[mode]}</h2>
        </div>
        <div className="flex items-center gap-2">
          <HudButton onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}</span>
          </HudButton>
          <HudButton onClick={onClose}>
            <X className="h-4 w-4" />
            ปิด
          </HudButton>
        </div>
      </header>

      {/* ---------- ข้อมูลทับกล้อง ---------- */}
      {connected && mode === "training" && (
        <TrainingHud latest={latest} connected={connected} onReset={() => send({ type: "reset" })} />
      )}

      {connected && mode === "test" && (
        <>
          <TestOverlay latest={latest} />

          {latest?.message && (
            <p className="absolute bottom-4 left-4 z-10 max-w-[calc(100vw-2rem)] rounded-xl border border-[#d03b3b]/60 bg-[#3a0d0d]/80 px-4 py-2.5 text-sm font-semibold text-[#ffb4b4] backdrop-blur-md md:max-w-[calc(100vw-440px)]">
              {latest.message}
            </p>
          )}

          {latest?.state === "result" || latest?.state === "summary" ? (
            // ผลการทดสอบ → กลางจอ
            <TestResultOverlay latest={latest} send={send} onClose={onClose} />
          ) : (
            <aside className="absolute inset-x-3 bottom-3 z-10 max-h-[46dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#07101b]/70 p-4 text-sm shadow-2xl backdrop-blur-md md:inset-x-auto md:top-24 md:right-5 md:bottom-auto md:max-h-[calc(100dvh-7.5rem)] md:w-80">
              <TestPanel latest={latest} connected={connected} send={send} />
            </aside>
          )}
        </>
      )}

      {!connected && <ConnectionNotice status={status} detail={errorDetail} />}
    </div>,
    document.body
  );
}

export function HudButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-black/60"
    >
      {children}
    </button>
  );
}

function ConnectionNotice({ status, detail }: { status: string; detail: string | null }) {
  if (status === "starting") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#d8e2ee]">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p>กำลังเปิดกล้องและเชื่อมต่อ AI...</p>
      </div>
    );
  }

  if (status === "camera_error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[#d8e2ee]">
        <Camera className="h-10 w-10 text-[#ff9b9b]" />
        <p className="text-lg font-semibold text-white">เปิดกล้องไม่ได้</p>
        <p className="text-sm text-[#91a0b2]">อนุญาตให้เว็บใช้กล้องในเบราว์เซอร์ แล้วกดปิดและเปิดใหม่</p>
        {detail && <p className="text-xs text-[#5f7187]">{detail}</p>}
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#d8e2ee]">
        <CheckCircle2 className="h-10 w-10" />
        <p>การเชื่อมต่อสิ้นสุดแล้ว — ปิดแล้วเปิดใหม่เพื่อเริ่มอีกครั้ง</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[#d8e2ee]">
      <ServerCrash className="h-10 w-10 text-[#ff9b9b]" />
      <p className="text-lg font-semibold text-white">{detail ?? "เชื่อมต่อ AI server ไม่ได้"}</p>
      <p className="text-sm text-[#91a0b2]">เปิด AI server ก่อน แล้วกดปิดและเปิดหน้านี้ใหม่</p>
      <code className="rounded-lg bg-[#07101b] px-3 py-2 text-left text-xs text-[#ffd22e]">
        cd rodoorweb\AI_Detection
        <br />
        py -3.10 web_api/run_server.py
      </code>
    </div>
  );
}
