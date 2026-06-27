import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/CommentSection";
import { TrackPageView } from "@/components/TrackPageView";
import { getCommentsByPostId, getPostBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const comments = await getCommentsByPostId(post.id);

  return (
    <main className="pastel-page min-h-screen px-6 py-10 text-[#3f2a56]">
      <TrackPageView path={`/posts/${post.slug}`} />
      <article className="mx-auto max-w-3xl rounded-3xl bg-[#fffdf7] p-8 shadow-sm ring-1 ring-pink-100 md:p-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold text-[#9f7aea]">
            홈으로 돌아가기
          </Link>
          <Link href="/posts" className="text-sm font-bold text-[#7c658d]">
            글 목록으로 돌아가기
          </Link>
        </header>
        <p className="mt-10 text-sm text-[#5aa6c8]">
          {post.published_at
            ? new Intl.DateTimeFormat("ko-KR").format(
                new Date(post.published_at),
              )
            : "작성 중"}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          {post.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#6f5a7d]">{post.excerpt}</p>
        {post.image_url ? (
          <Image
            src={post.image_url}
            alt={`${post.title} 대표 이미지`}
            width={960}
            height={540}
            className="mt-8 h-auto w-full rounded-2xl object-cover"
            priority
          />
        ) : null}
        <div className="mt-10 space-y-5 whitespace-pre-wrap leading-8 text-[#6f5a7d]">
          {post.content}
        </div>
      </article>
      <CommentSection postId={post.id} initialComments={comments} />
    </main>
  );
}
