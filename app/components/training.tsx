import Image from "next/image";
import { GatedLink } from "./login-gate";
import { exercises } from "../data/exercises";

export default function Training() {
  return (
    <section id="training" className="px-[5%] py-[65px]">
      <div className="mb-7">
        <h2 className="m-0 text-[32px]">💂 เลือกท่าฝึกบุคคลมือเปล่า</h2>
        <p className="text-[#91a0b2]">เริ่มจากท่าพื้นฐาน ฝึกทีละขั้น แล้วไปสู่ระดับที่สูงขึ้น</p>
      </div>

      <div className="grid grid-cols-1 gap-[17px] sm:grid-cols-2 md:grid-cols-3">
        {exercises.map((ex) => (
          <GatedLink
            key={ex.slug}
            href={`/training/${ex.slug}`}
            className="group block overflow-hidden rounded-xl border border-[#29415b] bg-[#0c1927] transition duration-200 hover:-translate-y-[5px] hover:border-[#4a8cc4]"
          >
            <div className={`relative h-[145px] overflow-hidden ${ex.gradientClass}`}>
              <Image src={ex.image} alt={ex.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
            </div>
            <div className="relative p-[15px]">
              <h3 className="mb-[5px]">{ex.name}</h3>
              <p className="max-w-[85%] text-xs leading-[1.5] text-[#8fa0b3]">{ex.shortDesc}</p>
              <span className="absolute bottom-[17px] right-[15px] flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#2c659b] bg-[#12345a] text-lg text-white transition group-hover:bg-[#1a4a7a]">
                →
              </span>
            </div>
          </GatedLink>
        ))}
      </div>
    </section>
  );
}
