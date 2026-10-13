"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Award, CheckCircle2, Hand, Play, RotateCcw, Square, XCircle } from "lucide-react";
import type { AttemptResult, Command, ServerMessage } from "../../lib/salute-ai";
import { gradeOf, saveTestResult } from "../../lib/activity-store";
import { useAuth } from "../auth-provider";

const NUM_ATTEMPTS = 1; // ต้องตรงกับ NUM_ATTEMPTS ใน AI_Detection/web_api/config.py

// เสียงคำสั่ง "ตรงหน้า วันทยหัตถ์ ยกอก อึ้บ" — เล่นทันทีที่นับถอยหลังจบ เป็นสัญญาณให้ผู้ฝึกทำท่า
// (การจับเวลายังเริ่มตอนตรวจพบว่ายกมือเหมือนเดิม เสียงไม่มีผลกับการคิดคะแนน)
const TEST_COMMAND_SOUND = "/sounds/salute/test_command.mp3";

function useTestCommandSound(state: string | undefined, attempt: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedForRef = useRef<number | null>(null);

  useEffect(() => {
    // นับถอยหลังจบ → เข้าช่วงรอยกมือ: เล่น 1 ครั้งต่อการทดสอบ 1 ครั้ง
    if (state === "waiting" && playedForRef.current !== attempt) {
      playedForRef.current = attempt;
      const audio = audioRef.current ?? new Audio(TEST_COMMAND_SOUND);
      audioRef.current = audio;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    // ทดสอบครั้งเดิมใหม่ (เช่น เก็บเฟรมไม่พอ) → นับถอยหลังใหม่ → เล่นอีกรอบ
    if (state === "countdown") playedForRef.current = null;

    // จบครั้งนั้นแล้ว / หยุดทดสอบ → หยุดเสียง
    if (state === "result" || state === "summary" || state === "idle") audioRef.current?.pause();
  }, [state, attempt]);

  useEffect(() => () => audioRef.current?.pause(), []);
}

// ---------- ข้อความทับวิดีโอ (นับถอยหลัง / รอยกมือ / จับเวลา) ----------
export function TestOverlay({ latest }: { latest: ServerMessage | null }) {
  const state = latest?.state;

  if (state === "countdown") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
        <p className="text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">เตรียมตัว</p>
        <p className="text-[140px] leading-none font-extrabold text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
          {latest?.countdown}
        </p>
      </div>
    );
  }

  if (state === "waiting") {
    return (
      <div className="absolute inset-x-0 top-0 bg-[#12345a]/90 px-4 pt-4 pb-3 text-center">
        <p className="text-xl font-bold text-white">ฟังคำสั่ง แล้วทำท่าตามจังหวะ</p>
        <p className="text-sm text-[#d8e2ee]">
          เริ่มจับเวลาอัตโนมัติเมื่องอศอกยกมือ (รอได้อีก {Math.ceil(latest?.wait_remaining ?? 0)} วินาที)
        </p>
      </div>
    );
  }

  if (state === "recording") {
    const elapsed = latest?.elapsed ?? 0;
    const duration = latest?.duration ?? 4;
    return (
      <>
        <div className="absolute inset-x-0 top-0 bg-[#b3261e]/90 px-4 py-4 text-center">
          <p className="text-xl font-bold text-white">
            ● กำลังจับเวลา {elapsed.toFixed(1)} / {duration} วินาที
          </p>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
          <p className="rounded-2xl bg-black/60 px-6 py-3 text-center text-3xl font-bold text-[#ffd22e] sm:text-4xl">
            กรุณาค้างท่าไว้
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-2 bg-black/40">
          <div className="h-full bg-[#3ddc84] transition-all" style={{ width: `${(elapsed / duration) * 100}%` }} />
        </div>
      </>
    );
  }

  return null;
}

