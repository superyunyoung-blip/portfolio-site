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
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "이름, 이메일, 문의 내용을 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: name.slice(0, 120),
    email: email.slice(0, 240),
    message: message.slice(0, 4000),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
