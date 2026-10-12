"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Flame, Gauge, ListChecks, Loader2, Pencil, Trash2, X } from "lucide-react";
import Avatar from "./avatar";
import StatTile from "./stat-tile";
import { useToast } from "./toast-provider";
import { computeStats } from "./dashboard-stats";
import type { Activity } from "../lib/activity-store";
import { createClient } from "../lib/supabase/client";
import { AVATAR_ACCEPT, removeAvatar, uploadAvatar } from "../lib/avatar";
import { displayName, type Profile } from "../lib/types";

const inputClass =
  "w-full rounded-xl border border-[#29415b] bg-[#07101b] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-[#5c6b7e] focus:border-[#ffd22e] focus:ring-2 focus:ring-[#ffd22e]/30";

type Field = { key: keyof Profile; label: string; type?: "year" };

// ช่องข้อมูลของแต่ละบทบาท (ตรงกับหน้าสมัครสมาชิก)
const FIELDS: Record<Profile["role"], Field[]> = {
  student: [
    { key: "first_name", label: "ชื่อ" },
    { key: "last_name", label: "นามสกุล" },
    { key: "school", label: "สถานศึกษา" },
    { key: "year", label: "ชั้นปีที่", type: "year" },
    { key: "company", label: "กองร้อย" },
    { key: "platoon", label: "หมวด" },
    { key: "squad", label: "หมู่" },
    { key: "order_no", label: "ลำดับที่" },
  ],
  trainer: [
    { key: "rank", label: "คำนำหน้า (ยศ)" },
    { key: "first_name", label: "ชื่อ" },
    { key: "last_name", label: "นามสกุล" },
    { key: "school", label: "หน่วยฝึก" },
    { key: "affiliation", label: "สังกัด" },
  ],
};