// ---------- แผงด้านขวา ----------
export default function TestPanel({
  latest,
  connected,
  send,
}: {
  latest: ServerMessage | null;
  connected: boolean;
  send: (command: Command) => void;
}) {
  const state = latest?.state ?? "idle";
  const attempt = latest?.attempt ?? 1;
  const total = latest?.num_attempts ?? NUM_ATTEMPTS;

  useTestCommandSound(connected ? state : undefined, attempt);

  if (!connected) {
    return <p className="text-sm text-[#91a0b2]">รอเชื่อมต่อ AI...</p>;
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-white">โหมดทดสอบ</h3>
        <ol className="space-y-2 text-sm text-[#d8e2ee]">
          <li>1. ยืนให้เห็นทั้งตัว ตั้งแต่หัวถึงเท้า</li>
          <li>2. กดเริ่ม → นับถอยหลัง 3 วินาที → ได้ยินสัญญาณ</li>
          <li>3. ยกมือทำวันทยหัตถ์ — เริ่มจับเวลา 4 วินาทีเมื่อศอกงอต่ำกว่า 90 องศา</li>
          <li>4. ทดสอบ {NUM_ATTEMPTS} ครั้ง แล้วสรุปความแม่นยำรวม</li>
        </ol>
        <p className="rounded-lg bg-[#07101b] px-3 py-2 text-xs text-[#91a0b2]">
          คะแนนเริ่ม 100% — ผิด 1 อย่างหัก 10% / ท่าโดยรวมไม่คล้ายต้นแบบหัก 10% / ไม่ทำท่าหรือใช้มือผิดข้าง = 0%
        </p>
        {latest?.ready ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#3ddc84]">
            <CheckCircle2 className="h-4 w-4" /> เห็นทั้งตัวแล้ว พร้อมทดสอบ
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#ffb02e]">
            <AlertTriangle className="h-4 w-4" /> {latest?.message ?? "ถอยให้เห็นทั้งตัว"}
          </p>
        )}
        <PrimaryButton onClick={() => send({ type: "start", num_attempts: NUM_ATTEMPTS })} icon={<Play className="h-5 w-5" />}>
          เริ่มทดสอบ
        </PrimaryButton>
      </div>
    );
  }

  if (state === "countdown" || state === "waiting" || state === "recording") {
    const text = {
      countdown: "เตรียมตัว...",
      waiting: "ฟังคำสั่ง: ตรงหน้า วันทยหัตถ์ ยกอก อึ้บ",
      recording: "กำลังจับเวลา — กรุณาค้างท่าไว้",
    }[state];
    return (
      <div className="flex flex-col gap-3">
        <AttemptBadge attempt={attempt} total={total} />
        <div className="flex items-center gap-3 rounded-xl border border-[#29415b] bg-[#07101b] p-4">
          <Hand className="h-6 w-6 shrink-0 text-[#ffd22e]" />
          <p className="text-base font-semibold text-white">{text}</p>
        </div>
        <p className="text-sm text-[#91a0b2]">ยืนตรง → ยกมือทำความเคารพ → สะบัดหน้าไปทางซ้าย → ค้างไว้</p>
        <div className="mt-auto">
          <SecondaryButton onClick={() => send({ type: "stop" })} icon={<Square className="h-4 w-4" />}>
            หยุดและสรุปผล
          </SecondaryButton>
        </div>
      </div>
    );
  }

  // ผลลัพธ์ / สรุป → แสดงกลางจอ (TestResultOverlay)
  return null;
}

// ---------- ผลการทดสอบ กลางจอ ----------
export function TestResultOverlay({
  latest,
  send,
  onClose,
}: {
  latest: ServerMessage | null;
  send: (command: Command) => void;
  onClose: () => void;
}) {
  const result = (
    latest?.state === "result" ? latest.result : latest?.results?.[latest.results.length - 1]
  ) as AttemptResult | undefined;

  // บันทึกผลลง database (หน้าสถิติ) ครั้งเดียวต่อผลการทดสอบ 1 ครั้ง — เฉพาะตอนล็อกอินอยู่
  const { user } = useAuth();
  const recordedRef = useRef(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">("saving");

  useEffect(() => {
    if (!result || !user || recordedRef.current) return;
    recordedRef.current = true;

    saveTestResult({
      exercise_slug: "salute",
      exercise_name: "ท่าเคารพตรงหน้า",
      accuracy: result.accuracy,
      similarity: result.similarity,
      passed: result.passed,
      errors: result.errors,
      body_visible: result.body_visible,
    }).then(({ ok }) => setSaveState(ok ? "saved" : "error"));
  }, [result, user]);

  const saveNote = !user ? (
    <p className="mt-4 text-sm text-[#91a0b2]">
      ผลนี้ไม่ถูกบันทึก —{" "}
      <Link href="/register?next=/training/salute" className="text-[#ffd22e] hover:underline">
        เข้าสู่ระบบ
      </Link>{" "}
      เพื่อเก็บผลไว้ในหน้าสถิติ
    </p>
  ) : (
    <p className={`mt-4 text-sm ${saveState === "error" ? "text-[#ff9b9b]" : "text-[#91a0b2]"}`}>
      {saveState === "saving" && "กำลังบันทึกผล..."}
      {saveState === "saved" && "บันทึกผลลงหน้าสถิติแล้ว"}
      {saveState === "error" && "บันทึกผลไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ Supabase"}
    </p>
  );

  const restart = () => send({ type: "start", num_attempts: NUM_ATTEMPTS });

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-20 backdrop-blur-[2px]">
      {!result ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#07101b]/85 p-8 text-center">
          <p className="text-xl font-bold">ยังไม่มีผลการทดสอบ</p>
          <ResultButtons onRestart={restart} onClose={onClose} />
        </div>
      ) : (
        <ResultCard result={result} onRestart={restart} onClose={onClose} saveNote={saveNote} />
      )}
    </div>
  );
}

