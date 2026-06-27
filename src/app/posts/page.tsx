import Image from "next/image";
import Link from "next/link";
import { TrackPageView } from "@/components/TrackPageView";
import { getPublishedPosts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await getPublishedPosts();

  return (
    <main className="pastel-page min-h-screen px-6 py-10 text-[#3f2a56]">
      <TrackPageView path="/posts" />
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold text-[#9f7aea]">
            홈으로 돌아가기
          </Link>
          <Link href="/projects" className="text-sm font-bold text-[#7c658d]">
            프로젝트 모아보기
          </Link>
        </header>

        <section className="mt-10 rounded-3xl bg-[#fffdf7] p-8 shadow-sm ring-1 ring-pink-100 md:p-12">
          <p className="text-sm font-medium text-[#5aa6c8]">Writing</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-6xl">
            글 모아보기
          </h1>
          <p className="mt-5 max-w-2xl leading-8 text-[#6f5a7d]">
            대표 글이 가장 먼저 보이고, 최신 글이 이어서 정렬됩니다.
          </p>
        </section>

        <section className="mt-10 grid gap-5">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug || post.id}`}
              className="grid gap-5 rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100 transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[220px_1fr]"
            >
              {post.image_url ? (
                <Image
                  src={post.image_url}
                  alt={`${post.title} 대표 이미지`}
                  width={440}
                  height={300}
                  className="aspect-[3/2] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex aspect-[3/2] items-center justify-center rounded-xl bg-[#dff5ff] text-[#5aa6c8]">
                  No image
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-[#5aa6c8]">
                    {post.published_at
                      ? new Intl.DateTimeFormat("ko-KR").format(
                          new Date(post.published_at),
                        )
                      : "작성 중"}
                  </p>
                  {post.featured ? (
                    <span className="rounded-full bg-[#dff5ff] px-3 py-1 text-xs font-medium text-[#3f8fb2]">
                      대표 글
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-2xl font-bold">{post.title}</h2>
                <p className="mt-3 leading-7 text-[#6f5a7d]">{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
