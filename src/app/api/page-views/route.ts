import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!hasSupabaseEnv) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json();
  const path = String(body.path ?? "").trim();

  if (!path) {
    return NextResponse.json({ ok: true });
  }

  const headerStore = await headers();
  const supabase = createSupabaseClient();
  await supabase.from("page_views").insert({
    path: path.slice(0, 500),
    referrer: (headerStore.get("referer") ?? "").slice(0, 500),
    user_agent: (headerStore.get("user-agent") ?? "").slice(0, 500),
  });

  return NextResponse.json({ ok: true });
}
