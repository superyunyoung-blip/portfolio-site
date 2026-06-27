import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackPageView } from "@/components/TrackPageView";
import { getProjectById } from "@/lib/data";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <main className="pastel-page min-h-screen px-6 py-10 text-[#3f2a56]">
      <TrackPageView path={`/projects/${project.id}`} />
      <article className="mx-auto max-w-4xl rounded-3xl bg-[#fffdf7] p-8 shadow-sm ring-1 ring-pink-100 md:p-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold text-[#9f7aea]">
            홈으로 돌아가기
          </Link>
          <Link href="/projects" className="text-sm font-bold text-[#7c658d]">
            프로젝트 목록으로 돌아가기
          </Link>
        </header>

        {project.image_url ? (
          <Image
            src={project.image_url}
            alt={`${project.title} 대표 이미지`}
            width={1200}
            height={800}
            className="mt-10 aspect-[3/2] w-full rounded-2xl object-cover"
            priority
          />
        ) : null}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {project.featured ? (
            <span className="rounded-full bg-[#e8dcff] px-3 py-1 text-xs font-bold text-[#6b4bb0]">
              대표 프로젝트
            </span>
          ) : null}
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#ffe4ee] px-3 py-1 text-xs text-[#9a4968]"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
          {project.title}
        </h1>
        <p className="mt-6 whitespace-pre-line text-lg leading-8 text-[#6f5a7d]">
          {project.description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {project.url ? (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#9f7aea] px-5 py-3 text-sm font-bold text-white"
            >
              {project.url_label || "사이트 보기"}
            </a>
          ) : null}
          {project.repo_url ? (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#d8ccff] bg-white/70 px-5 py-3 text-sm font-bold"
            >
              {project.repo_label || "코드 보기"}
            </a>
          ) : null}
        </div>
      </article>
    </main>
  );
}
