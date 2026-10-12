"use client";

export type Role = "student" | "trainer";

const roles: { id: Role; label: string }[] = [
  { id: "student", label: "นักศึกษาวิชาทหาร" },
  { id: "trainer", label: "ครูฝึก" },
];

export default function RoleTabs({
  value,
  onChange,
}: {
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-full border border-[#29415b] bg-[#0c1927] p-1">
      {roles.map((role) => (
        <button
          key={role.id}
          type="button"
          onClick={() => onChange(role.id)}
          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            value === role.id ? "bg-[#ffd22e] text-[#111]" : "text-[#b9c6d5] hover:text-white"
          }`}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}
