"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import type { Project } from "@/lib/types";

export function ProjectCarousel({ projects }: { projects: Project[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: "left" | "right") {
    scrollerRef.current?.scrollBy({
      left: direction === "left" ? -420 : 420,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative">
      <div className="mb-4 flex justify-end gap-2">
        <button
          onClick={() => scrollByCard("left")}
          className="rounded-full bg-[#ffe4ee] px-4 py-2 font-bold text-[#9a4968] shadow-sm ring-1 ring-pink-100"
          aria-label="이전 프로젝트 보기"
        >
          ←
        </button>
        <button
          onClick={() => scrollByCard("right")}
          className="rounded-full bg-[#ffe4ee] px-4 py-2 font-bold text-[#9a4968] shadow-sm ring-1 ring-pink-100"
          aria-label="다음 프로젝트 보기"
        >
          →
        </button>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x gap-5 overflow-x-auto scroll-smooth pb-4"
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            className="w-[82vw] shrink-0 snap-start md:w-[24rem]"
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectCard({
  className = "",
  project,
}: {
  className?: string;
  project: Project;
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl bg-[#fffdf7] shadow-sm ring-1 ring-pink-100 ${className}`}
    >
      <Link href={`/projects/${project.id}`} className="block">
        <div className="aspect-[3/2] bg-[#ffe4ee]">
          {project.image_url ? (
            <Image
              src={project.image_url}
              alt={`${project.title} 대표 이미지`}
              width={900}
              height={600}
              className="h-full w-full object-cover"
            />
          ) : (
          <div className="flex h-full items-center justify-center text-[#c46b8a]">
              No image
            </div>
          )}
        </div>
      </Link>
      <div className="p-6">
        <Link href={`/projects/${project.id}`} className="block">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-bold">{project.title}</h3>
            {project.featured ? (
              <span className="rounded-full bg-[#ffd6e4] px-3 py-1 text-xs font-medium text-[#9a4968]">
                대표
              </span>
            ) : null}
          </div>
          <p className="mt-3 line-clamp-3 leading-7 text-[#6f5a7d]">
            {project.description}
          </p>
        </Link>
        <div className="mt-5 flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#ffe4ee] px-3 py-1 text-xs text-[#9a4968]"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-6 flex gap-4 text-sm font-bold text-[#9a4968]">
          {project.url ? (
            <a href={project.url} target="_blank" rel="noreferrer">
              {project.url_label || "사이트 보기"}
            </a>
          ) : null}
          {project.repo_url ? (
            <a href={project.repo_url} target="_blank" rel="noreferrer">
              {project.repo_label || "코드 보기"}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
