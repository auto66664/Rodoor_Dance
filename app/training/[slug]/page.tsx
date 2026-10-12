import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PlayCircle } from "lucide-react";
import { exercises, getExercise } from "../../data/exercises";
import StartTrainingButton from "../../components/start-training-button";

export function generateStaticParams() {
  return exercises.map((ex) => ({ slug: ex.slug }));
}

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exercise = getExercise(slug);

  if (!exercise) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#07101b] px-[5%] py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/#training" className="inline-flex items-center gap-1.5 text-sm text-[#91a0b2] hover:text-white">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          กลับไปเลือกท่าฝึก
        </Link>

        <h1 className="mt-4 text-[32px] font-bold text-white">{exercise.name}</h1>
        <p className="mt-1 text-[#91a0b2]">{exercise.longDesc}</p>

        {exercise.youtubeId ? (
          // วิดีโอสอนท่าฝึก (YouTube แบบไม่เก็บคุกกี้)
          <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-[#29415b] bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${exercise.youtubeId}?rel=0`}
              title={`วิดีโอสอน${exercise.name}`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : (
          <div
            className={`relative mt-6 flex h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-[#29415b] ${exercise.gradientClass}`}
          >
            <Image src={exercise.image} alt={exercise.name} fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative flex flex-col items-center gap-2 text-white/90">
              <PlayCircle className="h-16 w-16" strokeWidth={1.5} />
              <p className="text-sm">วิดีโอสอนท่าฝึกกำลังจะมาเร็วๆ นี้</p>
            </div>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-[#1b2a3c] bg-[#0c1927] p-6">
          <h2 className="text-lg font-semibold text-white">ขั้นตอนการฝึก</h2>
          <ol className="mt-4 space-y-3">
            {exercise.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-[#d8e2ee]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd22e] text-xs font-bold text-[#111]">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8 flex justify-center sm:justify-start">
          <StartTrainingButton slug={exercise.slug} name={exercise.name} />
        </div>
      </div>
    </main>
  );
}
