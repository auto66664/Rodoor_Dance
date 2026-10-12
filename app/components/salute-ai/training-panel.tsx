"use client";

import { useState } from "react";
import { AlertTriangle, Award, CheckCircle2, Megaphone, RotateCcw, Timer, Volume2, VolumeX } from "lucide-react";
import type { ServerMessage, TrainingResult } from "../../lib/salute-ai";
import { useVoiceFeedback, type VoiceLine } from "./use-voice-feedback";

const VOICE_STORAGE_KEY = "salute-voice-enabled";
const PASS_SIMILARITY = 70; // ต้องตรงกับ PASS_SIMILARITY ใน AI_Detection/web_api/config.py

// คำสั่งตอนเริ่มฝึก — พูดหลังเก็บข้อมูลครบ 6 วินาที
// (ไฟล์เสียงเว้นจังหวะ ตรงหน้า·0.5·วันทยหัตถ์·0.5·ยกอก·0.7·อึ้บ ดู VOICE_SEQUENCES ใน generate_voices.py)
const COMMAND: VoiceLine = { key: "command", text: "ตรงหน้า, วันทยหัตถ์, ยกอก, อึ้บ" };

// ข้อความเสียงของสถานะ (ข้อความ feedback แต่ละข้อมาจาก FEEDBACK_TH ใน salute_rules.py)
// ต้องตรงกับ VOICE_LINES ใน AI_Detection/web_api/generate_voices.py
const STATUS_SPEECH: Record<string, string> = {
  no_body: "ถอยให้เห็นทั้งตัว",
  passed: "ผ่าน ท่าถูกต้อง",
  correct: "ท่าถูกต้อง ดีมาก",
  not_similar: "ท่ายังไม่ตรงกับต้นแบบ ลองทำใหม่อีกครั้ง",
};

// ประโยคที่จะพูดตอนนี้ (พูดทีละข้อ: ผ่าน / ตัวไม่อยู่ในภาพ / ผิดข้อสำคัญที่สุด / ไม่คล้ายต้นแบบ)
function voiceLine(latest: ServerMessage | null, result: TrainingResult | null): VoiceLine | null {
  if (latest?.state === "passed") return { key: "passed", text: STATUS_SPEECH.passed };
  if (latest?.state === "no_body") return { key: "no_body", text: STATUS_SPEECH.no_body };
  if (!result) return null;

  if (result.status === "fix") {
    const error = result.errors[0];
    // บอกจุดที่ผิด แล้วตามด้วยวิธีแก้
    return error ? { key: error.code, text: `${error.name} ${error.tip}` } : null;
  }

  return { key: result.status, text: STATUS_SPEECH[result.status] };
}

