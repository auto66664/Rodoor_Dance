# Deploy รด.แดนซ์

```
ผู้ใช้ ──► Vercel ............ เว็บ Next.js (rodoorweb/)
      ├──► Cloud Run/Railway .. AI server (rodoorweb/AI_Detection/ — Docker)
      └──► Supabase ........... บัญชี + ฐานข้อมูล (ใช้โปรเจกต์เดิม)
```

ลำดับ: **AI server ก่อน** (ได้ลิงก์ไปใส่ในเว็บ) → **เว็บ** → **เชื่อมโดเมน**

---

## 1. เอาโค้ดขึ้น GitHub

```powershell
cd D:\ArmyStudent_AI\rodoorweb
git add -A
git commit -m "รด.แดนซ์: เว็บ + AI + Supabase"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

- `.env.local` ไม่ขึ้น git (มี `.env*` ใน `.gitignore`) — key ไม่หลุด
- แนะนำตั้ง repo เป็น **Private**

---

## 2. AI server

ใช้ `AI_Detection/Dockerfile` (Python 3.10 + TensorFlow 2.15 + MediaPipe + โมเดล + ท่าต้นแบบ)

### ทางเลือก A: Google Cloud Run (มีโควตาฟรี ต้องผูกบัตร)
1. ติดตั้ง [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) แล้ว `gcloud init` (เลือก/สร้างโปรเจกต์)
2. deploy (รันในโฟลเดอร์ `AI_Detection`):
   ```powershell
   cd D:\ArmyStudent_AI\rodoorweb\AI_Detection
   gcloud run deploy salute-ai `
     --source . `
     --region asia-southeast1 `
     --allow-unauthenticated `
     --memory 2Gi --cpu 2 `
     --timeout 3600 `
     --set-env-vars "ALLOWED_ORIGINS=https://<ชื่อเว็บ>.vercel.app"
   ```
   - ครั้งแรกถามเปิด API / สร้าง Artifact Registry → ตอบ `Y`
   - เสร็จแล้วได้ **Service URL** `https://salute-ai-xxxxx.asia-southeast1.run.app`
3. เช็ก: เปิด `<Service URL>/api/health` → `{"status":"ok", ...}`

> ยังไม่รู้ชื่อเว็บ Vercel? deploy ไปก่อนแล้วค่อยแก้ ALLOWED_ORIGINS (ข้อ 4)
> ไม่มีคนใช้สักพัก Cloud Run จะปิดตัวเอง → คนแรกรอ ~20–40 วินาที (ไม่อยากรอ: `--min-instances 1` แต่เสียเงินรายเดือน)

### ทางเลือก B: Railway (ง่ายกว่า ~5 USD/เดือน)
1. railway.app → New Project → Deploy from GitHub repo
2. Settings → **Root Directory** = `AI_Detection` (ตรวจพบ Dockerfile เอง)
3. Variables: `ALLOWED_ORIGINS=https://<ชื่อเว็บ>.vercel.app`
4. Settings → Networking → **Generate Domain** → ได้ลิงก์ `https://xxx.up.railway.app`
5. แนะนำ RAM อย่างน้อย 2 GB

---

## 3. เว็บ → Vercel

1. vercel.com → **Add New → Project** → Import repo
2. **Root Directory**: ถ้า repo คือโฟลเดอร์ `rodoorweb` เองให้ปล่อยว่าง (`./`)
3. **Environment Variables**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ค่าเดียวกับใน `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ค่าเดียวกับใน `.env.local` |
   | `NEXT_PUBLIC_SALUTE_AI_URL` | ลิงก์ AI server จากข้อ 2 (ไม่มี `/` ท้าย) |

4. **Deploy** → ได้ `https://<ชื่อเว็บ>.vercel.app`

> แก้ Environment Variables ทีหลัง → ต้อง **Redeploy** (ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build)

---

## 4. เชื่อมทุกอย่าง

**AI server** — ใส่โดเมนเว็บจริงใน `ALLOWED_ORIGINS` (คั่นหลายโดเมนด้วย `,`)
- Cloud Run: `gcloud run services update salute-ai --region asia-southeast1 --update-env-vars "ALLOWED_ORIGINS=https://<ชื่อเว็บ>.vercel.app"`
- Railway: แก้ใน Variables
- ใช้ลิงก์ preview ของ Vercel ด้วย: `ALLOWED_ORIGIN_REGEX=https://<ชื่อเว็บ>-.*\.vercel\.app`

**Supabase** → Authentication → URL Configuration
- **Site URL**: `https://<ชื่อเว็บ>.vercel.app`
- **Redirect URLs**: เพิ่ม `https://<ชื่อเว็บ>.vercel.app/auth/callback` (เก็บของ localhost ไว้ใช้ตอนพัฒนา)

---

## 5. ทดสอบหลัง deploy
1. เปิดเว็บ → สมัคร / เข้าสู่ระบบ
2. ท่าเคารพตรงหน้า → **เริ่มฝึก** → อนุญาตกล้อง → เห็นโครงกระดูก + ได้ยินเสียง
3. **ทดสอบ** → ได้ผล → หน้า **สถิติ** มีรายการใหม่
4. ถ้าขึ้น "เชื่อมต่อ AI server ไม่ได้" → เช็ก `NEXT_PUBLIC_SALUTE_AI_URL` และ `ALLOWED_ORIGINS`

---

## อัปเดตหลัง deploy
| แก้อะไร | ทำ |
|---|---|
| โค้ดเว็บ | `git push` → Vercel deploy ใหม่เอง |
| โมเดล / กฎ / ท่าต้นแบบ (เทรนใหม่ใน notebook) | deploy AI server ใหม่ (ข้อ 2) |
| ข้อความ feedback | `generate_voices.py` → `git push` (ไฟล์เสียงอยู่ใน `public/`) + deploy AI server ใหม่ |
