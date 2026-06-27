import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { ProjectCarousel } from "@/components/ProjectCarousel";
import { TrackPageView } from "@/components/TrackPageView";
import { getProfile, getProjects, getPublishedPosts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [profile, projects, posts] = await Promise.all([
    getProfile(),
    getProjects(),
    getPublishedPosts(),
  ]);

  return (
    <div className="pastel-page min-h-screen text-[#3f2a56]">
      <TrackPageView path="/" />
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
        <Link href="/" className="text-lg font-bold tracking-tight sm:text-xl">
          {profile.name}
        </Link>
        <nav className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#7c658d] sm:w-auto">
          <Link href="/grow-game" className="hover:text-[#3f2a56]">
            게임
          </Link>
          <Link href="/projects" className="hover:text-[#3f2a56]">
            프로젝트
          </Link>
          <Link href="/posts" className="hover:text-[#3f2a56]">
            글
          </Link>
          <a href="#contact" className="hover:text-[#3f2a56]">
            문의
          </a>
          <Link href="/admin" className="hover:text-[#3f2a56]">
            관리자
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <section className="grid gap-8 rounded-3xl bg-[#fffdf7] p-5 shadow-sm ring-1 ring-pink-100 sm:p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
          <div>
            <p className="mb-4 text-sm font-medium text-[#9f7aea]">
              {profile.location}
            </p>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-6xl">
              {profile.headline}
            </h1>
            <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-[#6f5a7d] sm:mt-6 sm:text-lg sm:leading-8">
              {profile.bio}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/grow-game"
                className="rounded-full bg-[#ff8fb8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#f06f9f]"
              >
                키우기 게임하기
              </Link>
              <a
                href={`mailto:${profile.email}`}
                className="rounded-full bg-[#b8a2ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9f7aea]"
              >
                {profile.contact_label || "연락하기"}
              </a>
              {profile.github_url ? (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#d8ccff] bg-white/70 px-5 py-3 text-sm font-semibold transition hover:border-[#9f7aea]"
                >
                  {profile.github_label || "GitHub"}
                </a>
              ) : null}
              {profile.linkedin_url ? (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#d8ccff] bg-white/70 px-5 py-3 text-sm font-semibold transition hover:border-[#9f7aea]"
                >
                  {profile.linkedin_label || "LinkedIn"}
                </a>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl bg-[#b8a2ff] p-5 text-white sm:p-6">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={`${profile.name} 프로필 사진`}
                width={640}
                height={480}
                className="mb-6 h-64 w-full rounded-xl object-cover"
                priority
              />
            ) : null}
            <p className="text-sm text-purple-50">현재 사이트 상태</p>
            <dl className="mt-8 grid gap-6">
              <div>
                <dt className="text-3xl font-bold">{projects.length}</dt>
                <dd className="mt-1 text-sm text-purple-50">등록된 프로젝트</dd>
              </div>
              <div>
                <dt className="text-3xl font-bold">{posts.length}</dt>
                <dd className="mt-1 text-sm text-purple-50">공개된 글</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="projects" className="mt-12 sm:mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#9f7aea]">Portfolio</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                프로젝트
              </h2>
            </div>
            <Link
              href="/projects"
              className="rounded-full bg-[#ffc1d6] px-4 py-2 text-sm font-bold text-[#5b3a4a]"
            >
              모두 보기
            </Link>
          </div>
          <ProjectCarousel projects={projects} />
        </section>

        <section id="posts" className="mt-12 sm:mt-16">
          <p className="text-sm font-medium text-[#5aa6c8]">Writing</p>
          <div className="flex items-end justify-between gap-4">
            <h2 className="mt-2 text-3xl font-bold tracking-tight">최근 글</h2>
            <Link
              href="/posts"
              className="rounded-full bg-[#c8f0ff] px-4 py-2 text-sm font-bold text-[#315267]"
            >
              모두 보기
            </Link>
          </div>
          <div className="mt-6 grid gap-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug || post.id}`}
                className="grid gap-5 rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100 transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[180px_1fr]"
              >
                {post.image_url ? (
                  <Image
                    src={post.image_url}
                    alt={`${post.title} 대표 이미지`}
                    width={360}
                    height={240}
                    className="h-36 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="hidden h-36 rounded-xl bg-[#dff5ff] md:flex md:items-center md:justify-center md:text-[#5aa6c8]">
                    No image
                  </div>
                )}
                <div>
                  <p className="text-sm text-[#5aa6c8]">
                    {post.published_at
                      ? new Intl.DateTimeFormat("ko-KR").format(
                          new Date(post.published_at),
                        )
                      : "작성 중"}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">{post.title}</h3>
                  {post.featured ? (
                    <span className="mt-2 inline-flex rounded-full bg-[#dff5ff] px-3 py-1 text-xs font-medium text-[#3f8fb2]">
                      대표 글
                    </span>
                  ) : null}
                  <p className="mt-3 text-[#6f5a7d]">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="contact" className="mt-12 sm:mt-16">
          <p className="text-sm font-medium text-[#9f7aea]">Contact</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">문의하기</h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#6f5a7d]">
            협업, 프로젝트, 궁금한 점을 남기면 관리자 페이지에서 확인할 수
            있습니다.
          </p>
          <ContactForm />
        </section>
      </main>
    </div>
  );
}
