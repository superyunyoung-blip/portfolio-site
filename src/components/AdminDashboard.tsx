"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";
import type {
  Comment,
  ContactMessage,
  PageView,
  Post,
  Profile,
  Project,
} from "@/lib/types";

const emptyProject = {
  title: "",
  description: "",
  tags: "",
  url: "",
  repo_url: "",
  image_url: "",
  url_label: "사이트 보기",
  repo_label: "코드 보기",
  featured: true,
  sort_order: 10,
};

const emptyPost = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image_url: "",
  featured: false,
  published: true,
};

function toSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `post-${Date.now()}`;
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [postForm, setPostForm] = useState(emptyPost);
  const [isUploading, setIsUploading] = useState(false);

  const loadContent = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const [
      profileResult,
      projectsResult,
      postsResult,
      commentsResult,
      contactMessagesResult,
      pageViewsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", "main").single(),
      supabase
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("page_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data as Profile);
    }

    setProjects((projectsResult.data ?? []) as Project[]);
    setPosts((postsResult.data ?? []) as Post[]);
    setComments((commentsResult.data ?? []) as Comment[]);
    setContactMessages(
      (contactMessagesResult.data ?? []) as ContactMessage[],
    );
    setPageViews((pageViewsResult.data ?? []) as PageView[]);
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

  async function uploadImage(file: File, folder: string) {
    if (!supabase) {
      return null;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 업로드할 수 있습니다.");
      return null;
    }

    setIsUploading(true);
    setMessage("이미지를 업로드하는 중입니다.");

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("portfolio-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    setIsUploading(false);

    if (error) {
      setMessage(`이미지 업로드 실패: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage
      .from("portfolio-images")
      .getPublicUrl(path);

    setMessage("이미지 업로드가 완료되었습니다. 저장 버튼을 눌러 반영하세요.");
    return data.publicUrl;
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

  async function updateProject(project: Project) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("projects")
      .update({
        title: project.title,
        description: project.description,
        tags: project.tags,
        url: project.url,
        repo_url: project.repo_url,
        image_url: project.image_url,
        url_label: project.url_label,
        repo_label: project.repo_label,
        featured: project.featured,
        sort_order: project.sort_order,
      })
      .eq("id", project.id);

    setMessage(
      error ? `프로젝트 수정 실패: ${error.message}` : "프로젝트를 수정했습니다.",
    );
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

  async function updatePost(post: Post) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("posts")
      .update({
        title: post.title,
        slug: post.slug || toSlug(post.title),
        excerpt: post.excerpt,
        content: post.content,
        image_url: post.image_url,
        featured: post.featured,
        published: post.published,
        published_at:
          post.published && !post.published_at
            ? new Date().toISOString()
            : post.published_at,
      })
      .eq("id", post.id);

    setMessage(error ? `글 수정 실패: ${error.message}` : "글을 수정했습니다.");
    await loadContent();
  }

  async function deleteComment(id: string) {
    if (!supabase) {
      return;
    }

    await supabase.from("comments").delete().eq("id", id);
    await loadContent();
  }

  async function toggleContactMessage(messageItem: ContactMessage) {
    if (!supabase) {
      return;
    }

    await supabase
      .from("contact_messages")
      .update({ handled: !messageItem.handled })
      .eq("id", messageItem.id);
    await loadContent();
  }

  const uniquePaths = new Set(pageViews.map((view) => view.path)).size;
  const today = new Date().toISOString().slice(0, 10);
  const todayViews = pageViews.filter((view) =>
    view.created_at.startsWith(today),
  ).length;

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
            className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white"
          >
            로그인
          </button>
          {message ? <p className="text-sm text-[#6f5a7d]">{message}</p> : null}
        </div>
      </SetupCard>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#9f7aea]">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight">콘텐츠 관리</h1>
        </div>
        <button onClick={signOut} className="text-sm font-medium text-[#7c658d]">
          로그아웃
        </button>
      </div>

      {message ? (
        <p className="rounded-xl bg-[#e8dcff] px-4 py-3 text-sm text-[#6b4bb0]">
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="총 방문 기록" value={pageViews.length} />
        <StatCard label="오늘 방문 기록" value={todayViews} />
        <StatCard label="방문한 페이지" value={uniquePaths} />
        <StatCard
          label="미처리 문의"
          value={contactMessages.filter((item) => !item.handled).length}
        />
      </section>

      {profile ? (
        <section className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100">
          <h2 className="text-xl font-semibold">소개 수정</h2>
          <div className="mt-5 grid gap-3">
            <ImageUploadField
              currentUrl={profile.avatar_url}
              disabled={isUploading}
              label="프로필 사진"
              onUpload={async (file) => {
                const url = await uploadImage(file, "profile");
                if (url) {
                  setProfile({ ...profile, avatar_url: url });
                }
              }}
            />
            {(["name", "headline", "location", "email", "github_url", "linkedin_url", "contact_label", "github_label", "linkedin_label"] as const).map(
              (field) => (
                <input
                  key={field}
                  value={profile[field] ?? ""}
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
              className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white"
            >
              소개 저장
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100">
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
          <input
            value={projectForm.url_label}
            onChange={(event) =>
              setProjectForm({ ...projectForm, url_label: event.target.value })
            }
            placeholder="사이트 버튼 이름"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={projectForm.repo_url}
            onChange={(event) =>
              setProjectForm({ ...projectForm, repo_url: event.target.value })
            }
            placeholder="코드 저장소 주소"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={projectForm.repo_label}
            onChange={(event) =>
              setProjectForm({ ...projectForm, repo_label: event.target.value })
            }
            placeholder="코드 버튼 이름"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <ImageUploadField
            currentUrl={projectForm.image_url}
            disabled={isUploading}
            label="프로젝트 대표 이미지"
            onUpload={async (file) => {
              const url = await uploadImage(file, "projects");
              if (url) {
                setProjectForm({ ...projectForm, image_url: url });
              }
            }}
          />
          <button
            onClick={addProject}
            className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white"
          >
            프로젝트 추가
          </button>
        </div>
        <EditableProjectList
          disabled={isUploading}
          projects={projects}
          setProjects={setProjects}
          onDelete={deleteProject}
          onSave={updateProject}
          onUpload={async (project, file) => {
            const url = await uploadImage(file, "projects");
            if (url) {
              setProjects(
                projects.map((item) =>
                  item.id === project.id ? { ...item, image_url: url } : item,
                ),
              );
            }
          }}
        />
      </section>

      <section className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100">
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
          <ImageUploadField
            currentUrl={postForm.image_url}
            disabled={isUploading}
            label="글 대표 이미지"
            onUpload={async (file) => {
              const url = await uploadImage(file, "posts");
              if (url) {
                setPostForm({ ...postForm, image_url: url });
              }
            }}
          />
          <label className="flex items-center gap-2 text-sm text-[#6f5a7d]">
            <input
              type="checkbox"
              checked={postForm.featured}
              onChange={(event) =>
                setPostForm({ ...postForm, featured: event.target.checked })
              }
            />
            대표 글
          </label>
          <button
            onClick={addPost}
            className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white"
          >
            글 추가
          </button>
        </div>
        <EditablePostList
          disabled={isUploading}
          posts={posts}
          setPosts={setPosts}
          onDelete={deletePost}
          onSave={updatePost}
          onUpload={async (post, file) => {
            const url = await uploadImage(file, "posts");
            if (url) {
              setPosts(
                posts.map((item) =>
                  item.id === post.id ? { ...item, image_url: url } : item,
                ),
              );
            }
          }}
        />
      </section>

      <section className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100">
        <h2 className="text-xl font-semibold">문의 목록</h2>
        <div className="mt-5 grid gap-3">
          {contactMessages.length === 0 ? (
            <p className="text-sm text-slate-500">아직 문의가 없습니다.</p>
          ) : (
            contactMessages.map((item) => (
              <article key={item.id} className="rounded-xl bg-[#fff7fb] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-[#6f5a7d]">{item.email}</p>
                  </div>
                  <button
                    onClick={() => toggleContactMessage(item)}
                    className="rounded-full bg-white/80 px-3 py-1 text-sm font-medium ring-1 ring-pink-100"
                  >
                    {item.handled ? "처리 완료" : "미처리"}
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-[#6f5a7d]">
                  {item.message}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100">
        <h2 className="text-xl font-semibold">최근 댓글</h2>
        <div className="mt-5 grid gap-3">
          {comments.length === 0 ? (
            <p className="text-sm text-slate-500">아직 댓글이 없습니다.</p>
          ) : (
            comments.map((comment) => (
              <article
                key={comment.id}
                className="flex items-start justify-between gap-4 rounded-xl bg-[#fff7fb] p-4"
              >
                <div>
                  <h3 className="font-semibold">{comment.author_name}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#6f5a7d]">
                    {comment.content}
                  </p>
                </div>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-sm font-medium text-red-600"
                >
                  삭제
                </button>
              </article>
            ))
          )}
        </div>
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
    <div className="rounded-2xl bg-[#fffdf7] p-6 shadow-sm ring-1 ring-pink-100">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-4 text-[#6f5a7d]">{children}</div>
    </div>
  );
}

function ImageUploadField({
  currentUrl,
  disabled,
  label,
  onUpload,
}: {
  currentUrl: string;
  disabled: boolean;
  label: string;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-4">
      <label className="block text-sm font-semibold text-[#6f5a7d]">
        {label}
      </label>
      {currentUrl ? (
        <Image
          src={currentUrl}
          alt={label}
          width={800}
          height={320}
          className="mt-3 h-40 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mt-3 flex h-32 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
          아직 이미지가 없습니다.
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void onUpload(file);
          }
          event.target.value = "";
        }}
        className="mt-3 block w-full text-sm text-[#6f5a7d] file:mr-4 file:rounded-full file:border-0 file:bg-[#b8a2ff] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#fffdf7] p-5 shadow-sm ring-1 ring-pink-100">
      <p className="text-sm text-[#8a7398]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function EditableProjectList({
  disabled,
  projects,
  setProjects,
  onDelete,
  onSave,
  onUpload,
}: {
  disabled: boolean;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  onDelete: (id: string) => void;
  onSave: (project: Project) => void;
  onUpload: (project: Project, file: File) => Promise<void>;
}) {
  return (
    <div className="mt-8 grid gap-4">
      <h3 className="font-semibold">기존 프로젝트 수정</h3>
      {projects.map((project) => (
        <article key={project.id} className="grid gap-3 rounded-xl bg-[#fff7fb] p-4">
          <input
            value={project.title}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? { ...item, title: event.target.value }
                    : item,
                ),
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <textarea
            value={project.description}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? { ...item, description: event.target.value }
                    : item,
                ),
              )
            }
            rows={3}
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={project.tags.join(", ")}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? {
                        ...item,
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      }
                    : item,
                ),
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={project.url}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? { ...item, url: event.target.value }
                    : item,
                ),
              )
            }
            placeholder="사이트 주소"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={project.url_label ?? "사이트 보기"}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? { ...item, url_label: event.target.value }
                    : item,
                ),
              )
            }
            placeholder="사이트 버튼 이름"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={project.repo_url}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? { ...item, repo_url: event.target.value }
                    : item,
                ),
              )
            }
            placeholder="코드 저장소 주소"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={project.repo_label ?? "코드 보기"}
            onChange={(event) =>
              setProjects((items) =>
                items.map((item) =>
                  item.id === project.id
                    ? { ...item, repo_label: event.target.value }
                    : item,
                ),
              )
            }
            placeholder="코드 버튼 이름"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <ImageUploadField
            currentUrl={project.image_url}
            disabled={disabled}
            label="대표 이미지 교체"
            onUpload={(file) => onUpload(project, file)}
          />
          <label className="flex items-center gap-2 text-sm text-[#6f5a7d]">
            <input
              type="checkbox"
              checked={project.featured}
              onChange={(event) =>
                setProjects((items) =>
                  items.map((item) =>
                    item.id === project.id
                      ? { ...item, featured: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            대표 프로젝트
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onSave(project)}
              className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white"
            >
              저장
            </button>
            <button
              onClick={() => onDelete(project.id)}
              className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700"
            >
              삭제
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function EditablePostList({
  disabled,
  posts,
  setPosts,
  onDelete,
  onSave,
  onUpload,
}: {
  disabled: boolean;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  onDelete: (id: string) => void;
  onSave: (post: Post) => void;
  onUpload: (post: Post, file: File) => Promise<void>;
}) {
  return (
    <div className="mt-8 grid gap-4">
      <h3 className="font-semibold">기존 글 수정</h3>
      {posts.map((post) => (
        <article key={post.id} className="grid gap-3 rounded-xl bg-[#fff7fb] p-4">
          <input
            value={post.title}
            onChange={(event) =>
              setPosts((items) =>
                items.map((item) =>
                  item.id === post.id
                    ? { ...item, title: event.target.value }
                    : item,
                ),
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={post.slug}
            onChange={(event) =>
              setPosts((items) =>
                items.map((item) =>
                  item.id === post.id
                    ? { ...item, slug: toSlug(event.target.value) }
                    : item,
                ),
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={post.excerpt}
            onChange={(event) =>
              setPosts((items) =>
                items.map((item) =>
                  item.id === post.id
                    ? { ...item, excerpt: event.target.value }
                    : item,
                ),
              )
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <textarea
            value={post.content}
            onChange={(event) =>
              setPosts((items) =>
                items.map((item) =>
                  item.id === post.id
                    ? { ...item, content: event.target.value }
                    : item,
                ),
              )
            }
            rows={6}
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <ImageUploadField
            currentUrl={post.image_url}
            disabled={disabled}
            label="대표 이미지 교체"
            onUpload={(file) => onUpload(post, file)}
          />
          <label className="flex items-center gap-2 text-sm text-[#6f5a7d]">
            <input
              type="checkbox"
              checked={post.published}
              onChange={(event) =>
                setPosts((items) =>
                  items.map((item) =>
                    item.id === post.id
                      ? { ...item, published: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            공개 글
          </label>
          <label className="flex items-center gap-2 text-sm text-[#6f5a7d]">
            <input
              type="checkbox"
              checked={Boolean(post.featured)}
              onChange={(event) =>
                setPosts((items) =>
                  items.map((item) =>
                    item.id === post.id
                      ? { ...item, featured: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            대표 글
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onSave(post)}
              className="rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white"
            >
              저장
            </button>
          <button
              onClick={() => onDelete(post.id)}
              className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700"
          >
            삭제
          </button>
          </div>
        </article>
      ))}
    </div>
  );
}
