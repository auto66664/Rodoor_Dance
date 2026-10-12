"use client";

import { useEffect, useRef } from "react";

// ไฟล์เสียงจาก AI_Detection/web_api/generate_voices.py (Botnoi Voice)
const SOUND_BASE = "/sounds/salute";
const NEXT_GAP_MS = 400; // พูดจบแล้ว เว้นก่อนประโยคถัดไป
const REPEAT_MS = 8000; // ยังผิดข้อเดิมอยู่ → เตือนซ้ำหลังพูดจบ 8 วินาที
const MAX_LINE_MS = 12000; // กันค้าง: ถ้าไม่ได้สัญญาณพูดจบ ถือว่าจบ
const TICK_MS = 200;
const INTRO_GRACE_MS = 5000; // หลังพูดคำสั่งจบ ให้เวลาผู้ฝึกทำท่าก่อนเริ่มเตือน feedback

// พูดได้ทันทีแม้อยู่ในช่วงให้เวลาทำท่า
const URGENT_KEYS = new Set(["passed", "no_body"]);

// พูดครั้งเดียวต่อรอบฝึก
const ONCE_KEYS = new Set(["command", "passed", "correct"]);

function versionOf(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export interface VoiceLine {
  key: string;
  text: string;
}

/**
 * ระบบเสียงโหมดฝึก — พูดทีละประโยค ไม่ซ้อนกัน
 * 1. `intro` (คำสั่ง "ตรงหน้า วันทยหัตถ์ ...") พูดก่อนเสมอ ครั้งเดียวต่อรอบ
 * 2. พูดคำสั่งจบ → ให้เวลาทำท่า INTRO_GRACE_MS ก่อนเริ่มเตือน feedback
 * 3. จากนั้นพูด `line` ล่าสุด (feedback ข้อสำคัญที่สุด / ผ่าน) เมื่อประโยคก่อนพูดจบแล้วเท่านั้น
 * 4. กำลังพูดข้อผิดอยู่ แต่ผู้ฝึกแก้แล้ว (feedback เปลี่ยน) → หยุดทันที แล้วพูดข้อใหม่ ไม่พูดเรื่องเก่าจนจบ
 * - มีไฟล์เสียง Botnoi → เล่นไฟล์ / ยังไม่มี → เบราว์เซอร์อ่าน text แทน
 * - `round` เปลี่ยน (กดฝึกอีกครั้ง) → เริ่มลำดับใหม่ พูดคำสั่งอีกรอบ
 */
export function useVoiceFeedback(line: VoiceLine | null, intro: VoiceLine | null, enabled: boolean, round: number) {
  const lineRef = useRef(line);
  const introRef = useRef(intro);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // key → เวอร์ชันไฟล์ (เปลี่ยนเมื่อสร้างเสียงใหม่ → เบราว์เซอร์โหลดไฟล์ใหม่ ไม่ใช้ของเก่าที่จำไว้)
  const availableRef = useRef<Map<string, string> | null>(null);
  const speakingRef = useRef(false);
  const currentRef = useRef<string | null>(null); // key ที่กำลังพูด
  const finishRef = useRef<(() => void) | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const lastEndRef = useRef(0);
  const introEndRef = useRef(0);
  const playedRef = useRef<Set<string>>(new Set());

  // เก็บประโยคล่าสุดไว้ให้ตัวจับเวลาอ่าน
  useEffect(() => {
    lineRef.current = line;
    introRef.current = intro;
  });

  // รอบใหม่ → พูดคำสั่งใหม่ตั้งแต่ต้น
  useEffect(() => {
    playedRef.current = new Set();
    lastKeyRef.current = null;
    introEndRef.current = 0;
  }, [round]);

  // รายชื่อไฟล์เสียงที่มี
  useEffect(() => {
    fetch(`${SOUND_BASE}/manifest.json`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .then((manifest: Record<string, { text?: string; voice?: string }>) => {
        availableRef.current = new Map(
          Object.entries(manifest).map(([key, entry]) => [key, versionOf(`${entry.text}|${entry.voice}`)])
        );
      })
      .catch(() => {
        availableRef.current = new Map();
      });

    // โหลดรายชื่อเสียงของเบราว์เซอร์ไว้ล่วงหน้า (Chrome โหลดแบบ async)
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    const stopAll = () => {
      audioRef.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      speakingRef.current = false;
    };

    if (!enabled) {
      stopAll();
      return;
    }

    let safety: ReturnType<typeof setTimeout> | null = null;

    const play = (voice: VoiceLine) => {
      speakingRef.current = true;
      currentRef.current = voice.key;

      const done = () => {
        if (!speakingRef.current) return;
        if (safety) clearTimeout(safety);
        speakingRef.current = false;
        currentRef.current = null;
        finishRef.current = null;
        lastEndRef.current = performance.now();
        lastKeyRef.current = voice.key;
        playedRef.current.add(voice.key);
        if (voice.key === introRef.current?.key) introEndRef.current = performance.now();
      };

      safety = setTimeout(done, MAX_LINE_MS);
      finishRef.current = done;

      const speakWithBrowser = () => {
        if (!("speechSynthesis" in window)) {
          done();
          return;
        }
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(voice.text);
        const thaiVoice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("th"));
        utterance.lang = "th-TH";
        if (thaiVoice) utterance.voice = thaiVoice;
        utterance.onend = done;
        utterance.onerror = done;
        synth.cancel();
        synth.speak(utterance);
      };

      if (!availableRef.current?.has(voice.key)) {
        speakWithBrowser();
        return;
      }

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.pause();
      audio.onended = done;
      audio.onerror = speakWithBrowser;
      audio.src = `${SOUND_BASE}/${voice.key}.mp3?v=${availableRef.current.get(voice.key)}`;
      audio.play().catch(speakWithBrowser);
    };

    const tick = () => {
      if (speakingRef.current) {
        // feedback ที่กำลังพูดไม่ใช่ปัจจุบันแล้ว (แก้ท่าแล้ว / ผ่านแล้ว) → ตัดทิ้ง
        const speaking = currentRef.current;
        const isIntro = speaking === introRef.current?.key;
        if (speaking && !isIntro && !ONCE_KEYS.has(speaking) && lineRef.current?.key !== speaking) {
          audioRef.current?.pause();
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          finishRef.current?.();
          lastEndRef.current = performance.now() - NEXT_GAP_MS; // พูดข้อใหม่ได้ทันที
        }
        return;
      }

      const introLine = introRef.current;
      const next = introLine && !playedRef.current.has(introLine.key) ? introLine : lineRef.current;

      if (!next) return;
      if (ONCE_KEYS.has(next.key) && playedRef.current.has(next.key)) return;

      const inGrace = performance.now() - introEndRef.current < INTRO_GRACE_MS;
      if (next !== introLine && inGrace && !URGENT_KEYS.has(next.key)) return;

      const gap = next.key === lastKeyRef.current ? REPEAT_MS : NEXT_GAP_MS;
      if (performance.now() - lastEndRef.current < gap) return;

      play(next);
    };

    const timer = setInterval(tick, TICK_MS);

    return () => {
      clearInterval(timer);
      if (safety) clearTimeout(safety);
      stopAll();
    };
  }, [enabled]);
}
