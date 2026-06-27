create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
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

alter table public.comments enable row level security;
alter table public.contact_messages enable row level security;
alter table public.page_views enable row level security;

drop policy if exists "Public can read comments" on public.comments;
create policy "Public can read comments"
on public.comments for select
using (true);

drop policy if exists "Public can create comments" on public.comments;
create policy "Public can create comments"
on public.comments for insert
with check (length(trim(author_name)) between 1 and 80 and length(trim(content)) between 1 and 2000);

drop policy if exists "Admin can delete comments" on public.comments;
create policy "Admin can delete comments"
on public.comments for delete
using (public.is_admin());

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
