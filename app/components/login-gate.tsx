"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, UserPlus, X } from "lucide-react";
import { useAuth } from "./auth-provider";

// เรียกก่อนใช้งานฟีเจอร์: ล็อกอินแล้ว → true / ยังไม่ล็อกอิน → เปิดหน้าต่างให้ไปเข้าสู่ระบบ แล้วคืน false
type Gate = (next?: string) => boolean;

const LoginGateContext = createContext<Gate>(() => true);

export function useLoginGate() {
  return useContext(LoginGateContext);
}

export default function LoginGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [next, setNext] = useState<string | null>(null);

  const gate = useCallback<Gate>(
    (target) => {
      if (user) return true;
      setNext(target ?? window.location.pathname);
      return false;
    },
    [user]
  );

  // ปิดด้วย Esc
  useEffect(() => {
    if (next === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNext(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);

  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <LoginGateContext.Provider value={gate}>
      {children}

      {next !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-gate-title"
          onClick={() => setNext(null)}
          className="fixed inset-0 z-90 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-[#29415b] bg-[#0c1927] p-7 text-center shadow-2xl"
          >
            <button
              onClick={() => setNext(null)}
              aria-label="ปิด"
              className="absolute top-3 right-3 cursor-pointer rounded-lg p-1.5 text-[#91a0b2] hover:bg-[#12345a] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd22e]/15 text-[#ffd22e]">
              <LogIn className="h-7 w-7" />
            </span>
            <p id="login-gate-title" className="mt-4 text-xl font-bold text-white">
              กรุณาเข้าสู่ระบบก่อน
            </p>
            <p className="mt-1.5 text-sm text-[#91a0b2]">เข้าสู่ระบบเพื่อฝึกท่า บันทึกผล และเข้าห้องเรียน</p>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/register${query}`}
                onClick={() => setNext(null)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#ffd22e] px-4 py-3 font-extrabold text-[#111] transition duration-200 hover:scale-[1.02] hover:brightness-105"
              >
                <LogIn className="h-5 w-5" />
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register/login"
                onClick={() => setNext(null)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#29415b] px-4 py-3 text-sm font-semibold text-[#d8e2ee] transition duration-200 hover:scale-[1.02] hover:bg-[#12345a]"
              >
                <UserPlus className="h-4 w-4" />
                ยังไม่มีบัญชี? สมัครสมาชิก
              </Link>
            </div>
          </div>
        </div>
      )}
    </LoginGateContext.Provider>
  );
}

// ลิงก์ที่ต้องล็อกอินก่อน (ยังไม่ล็อกอิน → เปิดหน้าต่างแทนการเปลี่ยนหน้า)
export function GatedLink({
  href,
  onClick,
  ...props
}: React.ComponentProps<typeof Link> & { href: string }) {
  const gate = useLoginGate();

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!gate(href)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
}