function ResultCard({
  result,
  onRestart,
  onClose,
  saveNote,
}: {
  result: AttemptResult;
  onRestart: () => void;
  onClose: () => void;
  saveNote: React.ReactNode;
}) {
  // สถานะตัดจากคะแนนความแม่นยำ (ความคล้ายต้นแบบ − 10% ต่อเกณฑ์ที่ไม่ผ่าน)
  const grade = gradeOf(result.accuracy);
  const color = result.passed ? "#3ddc84" : "#ffb02e";

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#07101b]/85 p-6 text-center shadow-2xl backdrop-blur-md sm:p-8">
      <div className="flex flex-col items-center gap-1">
        {result.passed ? <Award className="h-16 w-16" style={{ color }} /> : <AlertTriangle className="h-14 w-14" style={{ color }} />}
        <p className="text-6xl font-extrabold sm:text-7xl" style={{ color }}>
          {result.passed ? "ผ่าน!" : "ไม่ผ่าน"}
        </p>
      </div>

      {/* คะแนนความแม่นยำ (ความคล้ายท่าต้นแบบ) ตัวใหญ่ + สถานะด้านล่าง */}
      <div className="mt-6 rounded-2xl bg-white/5 px-6 py-5">
        <p className="text-base text-[#91a0b2]">คะแนนความแม่นยำ</p>
        <p className="text-7xl leading-tight font-extrabold text-white sm:text-8xl">
          {result.accuracy.toFixed(1)}
          <span className="text-4xl text-[#91a0b2] sm:text-5xl">%</span>
        </p>
        <p className="mt-2 flex items-center justify-center gap-2 text-lg">
          <span className="text-[#91a0b2]">สถานะ</span>
          <span
            className="rounded-full border-2 px-4 py-1 text-xl font-extrabold"
            style={{ color: grade.color, borderColor: grade.color }}
          >
            {grade.label}
          </span>
        </p>
      </div>

      {result.errors.length > 0 ? (
        <div className="mt-5 text-left">
          <p className="mb-2 font-semibold text-[#ff9b9b]">ต้องแก้ไข</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.errors.map((e) => (
              <li key={e.code} className="rounded-xl border border-[#d03b3b]/50 bg-[#3a0d0d]/60 px-4 py-3">
                <p className="font-bold text-[#ff9b9b]">{e.name}</p>
                <p className="mt-0.5 text-sm text-[#f1d6d6]">→ {e.tip}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : result.passed ? (
        <p className="mt-5 flex items-center justify-center gap-2 font-semibold text-[#3ddc84]">
          <CheckCircle2 className="h-5 w-5" /> ท่าถูกต้องครบทุกข้อ
        </p>
      ) : (
        <p className="mt-5 text-[#d8e2ee]">ผ่านเกณฑ์ทุกข้อ แต่ท่าโดยรวมยังไม่เหมือนต้นแบบ — ลองทำให้ครบจังหวะอีกครั้ง</p>
      )}

      {!result.body_visible && (
        <p className="mt-3 text-sm text-[#ff9b9b]">มองไม่เห็นทั้งตัว (หัวหรือเท้าหลุดเฟรม) จึงได้ 0 คะแนน — ถอยให้เห็นทั้งตัวแล้วทดสอบใหม่</p>
      )}

      {saveNote}

      <div className="mt-6">
        <ResultButtons onRestart={onRestart} onClose={onClose} />
      </div>
    </div>
  );
}

function ResultButtons({ onRestart, onClose }: { onRestart: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-col justify-center gap-2 sm:flex-row">
      <button
        onClick={onRestart}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ffd22e] px-8 py-3.5 text-base font-extrabold text-[#111] transition duration-200 hover:scale-105 hover:brightness-105 active:scale-[0.99]"
      >
        <RotateCcw className="h-5 w-5" />
        ทดสอบอีกครั้ง
      </button>
      <button
        onClick={onClose}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-3.5 text-base font-semibold text-[#d8e2ee] transition duration-200 hover:scale-105 hover:bg-white/10"
      >
        <XCircle className="h-5 w-5" />
        ปิด
      </button>
    </div>
  );
}

function AttemptBadge({ attempt, total, label = "ครั้งที่" }: { attempt: number; total: number; label?: string }) {
  return (
    <p className="text-sm font-semibold text-[#91a0b2]">
      {label} {attempt}/{total}
    </p>
  );
}

function PrimaryButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ffd22e] px-5 py-3.5 text-base font-extrabold text-[#111] transition duration-200 hover:scale-[1.02] hover:brightness-105 active:scale-[0.99]"
    >
      {icon}
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#29415b] px-5 py-2.5 text-sm font-semibold text-[#d8e2ee] transition duration-200 hover:scale-[1.02] hover:bg-[#12345a]"
    >
      {icon}
      {children}
    </button>
  );
}
