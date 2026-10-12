// ห้องเรียน → ตาราง classrooms / classroom_members ใน Supabase (สิทธิ์คุมด้วย RLS)
import { createClient } from "./supabase/client";
import type { Classroom } from "./types";

export type { Classroom };

export interface NewClassroom {
  name: string;
  trainer_name: string;
  date: string;
  exercises: string[];
  note: string;
}

/** ครูฝึกสร้างห้อง — รหัส 6 หลักสร้างอัตโนมัติในฐานข้อมูล */
export async function createClassroom(data: NewClassroom) {
  const { data: room, error } = await createClient().from("classrooms").insert(data).select("*").single();
  if (error) throw new Error(error.message);
  return room as Classroom;
}

export async function deleteClassroom(id: string) {
  const { error } = await createClient().from("classrooms").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** นศท. เข้าห้องด้วยรหัส → คืนรหัสห้อง หรือ null ถ้าไม่พบ */
export async function joinClassroom(code: string) {
  const { data, error } = await createClient().rpc("join_classroom", { room_code: code });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** นศท. ออกจากห้อง / ครูฝึกนำ นศท. ออกจากห้อง */
export async function removeMember(classroomId: string, studentId: string) {
  const { error } = await createClient()
    .from("classroom_members")
    .delete()
    .eq("classroom_id", classroomId)
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
}

export { formatThaiDate, todayISO } from "./dates";
