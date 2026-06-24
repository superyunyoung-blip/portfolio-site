"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";
import type { Post, Profile, Project } from "@/lib/types";

const emptyProject = {
  title: "",
  description: "",
  tags: "",
  url: "",
  repo_url: "",
  featured: true,
  sort_order: 10,
};

const emptyPost = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  published: true,
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminDashboard() {
  const supabase = useMemo(
    () => (hasSupabaseEnv ? createSupabaseClient() : null),
    [],
  );
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const [email, setEmail] = useState(adminEmail ?? "");
  const [password, setPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [postForm, setPostForm] = useState(emptyPost);

  const loadContent = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const [profileResult, projectsResult, postsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", "main").single(),
      supabase
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data as Profile);
    }

    setProjects((projectsResult.data ?? []) as Project[]);
    setPosts((postsResult.data ?? []) as Post[]);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      const allowed = !adminEmail || user?.email === adminEmail;
      setIsSignedIn(Boolean(user && allowed));
      if (user && allowed) {
        void loadContent();
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const allowed = !adminEmail || session?.user.email === adminEmail;
        setIsSignedIn(Boolean(session?.user && allowed));
        if (session?.user && allowed) {
          void loadContent();
        }
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, [adminEmail, loadContent, supabase]);

  async function signIn() {
    if (!supabase) {
      return;
    }

    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`로그인 실패: ${error.message}`);
      return;
    }

    setMessage("로그인되었습니다.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setIsSignedIn(false);
  }

  async function saveProfile() {
    if (!supabase || !profile) {
      return;
    }

    const { error } = await supabase.from("profiles").upsert(profile);
    setMessage(error ? `저장 실패: ${error.message}` : "소개를 저장했습니다.");
  }

  async function addProject() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("projects").insert({
      ...projectForm,
      tags: projectForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    if (error) {
      setMessage(`프로젝트 저장 실패: ${error.message}`);
      return;
    }

    setProjectForm(emptyProject);
    setMessage("프로젝트를 추가했습니다.");
    await loadContent();
  }

  async function deleteProject(id: string) {
    if (!supabase) {
      return;
    }

    await supabase.from("projects").delete().eq("id", id);
    await loadContent();
  }

  async function addPost() {
    if (!supabase) {
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("posts").insert({
      ...postForm,
      slug: postForm.slug || toSlug(postForm.title),
      published_at: postForm.published ? now : null,
    });

    if (error) {
      setMessage(`글 저장 실패: ${error.message}`);
      return;
    }

    setPostForm(emptyPost);
    setMessage("글을 추가했습니다.");
    await loadContent();
  }

  async function deletePost(id: string) {
    if (!supabase) {
      return;
    }

    await supabase.from("posts").delete().eq("id", id);
    await loadContent();
  }

  if (!hasSupabaseEnv) {
    return (
      <SetupCard title="Supabase 연결이 필요합니다">
        <p>
          `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과
          `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣으면 관리자 로그인을 사용할 수
          있습니다.
        </p>
      </SetupCard>
    );
  }

  if (!isSignedIn) {
    return (
      <SetupCard title="관리자 로그인">
        <div className="grid gap-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            type="password"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <button
            onClick={signIn}
            className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
          >
            로그인
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </SetupCard>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight">콘텐츠 관리</h1>
        </div>
        <button onClick={signOut} className="text-sm font-medium text-slate-600">
          로그아웃
        </button>
      </div>

      {message ? (
        <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </p>
      ) : null}

      {profile ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">소개 수정</h2>
          <div className="mt-5 grid gap-3">
            {(["name", "headline", "location", "email", "github_url", "linkedin_url"] as const).map(
              (field) => (
                <input
                  key={field}
                  value={profile[field]}
                  onChange={(event) =>
                    setProfile({ ...profile, [field]: event.target.value })
                  }
                  placeholder={field}
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              ),
            )}
            <textarea
              value={profile.bio}
              onChange={(event) =>
                setProfile({ ...profile, bio: event.target.value })
              }
              placeholder="소개 문구"
              rows={5}
              className="rounded-xl border border-slate-300 px-4 py-3"
            />
            <button
              onClick={saveProfile}
              className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
            >
              소개 저장
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">프로젝트 추가</h2>
        <div className="mt-5 grid gap-3">
          <input
            value={projectForm.title}
            onChange={(event) =>
              setProjectForm({ ...projectForm, title: event.target.value })
            }
            placeholder="프로젝트 제목"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <textarea
            value={projectForm.description}
            onChange={(event) =>
              setProjectForm({
                ...projectForm,
                description: event.target.value,
              })
            }
            placeholder="설명"
            rows={3}
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={projectForm.tags}
            onChange={(event) =>
              setProjectForm({ ...projectForm, tags: event.target.value })
            }
            placeholder="태그: Next.js, Supabase"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={projectForm.url}
            onChange={(event) =>
              setProjectForm({ ...projectForm, url: event.target.value })
            }
            placeholder="사이트 주소"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <button
            onClick={addProject}
            className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
          >
            프로젝트 추가
          </button>
        </div>
        <ContentList
          items={projects.map((project) => ({
            id: project.id,
            title: project.title,
            description: project.description,
          }))}
          onDelete={deleteProject}
        />
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">글 추가</h2>
        <div className="mt-5 grid gap-3">
          <input
            value={postForm.title}
            onChange={(event) =>
              setPostForm({
                ...postForm,
                title: event.target.value,
                slug: postForm.slug || toSlug(event.target.value),
              })
            }
            placeholder="글 제목"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={postForm.slug}
            onChange={(event) =>
              setPostForm({ ...postForm, slug: toSlug(event.target.value) })
            }
            placeholder="URL 슬러그"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={postForm.excerpt}
            onChange={(event) =>
              setPostForm({ ...postForm, excerpt: event.target.value })
            }
            placeholder="요약"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <textarea
            value={postForm.content}
            onChange={(event) =>
              setPostForm({ ...postForm, content: event.target.value })
            }
            placeholder="본문"
            rows={8}
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <button
            onClick={addPost}
            className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
          >
            글 추가
          </button>
        </div>
        <ContentList
          items={posts.map((post) => ({
            id: post.id,
            title: post.title,
            description: post.excerpt,
          }))}
          onDelete={deletePost}
        />
      </section>
    </div>
  );
}

function SetupCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-4 text-slate-600">{children}</div>
    </div>
  );
}

function ContentList({
  items,
  onDelete,
}: {
  items: { id: string; title: string; description: string }[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-4"
        >
          <div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </div>
          <button
            onClick={() => onDelete(item.id)}
            className="text-sm font-medium text-red-600"
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}
