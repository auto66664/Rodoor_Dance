import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, StickyNote, UserRound, Users } from "lucide-react";
import { exercises } from "../../data/exercises";
import { gradeOf } from "../../lib/activity-store";
import { formatThaiDate } from "../../lib/dates";
import { createClient, getCurrentUser } from "../../lib/supabase/server";
import { displayName, type Classroom, type Profile } from "../../lib/types";
import { JoinRoomButton, RemoveMemberButton } from "../../components/classroom/room-actions";
import ProfileMissing from "../../components/profile-missing";
import Avatar from "../../components/avatar";

type Member = Pick<
  Profile,
  "id" | "rank" | "first_name" | "last_name" | "year" | "company" | "platoon" | "squad" | "order_no" | "avatar_url"
>;

interface ResultRow {
  user_id: string;
  exercise_slug: string;
  accuracy: number;
  passed: boolean;
  created_at: string;
}

const dateTime = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ClassroomRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const current = await getCurrentUser();
  if (!current) redirect(`/register?next=/classroom/${code}`);
  if (!current.profile) return <ProfileMissing />;

  const supabase = await createClient();
  // RLS: เห็นได้เฉพาะครูฝึกเจ้าของห้อง และ นศท. ที่เข้าห้องแล้ว
  const { data: room } = await supabase.from("classrooms").select("*").eq("code", code.toUpperCase()).maybeSingle();

  return (
    <main className="min-h-screen bg-[#07101b] px-[5%] py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/classroom" className="inline-flex items-center gap-1.5 text-sm text-[#91a0b2] hover:text-white">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          กลับหน้าห้องเรียน
        </Link>

        {!room ? (
          <div className="mt-6 rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-8 text-center">
            <p className="text-xl font-bold text-white">ไม่พบห้องเรียน</p>
            <p className="mt-2 text-sm text-[#91a0b2]">
              ไม่มีห้องเรียนรหัส <span className="font-mono text-[#ffd22e]">{code.toUpperCase()}</span> หรือคุณยังไม่ได้เข้าห้องนี้
            </p>
            {current.profile.role === "student" && <JoinRoomButton code={code} />}
          </div>
        ) : (
          <RoomDetail room={room as Classroom} isOwner={(room as Classroom).trainer_id === current.id} />
        )}
      </div>
    </main>
  );
}

