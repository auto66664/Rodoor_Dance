"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/supabase/env";
import type { Profile } from "../lib/types";

export interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null });

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * ผู้ใช้ที่ล็อกอินอยู่ (อ่านจากเซิร์ฟเวอร์ใน layout แล้วส่งมา)
 * ล็อกอิน / ออกจากระบบ ในแท็บไหนก็ตาม → รีเฟรชข้อมูลจากเซิร์ฟเวอร์ใหม่
 */
export default function AuthProvider({ value, children }: { value: AuthState; children: React.ReactNode }) {
  const router = useRouter();
  const userId = value.user?.id ?? null;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event, session) => {
      const changed = (session?.user.id ?? null) !== userId;
      if (changed && (event === "SIGNED_IN" || event === "SIGNED_OUT")) router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
