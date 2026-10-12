// ผลการทดสอบ → ตาราง test_results ใน Supabase
import type { TestResult, TestResultError } from "./types";

// รูปแบบที่หน้าสถิติใช้
export interface Activity {
  id: string;
  slug: string;
  exercise: string;
  timestamp: number; // ms
  similarity: number; // คะแนนความแม่นยำ (%)
  passed: boolean;
}

export function toActivity(row: Pick<TestResult, "id" | "exercise_slug" | "exercise_name" | "created_at" | "accuracy" | "passed">): Activity {
  return {
    id: row.id,
    slug: row.exercise_slug,
    exercise: row.exercise_name,
    timestamp: new Date(row.created_at).getTime(),
    similarity: Number(row.accuracy),
    passed: row.passed,
  };
}

// เกรด (สถานะ) จากคะแนนความแม่นยำ
export interface Grade {
  label: string;
  color: string;
}

export function gradeOf(accuracy: number): Grade {
  if (accuracy >= 80) return { label: "ดีเยี่ยม", color: "#3ddc84" };
  if (accuracy >= 70) return { label: "ดี", color: "#4db4ff" };
  if (accuracy >= 60) return { label: "พอใช้", color: "#fab219" };
  return { label: "ต้องปรับปรุง", color: "#d03b3b" };
}

export interface NewTestResult {
  exercise_slug: string;
  exercise_name: string;
  accuracy: number;
  similarity: number;
  passed: boolean;
  errors: TestResultError[];
  body_visible: boolean;
}

/** บันทึกผลทดสอบของผู้ใช้ที่ล็อกอินอยู่ (RLS อนุญาตเฉพาะของตัวเอง) */
export async function saveTestResult(result: NewTestResult): Promise<{ ok: boolean; message?: string }> {
  const { createClient } = await import("./supabase/client");
  const { error } = await createClient()
    .from("test_results")
    .insert({
      ...result,
      accuracy: Math.round(result.accuracy * 10) / 10,
      similarity: Math.round(result.similarity * 10) / 10,
    });

  return error ? { ok: false, message: error.message } : { ok: true };
}
