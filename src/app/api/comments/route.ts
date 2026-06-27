import { NextResponse } from "next/server";
import { createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasSupabaseEnv) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const postId = String(body.postId ?? "").trim();
  const authorName = String(body.authorName ?? "").trim();
  const content = String(body.content ?? "").trim();
  const password = String(body.password ?? "");

  if (!postId || !authorName || !content || password.length < 4) {
    return NextResponse.json(
      { error: "이름, 댓글, 4자 이상의 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("create_comment_with_password", {
    p_post_id: postId,
    p_author_name: authorName.slice(0, 80),
    p_content: content.slice(0, 2000),
    p_password: password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const commentId = String(body.commentId ?? "").trim();
  const content = String(body.content ?? "").trim();
  const password = String(body.password ?? "");

  if (!commentId || !content || password.length < 4) {
    return NextResponse.json(
      { error: "댓글 내용과 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("update_comment_with_password", {
    p_comment_id: commentId,
    p_content: content.slice(0, 2000),
    p_password: password,
  });

  if (error) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 403 });
  }

  return NextResponse.json({ comment: data });
}

export async function DELETE(request: Request) {
  if (!hasSupabaseEnv) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const commentId = String(body.commentId ?? "").trim();
  const password = String(body.password ?? "");

  if (!commentId || password.length < 4) {
    return NextResponse.json(
      { error: "비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.rpc("delete_comment_with_password", {
    p_comment_id: commentId,
    p_password: password,
  });

  if (error) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
