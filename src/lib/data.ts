import { defaultPosts, defaultProfile, defaultProjects } from "./defaults";
import { createSupabaseClient, hasSupabaseEnv } from "./supabase";
import type { Post, Profile, Project } from "./types";

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

  return data as Project[];
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

  return data as Post[];
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const fallbackPost = defaultPosts.find((post) => post.slug === slug) ?? null;

  if (!hasSupabaseEnv) {
    return fallbackPost;
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error || !data) {
    return fallbackPost;
  }

  return data as Post;
}
