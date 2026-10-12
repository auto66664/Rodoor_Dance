import DashboardStats from "../components/dashboard-stats";
import RecentActivity from "../components/recent-activity";
import { toActivity } from "../lib/activity-store";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "../lib/supabase/server";

// ผลทดสอบของผู้ใช้ที่ล็อกอินอยู่ (proxy.ts กันหน้านี้ไว้แล้ว ต้องล็อกอินก่อน)
export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/register?next=/dashboard");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("test_results")
    .select("id, exercise_slug, exercise_name, created_at, accuracy, passed")
    .eq("user_id", current.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  const activities = (data ?? []).map(toActivity);

  return (
    <main className="min-h-screen bg-[#07101b] px-[5%] py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-[32px] font-bold text-white">แดชบอร์ดการฝึก</h1>
        <p className="mt-1 text-[#91a0b2]">ภาพรวมความก้าวหน้าและสถิติการฝึกของคุณ</p>

        {error && (
          <p className="mt-4 rounded-xl border border-[#d03b3b]/50 bg-[#3a0d0d]/60 px-4 py-3 text-sm text-[#ffb4b4]">
            โหลดข้อมูลไม่สำเร็จ: {error.message}
          </p>
        )}

        <DashboardStats activities={activities} />

        <section className="mt-6 rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-6">
          <h2 className="text-lg font-semibold text-white">กิจกรรมล่าสุด</h2>
          <RecentActivity activities={activities} />
        </section>
      </div>
    </main>
  );
}
