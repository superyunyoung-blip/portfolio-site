export type Profile = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  location: string;
  email: string;
  github_url: string;
  linkedin_url: string;
  avatar_url: string;
  contact_label: string;
  github_label: string;
  linkedin_label: string;
  updated_at?: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  repo_url: string;
  image_url: string;
  url_label: string;
  repo_label: string;
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
  image_url: string;
  featured: boolean;
  published: boolean;
  published_at: string | null;
  created_at?: string;
};

export type Comment = {
  id: string;
  post_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  created_at: string;
};

export type PageView = {
  id: string;
  path: string;
  referrer: string;
  user_agent: string;
  created_at: string;
};
