"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Copy, DoorOpen, Plus, Trash2, Users } from "lucide-react";
import { useToast } from "../toast-provider";
import { exercises } from "../../data/exercises";
import { createClassroom, deleteClassroom, formatThaiDate, joinClassroom, todayISO } from "../../lib/classrooms";
import type { Classroom, Role } from "../../lib/types";

export type RoomRow = Classroom & { memberCount: number | null };

const inputClass =
  "w-full rounded-xl border border-[#29415b] bg-[#07101b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5c6b7e] focus:border-[#ffd22e] focus:ring-2 focus:ring-[#ffd22e]/30";
const labelClass = "text-sm font-medium text-[#d8e2ee]";
const cardClass = "rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-6";

export default function ClassroomClient({
  role,
  rooms,
  trainerName,
}: {
  role: Role;
  rooms: RoomRow[];
  trainerName: string;
}) {
  return (
    <main className="min-h-screen bg-[#07101b] px-[5%] py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[32px] font-bold text-white">ห้องเรียน</h1>
        <p className="mt-1 text-[#91a0b2]">
          {role === "student"
            ? "กรอกรหัสห้องเรียนที่ได้รับจากครูฝึกเพื่อดูท่าที่ต้องฝึกวันนี้"
            : "สร้างห้องเรียน เลือกท่าที่จะฝึก และดูผลการทดสอบของนักศึกษา"}
        </p>

        <div className="mt-6">
          {role === "student" ? <StudentClassrooms rooms={rooms} /> : <TrainerClassrooms rooms={rooms} trainerName={trainerName} />}
        </div>
      </div>
    </main>
  );
}

