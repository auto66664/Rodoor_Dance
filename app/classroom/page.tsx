import { redirect } from "next/navigation";
import ClassroomClient, { type RoomRow } from "../components/classroom/classroom-client";
import ProfileMissing from "../components/profile-missing";
import { createClient, getCurrentUser } from "../lib/supabase/server";
import { displayName, type Classroom } from "../lib/types";

export default async function ClassroomPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/register?next=/classroom");
  if (!current.profile) return <ProfileMissing />;

  const supabase = await createClient();
  const isTrainer = current.profile.role === "trainer";
  let rooms: RoomRow[] = [];

  if (isTrainer) {
    // ห้องของครูฝึกคนนี้ + จำนวน นศท. ในห้อง
    const { data } = await supabase
      .from("classrooms")
      .select("*, classroom_members(count)")
      .eq("trainer_id", current.id)
      .order("created_at", { ascending: false });

    rooms = (data ?? []).map((row) => {
      const { classroom_members, ...room } = row as Classroom & { classroom_members: { count: number }[] };
      return { ...room, memberCount: classroom_members?.[0]?.count ?? 0 };
    });
  } else {
    // ห้องที่ นศท. คนนี้เข้าแล้ว
    const { data } = await supabase
      .from("classroom_members")
      .select("joined_at, classrooms(*)")
      .eq("student_id", current.id)
      .order("joined_at", { ascending: false });

    rooms = (data ?? [])
      .map((row) => (row as unknown as { classrooms: Classroom | null }).classrooms)
      .filter((room): room is Classroom => room !== null)
      .map((room) => ({ ...room, memberCount: null }));
  }

  return (
    <ClassroomClient
      role={current.profile.role}
      rooms={rooms}
      trainerName={displayName(current.profile)}
    />
  );
}
