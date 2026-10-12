"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import RoleTabs, { type Role } from "../../components/role-tabs";
import { createClient } from "../../lib/supabase/client";
import { isSupabaseConfigured } from "../../lib/supabase/env";

function signUpErrorMessage(message: string) {
  if (/already registered|already been registered/i.test(message)) return "อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ";
  if (/password/i.test(message)) return "รหัสผ่านไม่ผ่านเงื่อนไข: " + message;
  if (/rate limit/i.test(message)) return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  return "สมัครสมาชิกไม่สำเร็จ: " + message;
}

export default function SignUpPage() {
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const router = useRouter();

  const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();

    const email = get("email");
    const password = String(form.get("password") ?? "");

    if (!isSupabaseConfigured) return setError("ยังไม่ได้ตั้งค่า Supabase (.env.local)");
    if (!get("firstName") || !get("lastName")) return setError("กรุณากรอกชื่อและนามสกุล");
    if (!email) return setError("กรุณากรอกอีเมล");
    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (password !== String(form.get("confirmPassword") ?? "")) return setError("ยืนยันรหัสผ่านไม่ตรงกัน");
    if (!form.get("terms")) return setError("กรุณายอมรับเงื่อนไขการใช้งาน");

    // ข้อมูลโปรไฟล์ → trigger ใน Supabase สร้างแถวในตาราง profiles ให้
    const profile =
      role === "student"
        ? {
            year: get("year"),
            company: get("company"),
            platoon: get("platoon"),
            squad: get("squad"),
            order_no: get("order"),
          }
        : { rank: get("rank"), affiliation: get("affiliation") };

    setLoading(true);
    setError("");

    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { role, first_name: get("firstName"), last_name: get("lastName"), school: get("school"), ...profile },
      },
    });

    setLoading(false);

    if (error) return setError(signUpErrorMessage(error.message));

    // ปิดการยืนยันอีเมลใน Supabase → ได้ session ทันที / เปิดไว้ → ต้องกดลิงก์ในอีเมลก่อน
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      setSentTo(email);
    }
  };

  if (sentTo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#07101b] px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-8 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto h-14 w-14 text-[#3ddc84]" />
          <p className="mt-4 text-2xl font-bold text-white">สมัครสมาชิกสำเร็จ</p>
          <p className="mt-2 text-sm text-[#91a0b2]">
            ส่งลิงก์ยืนยันไปที่ <span className="text-[#ffd22e]">{sentTo}</span> แล้ว กดลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-xl bg-[#ffd22e] px-6 py-3 font-extrabold text-[#111] transition duration-200 hover:scale-105"
          >
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </main>
    );
  }

  const schoolLabel = role === "student" ? "สถานศึกษา" : "หน่วยฝึก";
  const schoolPlaceholder = role === "student" ? "โรงเรียน..." : "ศฝ. ...";

  const inputClass =
    "w-full rounded-xl border border-[#29415b] bg-[#07101b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5c6b7e] focus:border-[#ffd22e] focus:ring-2 focus:ring-[#ffd22e]/30";
  const labelClass = "text-sm font-medium text-[#d8e2ee]";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#07101b] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image src="/images/logo.png" alt="รด. แดนซ์" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              สมัครสมาชิก <span className="text-[#ffd22e]">รด. แดนซ์</span>
            </p>
            <p className="mt-1 text-sm text-[#91a0b2]">สร้างบัญชีใหม่เพื่อเริ่มฝึกท่าฝึกกับ AI</p>
          </div>
        </div>

        <RoleTabs value={role} onChange={setRole} />

        <form className="mt-6 space-y-4" onSubmit={signUp}>
          <div className={`grid gap-3 ${role === "trainer" ? "grid-cols-3" : "grid-cols-2"}`}>
            {role === "trainer" && (
              <div className="space-y-1.5">
                <label htmlFor="rank" className={labelClass}>
                  คำนำหน้า (ยศ)
                </label>
                <input id="rank" name="rank" type="text" placeholder="เช่น ร.ต." className={inputClass} />
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="firstName" className={labelClass}>
                ชื่อ
              </label>
              <input id="firstName" name="firstName" type="text" placeholder="สมชาย" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lastName" className={labelClass}>
                นามสกุล
              </label>
              <input id="lastName" name="lastName" type="text" placeholder="ใจดี" className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClass}>
              อีเมล
            </label>
            <input id="email" name="email" type="email" placeholder="you@example.com" className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="school" className={labelClass}>
              {schoolLabel}
            </label>
            <input id="school" name="school" type="text" placeholder={schoolPlaceholder} className={inputClass} />
          </div>

          {role === "student" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="space-y-1.5">
                <label htmlFor="year" className={labelClass}>
                  ชั้นปีที่
                </label>
                <select id="year" name="year" defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    เลือก
                  </option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="company" className={labelClass}>
                  กองร้อย
                </label>
                <input id="company" name="company" type="text" placeholder="เช่น 2205" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="platoon" className={labelClass}>
                  หมวด
                </label>
                <input id="platoon" name="platoon" type="text" placeholder="เช่น 2" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="squad" className={labelClass}>
                  หมู่
                </label>
                <input id="squad" name="squad" type="text" placeholder="เช่น 3" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="order" className={labelClass}>
                  ลำดับที่
                </label>
                <input id="order" name="order" type="text" placeholder="เช่น 12" className={inputClass} />
              </div>
            </div>
          )}

          {role === "trainer" && (
            <div className="space-y-1.5">
              <label htmlFor="affiliation" className={labelClass}>
                สังกัด
              </label>
              <input id="affiliation" name="affiliation" type="text" placeholder="เช่น มทบ.11" className={inputClass} />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#d8e2ee]">
              รหัสผ่าน
            </label>
            <div className="relative">
              <input
                id="password" name="password"
                type={showPassword ? "text" : "password"}
                placeholder="อย่างน้อย 8 ตัวอักษร"
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

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-[#d8e2ee]">
              ยืนยันรหัสผ่าน
            </label>
            <div className="relative">
              <input
                id="confirmPassword" name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#29415b] bg-[#07101b] px-4 py-3 pr-16 text-sm text-white outline-none transition placeholder:text-[#5c6b7e] focus:border-[#ffd22e] focus:ring-2 focus:ring-[#ffd22e]/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#ffd22e]"
              >
                {showConfirm ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-[#b9c6d5]">
            <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 rounded border-[#29415b] accent-[#ffd22e]" />
            <span>
              ฉันยอมรับ{" "}
              <a href="#" className="font-medium text-[#ffd22e] hover:underline">
                เงื่อนไขการใช้งาน
              </a>{" "}
              และ{" "}
              <a href="#" className="font-medium text-[#ffd22e] hover:underline">
                นโยบายความเป็นส่วนตัว
              </a>
            </span>
          </label>

          {error && <p className="text-sm text-[#e66767]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-[#ffd22e] px-4 py-3 font-extrabold text-[#111] shadow-lg shadow-[#ffd22e]/20 transition duration-200 hover:scale-[1.02] hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#91a0b2]">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/register" className="font-semibold text-[#ffd22e] hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