// =====================================================================
// นักศึกษา
// =====================================================================
function StudentClassrooms({ rooms }: { rooms: RoomRow[] }) {
  return (
    <div className="space-y-6">
      <JoinClassroom />

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-white">ห้องเรียนที่เข้าแล้ว</h2>
        {rooms.length === 0 ? (
          <p className="mt-3 text-sm text-[#5c6b7e]">ยังไม่ได้เข้าห้องเรียน</p>
        ) : (
          <div className="mt-4 divide-y divide-[#1b2a3c]">
            {rooms.map((room) => (
              <ClassroomRow key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function JoinClassroom() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const roomCode = await joinClassroom(code);
      if (!roomCode) {
        setError("ไม่พบห้องเรียนรหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง");
        setLoading(false);
        return;
      }
      router.push(`/classroom/${roomCode}`);
      router.refresh();
    } catch (err) {
      setError(`เข้าห้องเรียนไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
      setLoading(false);
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex items-center gap-2 text-white">
        <DoorOpen className="h-5 w-5 text-[#ffd22e]" strokeWidth={2} />
        <h2 className="text-lg font-semibold">เข้าห้องเรียน</h2>
      </div>

      <form onSubmit={join} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            setError("");
          }}
          maxLength={6}
          placeholder="รหัส 6 หลัก เช่น K7P2QX"
          className={`${inputClass} text-center font-mono text-lg tracking-[0.4em] sm:text-left`}
        />
        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className="shrink-0 cursor-pointer rounded-xl bg-[#ffd22e] px-6 py-3 font-extrabold text-[#111] transition duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {loading ? "กำลังเข้า..." : "เข้าห้องเรียน"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-[#e66767]">{error}</p>}
    </section>
  );
}

// =====================================================================
// ครูฝึก
// =====================================================================
function TrainerClassrooms({ rooms, trainerName }: { rooms: RoomRow[]; trainerName: string }) {
  const [created, setCreated] = useState<Classroom | null>(null);

  return (
    <div className="space-y-6">
      {created ? (
        <CreatedNotice classroom={created} onNew={() => setCreated(null)} />
      ) : (
        <CreateClassroomForm onCreated={setCreated} trainerName={trainerName} />
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-white">ห้องเรียนของฉัน</h2>
        {rooms.length === 0 ? (
          <p className="mt-3 text-sm text-[#5c6b7e]">ยังไม่มีห้องเรียน</p>
        ) : (
          <div className="mt-4 divide-y divide-[#1b2a3c]">
            {rooms.map((room) => (
              <ClassroomRow key={room.id} room={room} canDelete />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CreateClassroomForm({ onCreated, trainerName }: { onCreated: (room: Classroom) => void; trainerName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [trainer, setTrainer] = useState(trainerName);
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState<string[]>(["salute"]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = (slug: string) => {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณาตั้งชื่อห้องเรียน");
    if (selected.length === 0) return setError("กรุณาเลือกท่าฝึกอย่างน้อย 1 ท่า");

    setLoading(true);
    try {
      const ordered = exercises.filter((ex) => selected.includes(ex.slug)).map((ex) => ex.slug);
      const room = await createClassroom({
        name: name.trim(),
        trainer_name: trainer.trim(),
        date,
        exercises: ordered,
        note: note.trim(),
      });
      onCreated(room);
      router.refresh();
    } catch (err) {
      setError(`สร้างห้องเรียนไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex items-center gap-2 text-white">
        <Plus className="h-5 w-5 text-[#ffd22e]" strokeWidth={2} />
        <h2 className="text-lg font-semibold">สร้างห้องเรียน</h2>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="roomName" className={labelClass}>
            ชื่อห้องเรียน
          </label>
          <input
            id="roomName"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="เช่น กองร้อย 2205 หมวด 2"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="trainer" className={labelClass}>
              ครูฝึกผู้สอน
            </label>
            <input id="trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="date" className={labelClass}>
              วันที่ฝึก
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} scheme-dark`}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={labelClass}>ท่าที่จะฝึกวันนี้</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {exercises.map((ex) => {
              const isOn = selected.includes(ex.slug);
              return (
                <button
                  key={ex.slug}
                  type="button"
                  onClick={() => toggle(ex.slug)}
                  aria-pressed={isOn}
                  className={`relative cursor-pointer overflow-hidden rounded-xl border-2 text-left transition duration-200 hover:scale-105 ${
                    isOn ? "border-[#ffd22e]" : "border-[#29415b] opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className={`relative h-20 ${ex.gradientClass}`}>
                    <Image src={ex.image} alt="" fill sizes="200px" className="object-cover" />
                  </div>
                  <p className="bg-[#07101b] px-3 py-2 text-sm font-medium text-white">{ex.name}</p>
                  {isOn && (
                    <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#ffd22e] text-[#111]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="note" className={labelClass}>
            หมายเหตุถึงนักศึกษา (ไม่บังคับ)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="เช่น แต่งกายชุดฝึก มาก่อนเวลา 10 นาที"
            className={`${inputClass} resize-none`}
          />
        </div>

        {error && <p className="text-sm text-[#e66767]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer rounded-xl bg-[#ffd22e] px-4 py-3 font-extrabold text-[#111] shadow-lg shadow-[#ffd22e]/20 transition duration-200 hover:scale-[1.02] hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "กำลังสร้าง..." : "สร้างห้องเรียน"}
        </button>
      </form>
    </section>
  );
}

function CreatedNotice({ classroom, onNew }: { classroom: Classroom; onNew: () => void }) {
  return (
    <section className={`${cardClass} border-[#ffd22e]/40 text-center`}>
      <p className="text-sm text-[#91a0b2]">สร้างห้อง “{classroom.name}” แล้ว ให้นักศึกษากรอกรหัสนี้ที่หน้าห้องเรียน</p>
      <p className="mt-3 font-mono text-5xl font-bold tracking-[0.3em] text-[#ffd22e]">{classroom.code}</p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <CopyCodeButton code={classroom.code} />
        <Link
          href={`/classroom/${classroom.code}`}
          className="rounded-xl border border-[#29415b] px-5 py-2.5 text-sm font-semibold text-[#d8e2ee] transition duration-200 hover:scale-105 hover:bg-[#12345a]"
        >
          ดูหน้าห้องเรียน
        </Link>
        <button
          onClick={onNew}
          className="cursor-pointer rounded-xl border border-[#29415b] px-5 py-2.5 text-sm font-semibold text-[#d8e2ee] transition duration-200 hover:scale-105 hover:bg-[#12345a]"
        >
          สร้างห้องใหม่
        </button>
      </div>
    </section>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const showToast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`คัดลอกรหัส ${code} แล้ว`);
    } catch {
      showToast(`รหัสห้องเรียน: ${code}`);
    }
  };

  return (
    <button
      onClick={copy}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ffd22e] px-5 py-2.5 text-sm font-extrabold text-[#111] transition duration-200 hover:scale-105"
    >
      <Copy className="h-4 w-4" strokeWidth={2} />
      คัดลอกรหัส
    </button>
  );
}

// =====================================================================
// แถวห้องเรียน
// =====================================================================
function ClassroomRow({ room, canDelete = false }: { room: RoomRow; canDelete?: boolean }) {
  const router = useRouter();
  const showToast = useToast();
  const names = exercises.filter((ex) => room.exercises.includes(ex.slug)).map((ex) => ex.name);

  const remove = async () => {
    if (!confirm(`ลบห้องเรียน "${room.name}"? นักศึกษาทุกคนจะถูกนำออกจากห้องนี้`)) return;
    try {
      await deleteClassroom(room.id);
      router.refresh();
    } catch (err) {
      showToast(`ลบไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/classroom/${room.code}`} className="group min-w-0">
        <p className="font-medium text-white group-hover:text-[#ffd22e]">{room.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[#5c6b7e]">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatThaiDate(room.date)} · {names.join(", ")}
          {room.memberCount !== null && (
            <>
              {" · "}
              <Users className="h-3.5 w-3.5" />
              {room.memberCount} คน
            </>
          )}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-[#29415b] bg-[#07101b] px-3 py-1.5 font-mono text-sm tracking-widest text-[#ffd22e]">
          {room.code}
        </span>
        {canDelete && (
          <button
            onClick={remove}
            aria-label="ลบห้องเรียน"
            className="cursor-pointer rounded-lg border border-[#29415b] p-2 text-[#91a0b2] transition duration-200 hover:scale-105 hover:border-[#d03b3b] hover:text-[#d03b3b]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
