-- 1. This email is allowed to edit content after logging in.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.jwt() ->> 'email' = 'superyunyoung@gmail.com';
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
  avatar_url text not null default '',
  contact_label text not null default '연락하기',
  github_label text not null default 'GitHub',
  linkedin_label text not null default 'LinkedIn',
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  url text not null default '',
  repo_url text not null default '',
  image_url text not null default '',
  url_label text not null default '사이트 보기',
  repo_label text not null default '코드 보기',
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
  image_url text not null default '',
  featured boolean not null default false,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comment_secrets (
  comment_id uuid primary key references public.comments(id) on delete cascade,
  password_hash text not null
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.comment_secrets enable row level security;
alter table public.contact_messages enable row level security;
alter table public.page_views enable row level security;

alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists contact_label text not null default '연락하기';
alter table public.profiles add column if not exists github_label text not null default 'GitHub';
alter table public.profiles add column if not exists linkedin_label text not null default 'LinkedIn';
alter table public.projects add column if not exists image_url text not null default '';
alter table public.projects add column if not exists url_label text not null default '사이트 보기';
alter table public.projects add column if not exists repo_label text not null default '코드 보기';
alter table public.posts add column if not exists image_url text not null default '';
alter table public.posts add column if not exists featured boolean not null default false;

create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portfolio-images',
  'portfolio-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

drop policy if exists "Public can read portfolio images" on storage.objects;
create policy "Public can read portfolio images"
on storage.objects for select
using (bucket_id = 'portfolio-images');

drop policy if exists "Admin can upload portfolio images" on storage.objects;
create policy "Admin can upload portfolio images"
on storage.objects for insert
with check (bucket_id = 'portfolio-images' and public.is_admin());

drop policy if exists "Admin can update portfolio images" on storage.objects;
create policy "Admin can update portfolio images"
on storage.objects for update
using (bucket_id = 'portfolio-images' and public.is_admin())
with check (bucket_id = 'portfolio-images' and public.is_admin());

drop policy if exists "Admin can delete portfolio images" on storage.objects;
create policy "Admin can delete portfolio images"
on storage.objects for delete
using (bucket_id = 'portfolio-images' and public.is_admin());

drop policy if exists "Public can read comments" on public.comments;
create policy "Public can read comments"
on public.comments for select
using (true);

drop policy if exists "Public can create comments" on public.comments;

drop policy if exists "Admin can delete comments" on public.comments;
create policy "Admin can delete comments"
on public.comments for delete
using (public.is_admin());

drop policy if exists "Admin can read comment secrets" on public.comment_secrets;
create policy "Admin can read comment secrets"
on public.comment_secrets for select
using (public.is_admin());

create or replace function public.create_comment_with_password(
  p_post_id uuid,
  p_author_name text,
  p_content text,
  p_password text
)
returns public.comments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_comment public.comments;
begin
  if length(trim(p_author_name)) < 1
    or length(trim(p_content)) < 1
    or length(p_password) < 4 then
    raise exception 'invalid_comment';
  end if;

  insert into public.comments (post_id, author_name, content)
  values (p_post_id, left(trim(p_author_name), 80), left(trim(p_content), 2000))
  returning * into new_comment;

  insert into public.comment_secrets (comment_id, password_hash)
  values (new_comment.id, crypt(p_password, gen_salt('bf')));

  return new_comment;
end;
$$;

create or replace function public.update_comment_with_password(
  p_comment_id uuid,
  p_content text,
  p_password text
)
returns public.comments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  saved_hash text;
  updated_comment public.comments;
begin
  select password_hash into saved_hash
  from public.comment_secrets
  where comment_id = p_comment_id;

  if saved_hash is null or crypt(p_password, saved_hash) <> saved_hash then
    raise exception 'invalid_password';
  end if;

  update public.comments
  set content = left(trim(p_content), 2000)
  where id = p_comment_id
  returning * into updated_comment;

  return updated_comment;
end;
$$;

create or replace function public.delete_comment_with_password(
  p_comment_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  saved_hash text;
begin
  select password_hash into saved_hash
  from public.comment_secrets
  where comment_id = p_comment_id;

  if saved_hash is null or crypt(p_password, saved_hash) <> saved_hash then
    raise exception 'invalid_password';
  end if;

  delete from public.comments where id = p_comment_id;
end;
$$;

grant execute on function public.create_comment_with_password(uuid, text, text, text) to anon, authenticated;
grant execute on function public.update_comment_with_password(uuid, text, text) to anon, authenticated;
grant execute on function public.delete_comment_with_password(uuid, text) to anon, authenticated;

drop policy if exists "Public can create contact messages" on public.contact_messages;
create policy "Public can create contact messages"
on public.contact_messages for insert
with check (length(trim(name)) between 1 and 120 and length(trim(message)) between 1 and 4000);

drop policy if exists "Admin can manage contact messages" on public.contact_messages;
create policy "Admin can manage contact messages"
on public.contact_messages for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can create page views" on public.page_views;
create policy "Public can create page views"
on public.page_views for insert
with check (length(trim(path)) between 1 and 500);

drop policy if exists "Admin can read page views" on public.page_views;
create policy "Admin can read page views"
on public.page_views for select
using (public.is_admin());

insert into public.profiles (
  id,
  name,
  headline,
  bio,
  location,
  email,
  github_url,
  linkedin_url,
  avatar_url,
  contact_label,
  github_label,
  linkedin_label
)
values (
  'main',
  '홍길동',
  '문제를 제품으로 바꾸는 프론트엔드 개발자',
  '관리자 페이지에서 이 소개 문구를 직접 수정할 수 있습니다.',
  'Seoul, Korea',
  'hello@example.com',
  'https://github.com',
  'https://linkedin.com',
  '',
  '연락하기',
  'GitHub',
  'LinkedIn'
)
on conflict (id) do nothing;

insert into public.projects (title, description, tags, image_url, url_label, repo_label, sort_order)
values
  ('포트폴리오 CMS', '관리자 로그인 후 프로젝트와 글을 직접 관리하는 개인 사이트입니다.', array['Next.js', 'Supabase'], '', '사이트 보기', '코드 보기', 1),
  ('반응형 랜딩 페이지', '모바일과 데스크톱에서 모두 읽기 좋은 포트폴리오 화면입니다.', array['Tailwind CSS', 'UI'], '', '사이트 보기', '코드 보기', 2)
on conflict do nothing;

insert into public.posts (title, slug, excerpt, content, image_url, featured, published, published_at)
values (
  '첫 번째 글',
  'first-post',
  '관리자 페이지에서 이 글을 수정하거나 새 글을 추가할 수 있습니다.',
  '이곳에는 프로젝트 회고, 학습 기록, 작업 과정을 자유롭게 작성할 수 있습니다.',
  '',
  true,
  true,
  now()
)
on conflict (slug) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'game-images',
  'game-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.game_content (
  id text primary key default 'main' check (id = 'main'),
  background_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.game_characters (
  id text primary key,
  name text not null,
  personality text not null default '',
  personality_tag text not null default 'balanced',
  lift_dialogue text not null default '내려줘!',
  sd_image_url text not null default '',
  talk_image_url text not null default '',
  dialogues text[] not null default '{}',
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_character_specials (
  character_id text not null references public.game_characters(id) on delete cascade,
  threshold integer not null check (threshold in (20, 40, 60, 80, 100)),
  dialogue text not null default '',
  image_url text not null default '',
  primary key (character_id, threshold)
);

create table if not exists public.game_character_talk_events (
  id uuid primary key default gen_random_uuid(),
  character_id text not null references public.game_characters(id) on delete cascade,
  prompt text not null default '',
  image_url text not null default '',
  choice1_text text not null default '',
  choice1_response text not null default '',
  choice1_affection integer not null default 3,
  choice2_text text not null default '',
  choice2_response text not null default '',
  choice2_affection integer not null default 3,
  choice3_text text not null default '',
  choice3_response text not null default '',
  choice3_affection integer not null default 3,
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_character_id text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.game_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null references public.game_characters(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

alter table public.game_content enable row level security;
alter table public.game_characters enable row level security;
alter table public.game_character_specials enable row level security;
alter table public.game_character_talk_events enable row level security;
alter table public.game_user_state enable row level security;
alter table public.game_progress enable row level security;

drop policy if exists "Public can read game content" on public.game_content;
create policy "Public can read game content"
on public.game_content for select
using (true);

drop policy if exists "Admin can manage game content" on public.game_content;
create policy "Admin can manage game content"
on public.game_content for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read game characters" on public.game_characters;
create policy "Public can read game characters"
on public.game_characters for select
using (true);

drop policy if exists "Admin can manage game characters" on public.game_characters;
create policy "Admin can manage game characters"
on public.game_characters for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read game specials" on public.game_character_specials;
create policy "Public can read game specials"
on public.game_character_specials for select
using (true);

drop policy if exists "Admin can manage game specials" on public.game_character_specials;
create policy "Admin can manage game specials"
on public.game_character_specials for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read game talk events" on public.game_character_talk_events;
create policy "Public can read game talk events"
on public.game_character_talk_events for select
using (true);

drop policy if exists "Admin can manage game talk events" on public.game_character_talk_events;
create policy "Admin can manage game talk events"
on public.game_character_talk_events for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own game state" on public.game_user_state;
create policy "Users can read own game state"
on public.game_user_state for select
using (auth.uid() = user_id);

drop policy if exists "Users can upsert own game state" on public.game_user_state;
create policy "Users can upsert own game state"
on public.game_user_state for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own game state" on public.game_user_state;
create policy "Users can update own game state"
on public.game_user_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own game progress" on public.game_progress;
create policy "Users can read own game progress"
on public.game_progress for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own game progress" on public.game_progress;
create policy "Users can insert own game progress"
on public.game_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own game progress" on public.game_progress;
create policy "Users can update own game progress"
on public.game_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public can read game images" on storage.objects;
create policy "Public can read game images"
on storage.objects for select
using (bucket_id = 'game-images');

drop policy if exists "Admin can upload game images" on storage.objects;
create policy "Admin can upload game images"
on storage.objects for insert
with check (bucket_id = 'game-images' and public.is_admin());

drop policy if exists "Admin can update game images" on storage.objects;
create policy "Admin can update game images"
on storage.objects for update
using (bucket_id = 'game-images' and public.is_admin())
with check (bucket_id = 'game-images' and public.is_admin());

drop policy if exists "Admin can delete game images" on storage.objects;
create policy "Admin can delete game images"
on storage.objects for delete
using (bucket_id = 'game-images' and public.is_admin());

insert into public.game_content (id, background_url)
values ('main', '')
on conflict (id) do nothing;

insert into public.game_characters (
  id,
  name,
  personality,
  personality_tag,
  lift_dialogue,
  sd_image_url,
  talk_image_url,
  dialogues,
  sort_order
)
values (
  'mongshil',
  '몽실이',
  '호기심이 많고 칭찬에 약한 다정한 성격',
  'balanced',
  '우와앗, 내려줘!',
  '',
  '',
  array[
    '오늘은 어떤 하루였어? 나는 네가 와줘서 기뻐.',
    '밥도 먹고 씻고 이야기하면 호감도가 쑥쑥 올라가!',
    '언젠가 더 멋진 모습으로 성장할 수 있을 것 같아.'
  ],
  1
)
on conflict (id) do nothing;

insert into public.game_character_specials (character_id, threshold, dialogue, image_url)
values
  ('mongshil', 20, '호감도 20%가 되었어. 앞으로도 곁에 있어줘!', ''),
  ('mongshil', 40, '호감도 40%라니, 이제 네가 오는 시간이 기다려져.', ''),
  ('mongshil', 60, '호감도 60%야. 너랑 있으면 마음이 편해져.', ''),
  ('mongshil', 80, '호감도 80%까지 와줬구나. 정말 고마워.', ''),
  ('mongshil', 100, '호감도 100%! 이제 우리는 최고의 파트너야.', '')
on conflict (character_id, threshold) do nothing;

insert into public.game_character_talk_events (
  character_id,
  prompt,
  image_url,
  choice1_text,
  choice1_response,
  choice1_affection,
  choice2_text,
  choice2_response,
  choice2_affection,
  choice3_text,
  choice3_response,
  choice3_affection,
  sort_order
)
values (
  'mongshil',
  '갑자기 몽실이가 조심스럽게 말을 걸어왔다. 뭐라고 답할까?',
  '',
  '오늘도 귀엽다고 말한다',
  '정말? 그런 말 들으면 부끄러워.',
  8,
  '같이 산책하자고 한다',
  '좋아! 네가 같이 가주면 어디든 좋아.',
  6,
  '조금 놀려본다',
  '흥, 그래도 네가 싫지는 않아.',
  3,
  1
)
on conflict do nothing;