async function RoomDetail({ room, isOwner }: { room: Classroom; isOwner: boolean }) {
  const roomExercises = exercises.filter((ex) => room.exercises.includes(ex.slug));

  return (
    <>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-white">{room.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#91a0b2]">
            <span className="flex items-center gap-1.5">
              <UserRound className="h-4 w-4" />
              {room.trainer_name}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatThaiDate(room.date)}
            </span>
          </div>
        </div>
        <span className="self-start rounded-lg border border-[#29415b] bg-[#0c1927] px-3 py-1.5 font-mono text-sm tracking-widest text-[#ffd22e] sm:self-auto">
          {room.code}
        </span>
      </div>

      {room.note && (
        <div className="mt-6 flex gap-3 rounded-xl border border-[#ffd22e]/30 bg-[#ffd22e]/5 p-4 text-sm text-[#d8e2ee]">
          <StickyNote className="h-5 w-5 shrink-0 text-[#ffd22e]" />
          {room.note}
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold text-white">ท่าที่ต้องฝึกวันนี้</h2>
      <div className="mt-4 space-y-3">
        {roomExercises.map((ex, i) => (
          <Link
            key={ex.slug}
            href={`/training/${ex.slug}`}
            className="group flex items-center gap-4 overflow-hidden rounded-xl border border-[#29415b] bg-[#0c1927] p-3 transition duration-200 hover:scale-[1.02] hover:border-[#4a8cc4]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ffd22e] text-sm font-bold text-[#111]">
              {i + 1}
            </span>
            <div className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg ${ex.gradientClass}`}>
              <Image src={ex.image} alt="" fill sizes="96px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{ex.name}</p>
              <p className="text-xs text-[#8fa0b3]">{ex.shortDesc}</p>
            </div>
            <span className="text-lg text-[#91a0b2] transition group-hover:translate-x-1 group-hover:text-white">→</span>
          </Link>
        ))}
      </div>

      {isOwner && <MembersResults room={room} />}
    </>
  );
}

// ครูฝึก: นศท. ในห้อง + ผลการทดสอบท่าที่ห้องนี้ฝึก
async function MembersResults({ room }: { room: Classroom }) {
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("classroom_members")
    .select("joined_at, profiles(id, rank, first_name, last_name, year, company, platoon, squad, order_no, avatar_url)")
    .eq("classroom_id", room.id);

  const members = (memberRows ?? [])
    .map((row) => (row as unknown as { profiles: Member | null }).profiles)
    .filter((m): m is Member => m !== null)
    .sort((a, b) =>
      [a.company, a.platoon, a.squad, a.order_no]
        .join("|")
        .localeCompare([b.company, b.platoon, b.squad, b.order_no].join("|"), "th", { numeric: true })
    );

  const { data: resultRows } = members.length
    ? await supabase
        .from("test_results")
        .select("user_id, exercise_slug, accuracy, passed, created_at")
        .in("user_id", members.map((m) => m.id))
        .in("exercise_slug", room.exercises)
        .order("created_at", { ascending: false })
    : { data: [] as ResultRow[] };

  const resultsByStudent = new Map<string, ResultRow[]>();
  for (const row of (resultRows ?? []) as ResultRow[]) {
    resultsByStudent.set(row.user_id, [...(resultsByStudent.get(row.user_id) ?? []), row]);
  }

  return (
    <section className="mt-10 rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-6">
      <div className="flex items-center gap-2 text-white">
        <Users className="h-5 w-5 text-[#ffd22e]" />
        <h2 className="text-lg font-semibold">นักศึกษาในห้อง ({members.length} คน)</h2>
      </div>
      <p className="mt-1 text-xs text-[#5c6b7e]">ผลการทดสอบท่าที่ห้องนี้ฝึก (โหมดทดสอบ)</p>

      {members.length === 0 ? (
        <p className="mt-4 text-sm text-[#5c6b7e]">ยังไม่มีนักศึกษาเข้าห้อง — ให้นักศึกษากรอกรหัส {room.code} ที่หน้าห้องเรียน</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="text-xs text-[#91a0b2]">
              <tr className="border-b border-[#1b2a3c]">
                <th className="py-2 pr-3 font-medium">ชื่อ</th>
                <th className="py-2 pr-3 font-medium">กองร้อย/หมวด/หมู่/ลำดับ</th>
                <th className="py-2 pr-3 font-medium">ทดสอบ</th>
                <th className="py-2 pr-3 font-medium">ล่าสุด</th>
                <th className="py-2 pr-3 font-medium">ดีที่สุด</th>
                <th className="py-2 pr-3 font-medium">สถานะ</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2a3c]">
              {members.map((member) => {
                const results = resultsByStudent.get(member.id) ?? [];
                const latest = results[0];
                const best = results.length ? Math.max(...results.map((r) => Number(r.accuracy))) : null;
                const grade = latest ? gradeOf(Number(latest.accuracy)) : null;

                return (
                  <tr key={member.id} className="text-[#d8e2ee]">
                    <td className="py-3 pr-3 font-medium text-white">
                      <span className="flex items-center gap-2.5">
                        <Avatar url={member.avatar_url} alt={displayName(member)} size={32} />
                        {displayName(member)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-[#91a0b2]">
                      {[member.company, member.platoon, member.squad, member.order_no].map((v) => v || "-").join(" / ")}
                    </td>
                    <td className="py-3 pr-3">{results.length} ครั้ง</td>
                    <td className="py-3 pr-3">
                      {latest ? (
                        <>
                          <b className="text-white">{Number(latest.accuracy).toFixed(1)}%</b>
                          <span className="block text-xs text-[#5c6b7e]">{dateTime.format(new Date(latest.created_at))}</span>
                        </>
                      ) : (
                        <span className="text-[#5c6b7e]">ยังไม่ทดสอบ</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">{best === null ? "-" : `${best.toFixed(1)}%`}</td>
                    <td className="py-3 pr-3">
                      {grade && (
                        <span
                          className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium"
                          style={{ color: grade.color, borderColor: grade.color }}
                        >
                          {grade.label}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <RemoveMemberButton classroomId={room.id} studentId={member.id} name={displayName(member)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
