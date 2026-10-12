import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export type Status = "good" | "warning" | "critical";

const statusConfig: Record<Status, { color: string; icon: typeof CheckCircle2; label: string }> = {
  good: { color: "#0ca30c", icon: CheckCircle2, label: "ผ่าน" },
  warning: { color: "#fab219", icon: AlertTriangle, label: "ควรฝึกเพิ่ม" },
  critical: { color: "#d03b3b", icon: XCircle, label: "ไม่ผ่าน" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { color, icon: Icon, label } = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium" style={{ color, borderColor: color }}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </span>
  );
}
