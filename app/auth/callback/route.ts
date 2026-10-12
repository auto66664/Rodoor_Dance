import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../lib/supabase/server";

// ลิงก์ยืนยันอีเมลจาก Supabase → แลก code เป็น session แล้วพากลับเข้าเว็บ
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = forwardedHost
    ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`
    : request.nextUrl.origin;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}/register?error=confirm`);
}
