alter table public.profiles add column if not exists contact_label text not null default '연락하기';
alter table public.profiles add column if not exists github_label text not null default 'GitHub';
alter table public.profiles add column if not exists linkedin_label text not null default 'LinkedIn';
alter table public.projects add column if not exists url_label text not null default '사이트 보기';
alter table public.projects add column if not exists repo_label text not null default '코드 보기';

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.comment_secrets (
  comment_id uuid primary key references public.comments(id) on delete cascade,
  password_hash text not null
);

alter table public.comment_secrets enable row level security;

drop policy if exists "Public can create comments" on public.comments;

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