export default function ProfileView({
  profile,
  email,
  activities,
}: {
  profile: Profile;
  email: string;
  activities: Activity[];
}) {
  const router = useRouter();
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => computeStats(activities), [activities]);
  const fields = FIELDS[profile.role];
  const subtitle =
    profile.role === "trainer" ? "ครูฝึก" : `นักศึกษาวิชาทหาร${profile.year ? ` ชั้นปีที่ ${profile.year}` : ""}`;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const update: Record<string, string | number | null> = {};

    for (const field of fields) {
      const value = String(form.get(field.key) ?? "").trim();
      update[field.key] = field.type === "year" ? (value ? Number(value) : null) : value || null;
    }

    if (!update.first_name || !update.last_name) return setError("กรุณากรอกชื่อและนามสกุล");

    // ชื่อ-นามสกุล ไม่เป็น null ในฐานข้อมูล
    update.first_name = String(update.first_name);
    update.last_name = String(update.last_name);

    setSaving(true);
    setError("");
    const { error } = await createClient().from("profiles").update(update).eq("id", profile.id);
    setSaving(false);

    if (error) return setError("บันทึกไม่สำเร็จ: " + error.message);

    setEditing(false);
    showToast("บันทึกโปรไฟล์แล้ว");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#07101b] px-[5%] py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[32px] font-bold text-white">โปรไฟล์</h1>
        <p className="mt-1 text-[#91a0b2]">ข้อมูลส่วนตัวและความก้าวหน้าในการฝึก</p>

        <section className="mt-6 rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <AvatarEditor profile={profile} />
            <div className="flex-1">
              <p className="text-xl font-bold text-white">{displayName(profile) || "ยังไม่ได้ตั้งชื่อ"}</p>
              <p className="text-sm text-[#ffd22e]">{subtitle}</p>
              <p className="mt-1 text-sm text-[#91a0b2]">{email}</p>
            </div>
            <button
              onClick={() => {
                setEditing((v) => !v);
                setError("");
              }}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[#29415b] bg-[#07101b] px-4 py-2 text-sm font-medium text-[#d8e2ee] transition duration-200 hover:scale-105 hover:bg-[#101f30]"
            >
              {editing ? <X className="h-4 w-4" strokeWidth={2} /> : <Pencil className="h-4 w-4" strokeWidth={2} />}
              {editing ? "ยกเลิก" : "แก้ไขโปรไฟล์"}
            </button>
          </div>

          {editing ? (
            <form onSubmit={save} className="mt-6 border-t border-[#1b2a3c] pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label htmlFor={field.key} className="text-xs text-[#91a0b2]">
                      {field.label}
                    </label>
                    {field.type === "year" ? (
                      <select
                        id={field.key}
                        name={field.key}
                        defaultValue={profile.year ?? ""}
                        className={inputClass}
                      >
                        <option value="">-</option>
                        {[1, 2, 3, 4, 5].map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={field.key}
                        name={field.key}
                        defaultValue={String(profile[field.key] ?? "")}
                        className={inputClass}
                      />
                    )}
                  </div>
                ))}
              </div>
              {error && <p className="mt-4 text-sm text-[#e66767]">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="mt-5 w-full cursor-pointer rounded-xl bg-[#ffd22e] px-4 py-3 font-extrabold text-[#111] transition duration-200 hover:scale-[1.02] disabled:opacity-60 sm:w-auto sm:px-8"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
              </button>
            </form>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#1b2a3c] pt-6 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key}>
                  <p className="text-xs text-[#5c6b7e]">{field.label}</p>
                  <p className="mt-0.5 text-sm text-[#d8e2ee]">{String(profile[field.key] ?? "") || "-"}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {profile.role === "student" && (
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile icon={ListChecks} label="ทดสอบทั้งหมด" value={`${activities.length} ครั้ง`} hint="ทุกท่ารวมกัน" />
            <StatTile
              icon={Gauge}
              label="ความแม่นยำเฉลี่ย"
              value={stats.average === null ? "-" : `${Math.round(stats.average)}%`}
              hint="7 วันล่าสุด"
            />
            <StatTile icon={Flame} label="ฝึกต่อเนื่อง" value={`${stats.streak} วัน`} hint="อย่าให้ขาดนะ!" />
          </section>
        )}

        <Link
          href={profile.role === "trainer" ? "/classroom" : "/dashboard"}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#ffd22e] px-4 py-3 font-extrabold text-[#111] shadow-lg shadow-[#ffd22e]/20 transition duration-200 hover:scale-105 hover:brightness-105 sm:w-auto"
        >
          {profile.role === "trainer" ? "ไปหน้าห้องเรียนของฉัน →" : "ดูแดชบอร์ดการฝึกทั้งหมด →"}
        </Link>
      </div>
    </main>
  );
}

// รูปโปรไฟล์: กดที่รูปเพื่อเปลี่ยน / ลบรูปเพื่อกลับไปใช้รูปเริ่มต้น
function AvatarEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const showToast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      await uploadAvatar(profile.id, file);
      showToast("เปลี่ยนรูปโปรไฟล์แล้ว");
      router.refresh();
    } catch (err) {
      showToast(`เปลี่ยนรูปไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!confirm("ลบรูปโปรไฟล์?")) return;
    setBusy(true);
    try {
      await removeAvatar(profile.id);
      showToast("ลบรูปโปรไฟล์แล้ว");
      router.refresh();
    } catch (err) {
      showToast(`ลบรูปไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="เปลี่ยนรูปโปรไฟล์"
        className="group relative cursor-pointer rounded-full disabled:cursor-wait"
      >
        <Avatar url={profile.avatar_url} alt={displayName(profile)} size={88} className="border-2 border-[#29415b]" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition group-hover:opacity-100">
          <Camera className="h-6 w-6 text-white" />
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept={AVATAR_ACCEPT} onChange={onFile} className="hidden" />
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="cursor-pointer text-[#ffd22e] hover:underline disabled:opacity-50"
        >
          เปลี่ยนรูป
        </button>
        {profile.avatar_url && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label="ลบรูปโปรไฟล์"
            className="flex cursor-pointer items-center text-[#91a0b2] hover:text-[#d03b3b] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
