export type Profile = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  location: string;
  email: string;
  github_url: string;
  linkedin_url: string;
  updated_at?: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  repo_url: string;
  featured: boolean;
  sort_order: number;
  created_at?: string;
};

export type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: boolean;
  published_at: string | null;
  created_at?: string;
};
