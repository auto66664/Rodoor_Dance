export default function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-[#d8e2ee]">{label}</span>
        <span className="font-semibold text-[#ffd22e]">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#07101b]">
        <div className="h-full rounded-full bg-[#ffd22e]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
