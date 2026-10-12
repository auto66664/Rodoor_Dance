import type { LucideIcon } from "lucide-react";

export default function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#29415b] bg-[#0c1927] p-5">
      <div className="flex items-center gap-2 text-xs text-[#91a0b2]">
        <Icon className="h-4 w-4" strokeWidth={2} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#5c6b7e]">{hint}</p>}
    </div>
  );
}
