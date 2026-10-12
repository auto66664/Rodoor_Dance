import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";
import type { Profile } from "../types";

// Supabase client ฝั่งเซิร์ฟเวอร์ (Server Components / Server Actions / Route Handlers)
// ต้องสร้างใหม่ทุก request ห้ามแชร์ข้าม request
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // เรียกจาก Server Component ตั้ง cookie ไม่ได้ — proxy.ts รีเฟรช session ให้แล้ว
        }
      },
    },
  });
}

// ผู้ใช้ที่ล็อกอินอยู่ + โปรไฟล์ (null = ยังไม่ล็อกอิน / ยังไม่ตั้งค่า Supabase)
export async function getCurrentUser(): Promise<{ id: string; email: string; profile: Profile | null } | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  // บัญชีที่ไม่มีโปรไฟล์ (สมัครก่อนสร้างตาราง) → สร้างจากข้อมูลตอนสมัคร
  if (!profile) {
    const { error } = await supabase.rpc("ensure_profile");
    if (!error) {
      ({ data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle());
    }
  }

  return { id: user.id, email: user.email ?? "", profile: (profile as Profile | null) ?? null };
}
