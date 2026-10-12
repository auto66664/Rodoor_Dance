// ล็อกอินแล้วแต่ไม่มีโปรไฟล์ในฐานข้อมูล (ยังไม่ได้รัน supabase/schema.sql เวอร์ชันล่าสุด)
export default function ProfileMissing() {
  return (
    <main className="min-h-screen bg-[#07101b] px-[5%] py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-[#d03b3b]/40 bg-[#0c1927] p-8 text-center">
        <p className="text-xl font-bold text-white">ไม่พบข้อมูลโปรไฟล์ของบัญชีนี้</p>
        <p className="mt-2 text-sm text-[#91a0b2]">
          ให้ผู้ดูแลระบบรันไฟล์ <code className="text-[#ffd22e]">supabase/schema.sql</code> เวอร์ชันล่าสุดใน Supabase SQL Editor
          แล้วรีเฟรชหน้านี้อีกครั้ง
        </p>
      </div>
    </main>
  );
}
