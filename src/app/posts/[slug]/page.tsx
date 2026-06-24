import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/data";

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

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 md:p-12">
        <Link href="/" className="text-sm font-medium text-blue-600">
          홈으로 돌아가기
        </Link>
        <p className="mt-10 text-sm text-slate-500">
          {post.published_at
            ? new Intl.DateTimeFormat("ko-KR").format(
                new Date(post.published_at),
              )
            : "작성 중"}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          {post.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">{post.excerpt}</p>
        <div className="mt-10 space-y-5 whitespace-pre-wrap leading-8 text-slate-700">
          {post.content}
        </div>
      </article>
    </main>
  );
}
