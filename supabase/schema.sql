-- 1. Replace this email with your real admin email before running the SQL.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.jwt() ->> 'email' = 'your-email@example.com';
$$;

create table if not exists public.profiles (
  id text primary key default 'main' check (id = 'main'),
  name text not null default '',
  headline text not null default '',
  bio text not null default '',
  location text not null default '',
  email text not null default '',
  github_url text not null default '',
  linkedin_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  url text not null default '',
  repo_url text not null default '',
  featured boolean not null default true,
  sort_order integer not null default 10,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.posts enable row level security;

drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles"
on public.profiles for select
using (true);

drop policy if exists "Admin can manage profiles" on public.profiles;
create policy "Admin can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects"
on public.projects for select
using (true);

drop policy if exists "Admin can manage projects" on public.projects;
create policy "Admin can manage projects"
on public.projects for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
on public.posts for select
using (published = true or public.is_admin());

drop policy if exists "Admin can manage posts" on public.posts;
create policy "Admin can manage posts"
on public.posts for all
using (public.is_admin())
with check (public.is_admin());

insert into public.profiles (
  id,
  name,
  headline,
  bio,
  location,
  email,
  github_url,
  linkedin_url
)
values (
  'main',
  '홍길동',
  '문제를 제품으로 바꾸는 프론트엔드 개발자',
  '관리자 페이지에서 이 소개 문구를 직접 수정할 수 있습니다.',
  'Seoul, Korea',
  'hello@example.com',
  'https://github.com',
  'https://linkedin.com'
)
on conflict (id) do nothing;

insert into public.projects (title, description, tags, sort_order)
values
  ('포트폴리오 CMS', '관리자 로그인 후 프로젝트와 글을 직접 관리하는 개인 사이트입니다.', array['Next.js', 'Supabase'], 1),
  ('반응형 랜딩 페이지', '모바일과 데스크톱에서 모두 읽기 좋은 포트폴리오 화면입니다.', array['Tailwind CSS', 'UI'], 2)
on conflict do nothing;

insert into public.posts (title, slug, excerpt, content, published, published_at)
values (
  '첫 번째 글',
  'first-post',
  '관리자 페이지에서 이 글을 수정하거나 새 글을 추가할 수 있습니다.',
  '이곳에는 프로젝트 회고, 학습 기록, 작업 과정을 자유롭게 작성할 수 있습니다.',
  true,
  now()
)
on conflict (slug) do nothing;
