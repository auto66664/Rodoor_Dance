"use client";

import { useMemo } from "react";
import { Flame, Gauge, ListChecks, Trophy } from "lucide-react";
import StatTile from "./stat-tile";
import ProgressBar from "./progress-bar";
import { exercises } from "../data/exercises";
import type { Activity } from "../lib/activity-store";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// จำนวนวันติดกัน (นับถึงวันนี้ หรือเมื่อวานถ้าวันนี้ยังไม่ได้ฝึก) ที่มีการทดสอบ
function streakDays(activities: Activity[], now: number) {
  const days = new Set(activities.map((a) => dayKey(a.timestamp)));
  let cursor = days.has(dayKey(now)) ? now : now - DAY_MS;
  let count = 0;

  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor -= DAY_MS;
  }

  return count;
}

export function computeStats(activities: Activity[]) {
  const now = Date.now();
  const today = dayKey(now);

  const practicedToday = new Set(activities.filter((a) => dayKey(a.timestamp) === today).map((a) => a.slug));

  const lastWeek = activities.filter((a) => now - a.timestamp <= 7 * DAY_MS);
  const average = lastWeek.length ? lastWeek.reduce((sum, a) => sum + a.similarity, 0) / lastWeek.length : null;

  // คะแนนรวม = ผลรวมจำนวนเต็มของความแม่นยำทุกครั้ง
  const totalPoints = activities.reduce((sum, a) => sum + Math.floor(a.similarity), 0);

  const mastery = exercises.map((ex) => {
    // ความแม่นยำเฉลี่ยของทุกครั้งที่ทดสอบท่านั้น
    const tests = activities.filter((a) => a.slug === ex.slug);
    const percent = tests.length ? Math.round(tests.reduce((sum, a) => sum + a.similarity, 0) / tests.length) : 0;
    return { slug: ex.slug, label: ex.name, percent, tested: tests.length > 0 };
  });

  return {
    practicedToday: practicedToday.size,
    average,
    streak: streakDays(activities, now),
    totalPoints,
    mastery,
  };
}

export default function DashboardStats({ activities }: { activities: Activity[] }) {
  const stats = useMemo(() => computeStats(activities), [activities]);
  const remaining = exercises.length - stats.practicedToday;

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatTile
          icon={ListChecks}
          label="ท่าที่ฝึกวันนี้"
          value={`${stats.practicedToday}/${exercises.length}`}
          hint={remaining === 0 ? "ครบตามเป้าหมาย" : `เหลืออีก ${remaining} ท่า`}
        />
        <StatTile
          icon={Gauge}
          label="ความแม่นยำเฉลี่ย"
          value={stats.average === null ? "-" : `${Math.round(stats.average)}%`}
          hint={stats.average === null ? "ยังไม่มีการทดสอบใน 7 วัน" : "7 วันล่าสุด"}
        />
        <StatTile
          icon={Flame}
          label="ฝึกต่อเนื่อง"
          value={`${stats.streak} วัน`}
          hint={stats.streak > 0 ? "อย่าให้ขาดนะ!" : "เริ่มฝึกวันนี้เลย"}
        />
        <StatTile
          icon={Trophy}
          label="คะแนนรวม"
          value={stats.totalPoints.toLocaleString("th-TH")}
          hint="รวมความแม่นยำทุกครั้ง"
        />
      </div>

      <section className="mt-10 rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-6">
        <h2 className="text-lg font-semibold text-white">ความชำนาญรายท่า</h2>
        <p className="mt-1 text-xs text-[#5c6b7e]">ความแม่นยำเฉลี่ยของทุกครั้งที่ทดสอบแต่ละท่า</p>
        <div className="mt-5 space-y-5">
          {stats.mastery.map((item) => (
            <ProgressBar
              key={item.slug}
              label={item.tested ? item.label : `${item.label} (ยังไม่ได้ทดสอบ)`}
              percent={item.percent}
            />
          ))}
        </div>
      </section>
    </>
  );
}
