"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { useToast } from "../toast-provider";
import { joinClassroom, removeMember } from "../../lib/classrooms";

// นศท. เปิดลิงก์ห้องที่ยังไม่ได้เข้า → กดเข้าห้องได้เลย
export function JoinRoomButton({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const join = async () => {
    setLoading(true);
    setError("");
    try {
      const roomCode = await joinClassroom(code);
      if (!roomCode) {
        setError("ไม่พบห้องเรียนรหัสนี้");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(`เข้าห้องไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
      setLoading(false);
    }
  };

  return (
    <div className="mt-5">
      <button
        onClick={join}
        disabled={loading}
        className="cursor-pointer rounded-xl bg-[#ffd22e] px-6 py-3 font-extrabold text-[#111] transition duration-200 hover:scale-105 disabled:opacity-60"
      >
        {loading ? "กำลังเข้า..." : `เข้าห้อง ${code.toUpperCase()}`}
      </button>
      {error && <p className="mt-3 text-sm text-[#e66767]">{error}</p>}
    </div>
  );
}

// ครูฝึกนำ นศท. ออกจากห้อง
export function RemoveMemberButton({ classroomId, studentId, name }: { classroomId: string; studentId: string; name: string }) {
  const router = useRouter();
  const showToast = useToast();

  const remove = async () => {
    if (!confirm(`นำ ${name} ออกจากห้องเรียน?`)) return;
    try {
      await removeMember(classroomId, studentId);
      router.refresh();
    } catch (err) {
      showToast(`ทำรายการไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <button
      onClick={remove}
      aria-label={`นำ ${name} ออกจากห้อง`}
      className="cursor-pointer rounded-lg border border-[#29415b] p-1.5 text-[#91a0b2] transition duration-200 hover:scale-105 hover:border-[#d03b3b] hover:text-[#d03b3b]"
    >
      <UserMinus className="h-4 w-4" />
    </button>
  );
}
