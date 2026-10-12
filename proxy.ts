import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./app/lib/supabase/env";

// หน้าที่ต้องเข้าสู่ระบบก่อน
const PROTECTED = ["/dashboard", "/profile", "/classroom"];

// รีเฟรช session ของ Supabase ทุก request (token หมดอายุ → ต่ออายุแล้วเขียน cookie กลับ)
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // ห้ามมีโค้ดอื่นคั่นระหว่างสร้าง client กับ getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // ไม่รันกับไฟล์ static / รูป / เสียง
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|images/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|json)$).*)",
  ],
};
