"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/supabase/env";

// แปลข้อความ error ของ Supabase เป็นภาษาไทย
function loginErrorMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (/email not confirmed/i.test(message)) return "ยังไม่ได้ยืนยันอีเมล กรุณากดลิงก์ยืนยันในอีเมลก่อน";
  return "เข้าสู่ระบบไม่สำเร็จ: " + message;
}

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!isSupabaseConfigured) return setError("ยังไม่ได้ตั้งค่า Supabase (.env.local)");
    if (!email || !password) return setError("กรุณากรอกอีเมลและรหัสผ่าน");

    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      return setError(loginErrorMessage(error.message));
    }

    // กลับไปหน้าที่ตั้งใจจะเข้า (proxy ส่ง ?next= มา)
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#07101b] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image src="/images/logo.png" alt="รด. แดนซ์" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              เข้าสู่ระบบ <span className="text-[#ffd22e]">รด. แดนซ์</span>
            </p>
            <p className="mt-1 text-sm text-[#91a0b2]">เข้าสู่ระบบเพื่อเริ่มฝึกท่ากับ AI</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={login}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[#d8e2ee]">
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#29415b] bg-[#07101b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5c6b7e] focus:border-[#ffd22e] focus:ring-2 focus:ring-[#ffd22e]/30"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#d8e2ee]">
              รหัสผ่าน
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#29415b] bg-[#07101b] px-4 py-3 pr-16 text-sm text-white outline-none transition placeholder:text-[#5c6b7e] focus:border-[#ffd22e] focus:ring-2 focus:ring-[#ffd22e]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#ffd22e]"
              >
                {showPassword ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-[#b9c6d5]">
              <input type="checkbox" className="h-4 w-4 rounded border-[#29415b] accent-[#ffd22e]" />
              จดจำฉันไว้
            </label>
            <a href="#" className="font-medium text-[#ffd22e] hover:underline">
              ลืมรหัสผ่าน?
            </a>
          </div>

          {error && <p className="text-sm text-[#e66767]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-[#ffd22e] px-4 py-3 font-extrabold text-[#111] shadow-lg shadow-[#ffd22e]/20 transition duration-200 hover:scale-[1.02] hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#91a0b2]">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register/login" className="font-semibold text-[#ffd22e] hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  );
}
