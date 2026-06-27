import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCarousel";
import { TrackPageView } from "@/components/TrackPageView";
import { getProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <main className="pastel-page min-h-screen px-6 py-10 text-[#3f2a56]">
      <TrackPageView path="/projects" />
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold text-[#9f7aea]">
            홈으로 돌아가기
          </Link>
          <Link href="/posts" className="text-sm font-bold text-[#7c658d]">
            글 모아보기
          </Link>
        </header>

        <section className="mt-10 rounded-3xl bg-[#fffdf7] p-8 shadow-sm ring-1 ring-pink-100 md:p-12">
          <p className="text-sm font-medium text-[#c46b8a]">Portfolio</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-6xl">
            프로젝트 모아보기
          </h1>
          <p className="mt-5 max-w-2xl leading-8 text-[#6f5a7d]">
            대표 프로젝트가 먼저 보이고, 한 줄에 최대 3개씩 정리해서 볼 수
            있습니다.
          </p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      </div>
    </main>
  );
}
