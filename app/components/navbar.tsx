"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Dumbbell, GraduationCap, House, LogOut, User, UserCircle } from "lucide-react";
import { useAuth } from "./auth-provider";
import { useLoginGate } from "./login-gate";
import Avatar from "./avatar";
import { createClient } from "../lib/supabase/client";
import { formalName } from "../lib/types";

const links = [
  { id: "home", label: "หน้าหลัก", icon: House, href: "/#home", type: "scroll" as const },
  { id: "training", label: "ฝึกท่า", icon: Dumbbell, href: "/#training", type: "scroll" as const },
  { id: "classroom", label: "ห้องเรียน", icon: GraduationCap, href: "/classroom", type: "route" as const },
  { id: "dashboard", label: "สถิติ", icon: BarChart3, href: "/dashboard", type: "route" as const },
  { id: "profile", label: "โปรไฟล์", icon: User, href: "/profile", type: "route" as const },
];

export default function Navbar() {
  const [activeScroll, setActiveScroll] = useState("home");
  const pathname = usePathname();
  const gate = useLoginGate();

  return (
    <nav className="sticky top-0 z-20 flex h-[82px] items-center justify-between border-b border-[#1b2a3c] bg-[#08111d] px-[5%]">
      <div className="flex items-center gap-3">
        <Image src="/images/logo.png" alt="รด. แดนซ์" width={66} height={66} className="h-11 w-11 rounded-full object-cover" priority />
        <div>
          <strong className="text-[21px]">
            รด. <span className="text-[#ffd22e]">แดนซ์</span>
          </strong>
          <small className="mt-0.5 block text-[11px] text-[#91a0b2]">ฝึก รด. ง่ายๆด้วยครูฝึก AI</small>
        </div>
      </div>

      <div className="hidden gap-[30px] md:flex">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.type === "route" ? pathname.startsWith(link.href) : pathname === "/" && activeScroll === link.id;
          const className = `relative flex cursor-pointer items-center gap-1.5 py-[30px] text-sm no-underline transition-colors ${
            isActive
              ? "text-[#ffd22e] after:absolute after:bottom-[18px] after:left-0 after:right-0 after:h-[3px] after:bg-[#ffd22e] after:content-['']"
              : "text-[#dce4ee] hover:text-white"
          }`;

          return (
            <Link
              key={link.id}
              href={link.href}
              onClick={(e) => {
                // ห้องเรียน / สถิติ / โปรไฟล์ ต้องล็อกอินก่อน
                if (link.type === "route" && !gate(link.href)) return e.preventDefault();
                if (link.type === "scroll") setActiveScroll(link.id);
              }}
              className={className}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {link.label}
            </Link>
          );
        })}
      </div>

      <AccountButton />
    </nav>
  );
}

// ยังไม่ล็อกอิน: ปุ่มเข้าสู่ระบบ / ล็อกอินแล้ว: ชื่อ + บทบาท + ออกจากระบบ
function AccountButton() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <Link
        href="/register"
        className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-[#ffd22e] px-6 py-[13px] font-extrabold text-[#111] transition duration-200 hover:scale-105"
      >
        <UserCircle className="h-5 w-5" strokeWidth={2} />
        เข้าสู่ระบบ
      </Link>
    );
  }

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="flex items-center gap-2.5">
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-semibold text-white">{formalName(profile) || user.email}</span>
          <span className="block text-xs text-[#ffd22e]">{profile?.role === "trainer" ? "ครูฝึก" : "นักศึกษาวิชาทหาร"}</span>
        </span>
        <Avatar url={profile?.avatar_url} alt={formalName(profile) || "โปรไฟล์"} size={40} className="border border-[#29415b]" />
      </Link>
      <button
        onClick={signOut}
        disabled={signingOut}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-[#29415b] px-4 py-2.5 text-sm font-semibold text-[#d8e2ee] transition duration-200 hover:scale-105 hover:bg-[#12345a] disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        ออกจากระบบ
      </button>
    </div>
  );
}
