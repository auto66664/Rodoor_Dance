// โครงสร้างข้อมูลในฐานข้อมูล (ตรงกับ supabase/schema.sql)

export type Role = "student" | "trainer";

export interface Profile {
  id: string;
  role: Role;
  email: string | null;
  rank: string | null;
  first_name: string;
  last_name: string;
  school: string | null;
  year: number | null;
  company: string | null;
  platoon: string | null;
  squad: string | null;
  order_no: string | null;
  affiliation: string | null;
  avatar_url: string | null; // รูปโปรไฟล์ (Supabase Storage)
  created_at: string;
}

export interface Classroom {
  id: string;
  code: string;
  name: string;
  trainer_id: string;
  trainer_name: string;
  date: string; // YYYY-MM-DD
  exercises: string[];
  note: string;
  created_at: string;
}

export interface TestResultError {
  code: string;
  name: string;
  tip: string;
}

export interface TestResult {
  id: string;
  user_id: string;
  exercise_slug: string;
  exercise_name: string;
  accuracy: number;
  similarity: number | null;
  passed: boolean;
  errors: TestResultError[];
  body_visible: boolean;
  created_at: string;
}

export function displayName(profile: Pick<Profile, "rank" | "first_name" | "last_name"> | null | undefined) {
  if (!profile) return "";
  return [profile.rank, profile.first_name, profile.last_name].filter(Boolean).join(" ");
}

// ชื่อที่แสดงในแถบเมนู: "นศท. ชื่อ นามสกุล" / "ยศ ชื่อ นามสกุล"
export function formalName(profile: Pick<Profile, "role" | "rank" | "first_name" | "last_name"> | null | undefined) {
  if (!profile) return "";
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  if (!name) return "";
  const prefix = profile.role === "trainer" ? profile.rank : "นศท.";
  return [prefix, name].filter(Boolean).join(" ");
}
