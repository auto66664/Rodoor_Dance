"use client";

import Image from "next/image";
import { GatedLink, useLoginGate } from "./login-gate";

export default function Hero() {
  const gate = useLoginGate();

  const scrollToTraining = () => {
    if (!gate("/#training")) return;
    document.getElementById("training")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="home"
      className="relative flex min-h-[575px] items-center overflow-hidden px-[5%] py-16"
    >
      <Image
        src="/images/hero-main.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#07101bc0_0%,#07101ba3_45%,#07101b40_100%)]" />

      <div className="relative z-[2] max-w-[650px]">
        <h1 className="mb-5 font-semibold text-[42px] leading-none sm:text-5xl md:text-[64px] text-[#ffd22e]">
          เบื่อไหม???
        </h1>
        <p className="max-w-[650px] text-lg leading-[1.8] text-[#bdcad8]">
          โดนแดก โดนซ่อม สอบไม่ผ่าน เพราะเพียงทำท่าทางไม่ถูกต้อง ปัญหานี้จะหมดไป!!
          <br></br>
          เพียงแค่คุณมี "<span className="text-xl font-semibold">รด.แดนซ์</span>"
        </p>

        <div className="my-8 flex flex-wrap gap-7">
          <div className="flex items-center gap-2.5 text-[13px] text-[#d8e2ee]">
            <b className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[#258de1] text-[19px] font-normal text-[#55b9ff]">
              ◎
            </b>
            <span>
              วิเคราะห์ท่าทาง
              <br />
              ด้วย AI
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[13px] text-[#d8e2ee]">
            <b className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[#258de1] text-[19px] font-normal text-[#55b9ff]">
              ▥
            </b>
            <span>
              มีคำแนะนำ
              <br />
              แบบเรียลไทม์
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[13px] text-[#d8e2ee]">
            <b className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[#258de1] text-[19px] font-normal text-[#55b9ff]">
              ●
            </b>
            <span>
              ฝึกได้ทุกที่
              <br />
              ทุกเวลา
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[13px] text-[#d8e2ee]">
            <b className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[#258de1] text-[19px] font-normal text-[#55b9ff]">
              ★
            </b>
            <span>
              พัฒนาตัวเอง
              <br />
              สู่เป้าหมาย
            </span>
          </div>
        </div>

        <div className="flex gap-[15px]">
          <button
            onClick={scrollToTraining}
            className="cursor-pointer rounded-full border-0 bg-[#ffd22e] px-[25px] py-[15px] text-[15px] font-extrabold text-[#111] transition duration-200 hover:scale-105"
          >
            ▶ เริ่มฝึกเลย <span className="ml-[18px]">›</span>
          </button>
          <GatedLink
            href="/classroom"
            className="cursor-pointer rounded-full border border-[#a7b4c3] bg-transparent px-6 py-[14px] text-white transition duration-200 hover:scale-105"
          >
            ▷ เข้าสู่ห้องเรียน
          </GatedLink>
        </div>
      </div>
    </section>
  );
}
