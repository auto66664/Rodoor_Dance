# ตั้งค่า Supabase สำหรับ รด.แดนซ์

## 1. ใส่ key ใน `rodoorweb/.env.local`
Supabase Dashboard → **Project Settings → API** (หรือ **Data API / API Keys**)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...   (anon / publishable key — ห้ามใช้ service_role)
```
แล้วรีสตาร์ต `npm run dev`

## 2. สร้างตาราง
Supabase Dashboard → **SQL Editor → New query** → วางทั้งไฟล์ `supabase/schema.sql` → **Run**
(รันซ้ำได้ ไม่ลบข้อมูลเดิม)

| ตาราง | เก็บอะไร |
|---|---|
| `profiles` | ข้อมูลผู้ใช้ (บทบาท นศท./ครูฝึก, ชื่อ, สถานศึกษา, กองร้อย ฯลฯ) — สร้างอัตโนมัติตอนสมัคร |
| `classrooms` | ห้องเรียนของครูฝึก (รหัส 6 หลักสร้างอัตโนมัติ) |
| `classroom_members` | นศท. ที่เข้าห้อง |
| `test_results` | ผลโหมดทดสอบ (ความแม่นยำ, ผ่าน/ไม่ผ่าน, จุดที่ผิด) |

สิทธิ์ (Row Level Security):
- ทุกคนเห็น/แก้ได้เฉพาะข้อมูลของตัวเอง
- ครูฝึกเห็นโปรไฟล์และผลทดสอบของ นศท. ที่อยู่ในห้องของตัวเองเท่านั้น
- เปลี่ยนบทบาทตัวเองไม่ได้ / นศท. สร้างห้องเรียนไม่ได้

## 3. ตั้งค่าการยืนยันอีเมล
Supabase Dashboard → **Authentication → URL Configuration**
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: เพิ่ม `http://localhost:3000/auth/callback`

ช่วงพัฒนาอยากสมัครแล้วเข้าใช้ได้ทันที (ไม่ต้องกดลิงก์ในอีเมล):
**Authentication → Sign In / Providers → Email → ปิด "Confirm email"**

> Supabase ฟรีส่งอีเมลยืนยันได้จำกัดต่อชั่วโมง ถ้าสมัครหลายบัญชีติดกันแนะนำให้ปิดการยืนยันอีเมลไว้ก่อน

## 4. ลองใช้งาน
1. สมัครบัญชี **ครูฝึก** 1 บัญชี และ **นักศึกษาวิชาทหาร** 1 บัญชี (`/register/login`)
2. ครูฝึก → **ห้องเรียน** → สร้างห้อง → ได้รหัส 6 หลัก
3. นศท. → **ห้องเรียน** → กรอกรหัส → เข้าห้อง
4. นศท. → ฝึกท่า → **ทดสอบ** → ผลบันทึกลง **สถิติ** อัตโนมัติ
5. ครูฝึก → เปิดห้อง → เห็นตารางผลการทดสอบของ นศท. ในห้อง
