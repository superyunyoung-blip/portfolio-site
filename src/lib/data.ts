import { defaultPosts, defaultProfile, defaultProjects } from "./defaults";
import { createSupabaseClient, hasSupabaseEnv } from "./supabase";
import type { Comment, Post, Profile, Project } from "./types";

export async function getProfile(): Promise<Profile> {
  if (!hasSupabaseEnv) {
    return defaultProfile;
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", "main")
    .single();

  if (error || !data) {
    return defaultProfile;
  }

  return data as Profile;
}

export async function getProjects(): Promise<Project[]> {
  if (!hasSupabaseEnv) {
    return defaultProjects;
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return defaultProjects;
  }

  return (data as Project[]).sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return a.sort_order - b.sort_order;
  });
}

export async function getProjectById(id: string): Promise<Project | null> {
  const decodedId = decodeURIComponent(id);
  const fallbackProject =
    defaultProjects.find((project) => project.id === decodedId) ?? null;

  if (!hasSupabaseEnv) {
    return fallbackProject;
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", decodedId)
    .single();

  if (error || !data) {
    return fallbackProject;
  }

  return data as Project;
}

export async function getPublishedPosts(): Promise<Post[]> {
  if (!hasSupabaseEnv) {
    return defaultPosts;
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error || !data) {
    return defaultPosts;
  }

  return (data as Post[]).sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return (
      new Date(b.published_at ?? b.created_at ?? 0).getTime() -
      new Date(a.published_at ?? a.created_at ?? 0).getTime()
    );
  });
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const decodedSlug = decodeURIComponent(slug);
  const fallbackPost =
    defaultPosts.find(
      (post) => post.slug === decodedSlug || post.id === decodedSlug,
    ) ?? null;

  if (!hasSupabaseEnv) {
    return fallbackPost;
  }

  const supabase = createSupabaseClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      decodedSlug,
    );

  const query = supabase
    .from("posts")
    .select("*")
    .eq("published", true);

  const { data, error } = isUuid
    ? await query.eq("id", decodedSlug).single()
    : await query.eq("slug", decodedSlug).single();

  if (error || !data) {
    return fallbackPost;
  }

  return data as Post;
}

export async function getCommentsByPostId(postId: string): Promise<Comment[]> {
  if (!hasSupabaseEnv) {
    return [];
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as Comment[];
}
