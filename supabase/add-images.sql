alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.projects add column if not exists image_url text not null default '';
alter table public.posts add column if not exists image_url text not null default '';

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