function loadVoiceEnabled() {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

const statusStyle = {
  passed: "text-[#3ddc84]",
  correct: "text-[#3ddc84]",
  fix: "text-[#ff8a8a]",
  not_similar: "text-[#ffb02e]",
};

/**
 * ข้อมูลโหมดฝึกที่วาดทับกล้องเต็มจอ
 * - บนซ้าย: คำสั่ง / บนขวา: ปุ่มเสียง
 * - ล่าง: แถบ feedback แนวนอน (สถานะ + ความคล้าย + จุดที่ต้องแก้)
 * - ผ่าน: ป้ายใหญ่กลางจอ + ปุ่มฝึกอีกครั้ง
 */
export default function TrainingHud({
  latest,
  connected,
  onReset,
}: {
  latest: ServerMessage | null;
  connected: boolean;
  onReset: () => void;
}) {
  const result = (latest?.result ?? null) as TrainingResult | null;
  const buffer = latest?.buffer_seconds ?? 0;
  const passed = latest?.state === "passed";

  const [voiceOn, setVoiceOn] = useState(loadVoiceEnabled);
  const [round, setRound] = useState(0);

  // เก็บข้อมูลครบ 6 วินาทีแล้ว → พูดคำสั่ง จากนั้นค่อยพูด feedback ทีละข้อ
  const collected = connected && (latest?.state === "running" || passed);
  useVoiceFeedback(connected ? voiceLine(latest, result) : null, collected ? COMMAND : null, voiceOn, round);

  const toggleVoice = () => {
    setVoiceOn((on) => {
      try {
        window.localStorage.setItem(VOICE_STORAGE_KEY, on ? "off" : "on");
      } catch {
        // ไม่มี localStorage ก็ใช้ได้ แค่ไม่จำค่า
      }
      return !on;
    });
  };

  const restart = () => {
    setRound((r) => r + 1);
    onReset();
  };

  return (
    <>
      {/* ---------- บน: คำสั่ง + ปุ่มเสียง ---------- */}
      <div className="absolute inset-x-4 top-16 z-10 flex items-start justify-between gap-3 sm:inset-x-6">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-4 py-2.5 backdrop-blur-md">
          <Megaphone className="h-5 w-5 shrink-0 text-[#ffd22e]" />
          <span className="text-sm sm:text-base">
            คำสั่ง: <b>ตรงหน้า วันทยหัตถ์ ยกอก อึ้บ</b>
          </span>
        </div>
        <button
          onClick={toggleVoice}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border bg-black/50 px-3 py-2 text-sm backdrop-blur-md transition duration-200 hover:scale-105 ${
            voiceOn ? "border-[#ffd22e]/60 text-[#ffd22e]" : "border-white/20 text-[#91a0b2]"
          }`}
        >
          {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {voiceOn ? "เสียงเปิด" : "เสียงปิด"}
        </button>
      </div>

      {/* ---------- ผ่าน: กลางจอ ---------- */}
      {passed && result && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#3ddc84]/10">
          <Award className="h-24 w-24 text-[#3ddc84] drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]" />
          <p className="text-8xl font-extrabold text-[#3ddc84] drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">ผ่าน!</p>
          <p className="rounded-lg bg-black/50 px-4 py-1.5 text-lg backdrop-blur-md">
            ท่าถูกต้อง · ความคล้ายท่าต้นแบบ {result.similarity.toFixed(1)}%
          </p>
          <button
            onClick={restart}
            className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl bg-[#ffd22e] px-8 py-4 text-lg font-extrabold text-[#111] transition duration-200 hover:scale-105 hover:brightness-105 active:scale-[0.99]"
          >
            <RotateCcw className="h-5 w-5" />
            ฝึกอีกครั้ง
          </button>
        </div>
      )}

      {/* ---------- ล่าง: แถบ feedback แนวนอน ---------- */}
      {!passed && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/90 via-black/70 to-transparent px-4 pt-12 pb-4 sm:px-6">
          {latest?.message && (
            <p className="mb-3 inline-block rounded-lg border border-[#d03b3b]/60 bg-[#3a0d0d]/80 px-3 py-1.5 text-sm font-semibold text-[#ffb4b4]">
              {latest.message}
            </p>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {/* สถานะ + ความคล้าย */}
            <div className="flex shrink-0 flex-col justify-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3 lg:w-80">
              {!result ? (
                <>
                  <div className="flex items-center gap-2 text-base">
                    <Timer className="h-5 w-5" />
                    {latest?.state === "no_body" ? "รอตรวจจับร่างกาย..." : `กำลังเก็บข้อมูล ${buffer.toFixed(1)} / 6 วินาที`}
                  </div>
                  <Bar percent={(buffer / 6) * 100} color="bg-[#ffd22e]" />
                </>
              ) : (
                <>
                  <div className={`flex items-center gap-2 text-2xl font-bold ${statusStyle[result.status]}`}>
                    {result.status === "correct" ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
                    {result.message}
                  </div>
                  <div className="flex items-center justify-between text-sm text-[#d8e2ee]">
                    <span>ความคล้ายท่าต้นแบบ (ผ่านเมื่อเกิน {PASS_SIMILARITY}%)</span>
                    <span className="font-semibold text-[#ffd22e]">{result.similarity.toFixed(1)}%</span>
                  </div>
                  <Bar
                    percent={result.similarity}
                    color={result.similarity > PASS_SIMILARITY ? "bg-[#3ddc84]" : "bg-[#ffb02e]"}
                    marker={PASS_SIMILARITY}
                  />
                </>
              )}
            </div>

            {/* จุดที่ต้องแก้ เรียงแนวนอน (เสียงพูดทีละข้อ ข้อความขึ้นได้หลายข้อ) */}
            {result && result.errors.length > 0 && (
              <ul className="flex flex-1 gap-3 overflow-x-auto">
                {result.errors.map((error) => (
                  <li
                    key={error.code}
                    className="min-w-60 flex-1 rounded-xl border border-[#d03b3b]/50 bg-[#3a0d0d]/60 px-4 py-3"
                  >
                    <p className="text-lg font-bold text-[#ff9b9b]">{error.name}</p>
                    <p className="mt-0.5 text-sm text-[#f1d6d6]">→ {error.tip}</p>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={restart}
              className="flex shrink-0 cursor-pointer items-center justify-center gap-1.5 self-end rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-[#d8e2ee] transition duration-200 hover:scale-105 hover:bg-black/60 lg:self-center"
            >
              <RotateCcw className="h-4 w-4" />
              เริ่มใหม่
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Bar({ percent, color, marker }: { percent: number; color: string; marker?: number }) {
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/15">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, percent)}%` }} />
      {marker !== undefined && <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${marker}%` }} />}
    </div>
  );
}
