import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Supabase client ฝั่งเบราว์เซอร์ (Client Components) — สร้างครั้งเดียวแล้วใช้ซ้ำ
let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
