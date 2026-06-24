import Link from "next/link";
import { getProfile, getProjects, getPublishedPosts } from "@/lib/data";

export default async function Home() {
  const [profile, projects, posts] = await Promise.all([
    getProfile(),
    getProjects(),
    getPublishedPosts(),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-semibold tracking-tight">
          {profile.name}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <a href="#projects" className="hover:text-slate-950">
            프로젝트
          </a>
          <a href="#posts" className="hover:text-slate-950">
            글
          </a>
          <Link href="/admin" className="hover:text-slate-950">
            관리자
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <section className="grid gap-10 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 md:grid-cols-[1.2fr_0.8fr] md:p-12">
          <div>
            <p className="mb-4 text-sm font-medium text-blue-600">
              {profile.location}
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              {profile.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {profile.bio}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${profile.email}`}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                연락하기
              </a>
              {profile.github_url ? (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold transition hover:border-slate-950"
                >
                  GitHub
                </a>
              ) : null}
              {profile.linkedin_url ? (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold transition hover:border-slate-950"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-950 p-6 text-white">
            <p className="text-sm text-slate-300">현재 사이트 상태</p>
            <dl className="mt-8 grid gap-6">
              <div>
                <dt className="text-3xl font-bold">{projects.length}</dt>
                <dd className="mt-1 text-sm text-slate-300">등록된 프로젝트</dd>
              </div>
              <div>
                <dt className="text-3xl font-bold">{posts.length}</dt>
                <dd className="mt-1 text-sm text-slate-300">공개된 글</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="projects" className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-600">Portfolio</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                프로젝트
              </h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-semibold">{project.title}</h3>
                  {project.featured ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      Featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 leading-7 text-slate-600">
                  {project.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex gap-4 text-sm font-medium">
                  {project.url ? (
                    <a href={project.url} target="_blank" rel="noreferrer">
                      사이트 보기
                    </a>
                  ) : null}
                  {project.repo_url ? (
                    <a href={project.repo_url} target="_blank" rel="noreferrer">
                      코드 보기
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="posts" className="mt-16">
          <p className="text-sm font-medium text-blue-600">Writing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">최근 글</h2>
          <div className="mt-6 grid gap-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm text-slate-500">
                  {post.published_at
                    ? new Intl.DateTimeFormat("ko-KR").format(
                        new Date(post.published_at),
                      )
                    : "작성 중"}
                </p>
                <h3 className="mt-2 text-xl font-semibold">{post.title}</h3>
                <p className="mt-3 text-slate-600">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
