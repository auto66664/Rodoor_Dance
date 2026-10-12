"use client";

import { useState } from "react";
import { ClipboardCheck, Play } from "lucide-react";
import { useToast } from "./toast-provider";
import { useLoginGate } from "./login-gate";
import SaluteSessionModal from "./salute-ai/salute-session-modal";
import type { SessionMode } from "../lib/salute-ai";

const lockedSlugs = ["left-face", "right-face"];

// ท่าที่มี AI แล้ว (AI_Detection/web_api)
const aiSlugs = ["salute"];

export default function StartTrainingButton({ slug, name }: { slug: string; name: string }) {
  const showToast = useToast();
  const isLocked = lockedSlugs.includes(slug);
  const hasAI = aiSlugs.includes(slug);
  const [session, setSession] = useState<SessionMode | null>(null);
  const gate = useLoginGate();

  // ทุกปุ่มต้องล็อกอินก่อน
  const guarded = (action: () => void) => () => {
    if (gate(`/training/${slug}`)) action();
  };

  const openSession = (mode: SessionMode) => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setSession(mode);
  };

  const requireSalute = () => {
    alert("กรุณาฝึกท่าเคารพตรงหน้าให้ผ่านก่อน");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        onClick={guarded(
          isLocked
            ? requireSalute
            : hasAI
              ? () => openSession("training")
              : () => showToast(`เริ่มฝึก "${name}" — กำลังเปิดกล้องวิเคราะห์ท่าทาง AI`)
        )}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ffd22e] px-6 py-4 text-base font-extrabold text-[#111] shadow-lg shadow-[#ffd22e]/20 transition duration-200 hover:scale-105 hover:brightness-105 active:scale-[0.99] sm:w-auto"
      >
        <Play className="h-5 w-5" strokeWidth={2} fill="currentColor" />
        เริ่มฝึก
      </button>
      <button
        onClick={guarded(
          isLocked
            ? requireSalute
            : hasAI
              ? () => openSession("test")
              : () => showToast(`ทดสอบ "${name}" — กำลังเปิดกล้องประเมินผลท่าทาง AI`)
        )}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#d03b3b] px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-[#d03b3b]/20 transition duration-200 hover:scale-105 hover:brightness-110 active:scale-[0.99] sm:w-auto"
      >
        <ClipboardCheck className="h-5 w-5" strokeWidth={2} />
        ทดสอบ
      </button>

      {session && <SaluteSessionModal key={session} mode={session} onClose={() => setSession(null)} />}
    </div>
  );
}
