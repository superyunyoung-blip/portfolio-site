"use client";

import { useState } from "react";
import type { Comment } from "@/lib/types";

export function CommentSection({
  postId,
  initialComments,
}: {
  postId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingPassword, setEditingPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, authorName, content, password }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json();
      setStatus(data.error ?? "댓글 작성에 실패했습니다.");
      return;
    }

    const data = await response.json();
    setComments([data.comment as Comment, ...comments]);
    setAuthorName("");
    setContent("");
    setPassword("");
    setStatus("댓글이 등록되었습니다.");
  }

  async function updateComment(commentId: string) {
    setStatus("");
    const response = await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commentId,
        content: editingContent,
        password: editingPassword,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setStatus(data.error ?? "댓글 수정에 실패했습니다.");
      return;
    }

    const data = await response.json();
    setComments(
      comments.map((comment) =>
        comment.id === commentId ? (data.comment as Comment) : comment,
      ),
    );
    setEditingId(null);
    setEditingContent("");
    setEditingPassword("");
    setStatus("댓글을 수정했습니다.");
  }

  async function deleteComment(commentId: string) {
    const passwordForDelete = window.prompt("댓글 비밀번호를 입력해 주세요.");

    if (!passwordForDelete) {
      return;
    }

    setStatus("");
    const response = await fetch("/api/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, password: passwordForDelete }),
    });

    if (!response.ok) {
      const data = await response.json();
      setStatus(data.error ?? "댓글 삭제에 실패했습니다.");
      return;
    }

    setComments(comments.filter((comment) => comment.id !== commentId));
    setStatus("댓글을 삭제했습니다.");
  }

  return (
    <section className="mx-auto mt-8 max-w-3xl rounded-3xl bg-[#fffdf7] p-8 shadow-sm ring-1 ring-pink-100 md:p-12">
      <h2 className="text-2xl font-bold tracking-tight">댓글</h2>
      <form onSubmit={submitComment} className="mt-5 grid gap-3">
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="이름"
          className="rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="댓글을 적어주세요"
          rows={4}
          className="rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="수정/삭제용 비밀번호"
          type="password"
          className="rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
        />
        <button
          disabled={isSubmitting}
          className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "등록 중..." : "댓글 등록"}
        </button>
        {status ? <p className="text-sm text-[#6f5a7d]">{status}</p> : null}
      </form>

      <div className="mt-8 grid gap-4">
        {comments.length === 0 ? (
          <p className="text-[#8a7398]">아직 댓글이 없습니다.</p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl bg-[#fff7fb] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{comment.author_name}</p>
                <time className="text-sm text-[#8a7398]">
                  {new Intl.DateTimeFormat("ko-KR").format(
                    new Date(comment.created_at),
                  )}
                </time>
              </div>
              {editingId === comment.id ? (
                <div className="mt-3 grid gap-3">
                  <textarea
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    rows={4}
                    className="rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
                  />
                  <input
                    value={editingPassword}
                    onChange={(event) => setEditingPassword(event.target.value)}
                    placeholder="댓글 비밀번호"
                    type="password"
                    className="rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateComment(comment.id)}
                      className="rounded-xl bg-[#b8a2ff] px-4 py-2 text-sm font-semibold text-white"
                    >
                      수정 저장
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingContent("");
                        setEditingPassword("");
                      }}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-pink-100"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-[#6f5a7d]">
                    {comment.content}
                  </p>
                  <div className="mt-3 flex gap-3 text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingContent(comment.content);
                        setEditingPassword("");
                      }}
                      className="text-[#7c658d]"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
