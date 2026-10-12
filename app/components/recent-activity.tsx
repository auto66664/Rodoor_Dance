"use client";

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { gradeOf, type Activity } from "../lib/activity-store";

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });

export default function RecentActivity({ activities: all }: { activities: Activity[] }) {
  const activities = all.slice(0, 10);

  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[#91a0b2]">
        ยังไม่มีกิจกรรม —{" "}
        <Link href="/training/salute" className="text-[#ffd22e] hover:underline">
          ไปทดสอบท่าเคารพตรงหน้า
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-4 divide-y divide-[#1b2a3c]">
      {activities.map((item) => {
        const grade = gradeOf(item.similarity);
        const date = new Date(item.timestamp);

        return (
          <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-[#d8e2ee]">
                {item.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-[#3ddc84]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#d03b3b]" />
                )}
                {item.exercise}
              </p>
              <p className="text-xs text-[#5c6b7e]">
                {dateFormat.format(date)} · {timeFormat.format(date)} น.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#d8e2ee]">
                ความแม่นยำ <b className="text-white">{item.similarity.toFixed(1)}%</b>
              </span>
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
                style={{ color: grade.color, borderColor: grade.color }}
              >
                {grade.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
