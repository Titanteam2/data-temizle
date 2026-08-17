create table if not exists public.file_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.file_uploads enable row level security;

create policy "Users can read their own uploads"
on public.file_uploads
for select
using (auth.uid() = user_id);

create policy "Users can insert their own uploads"
on public.file_uploads
for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own uploads"
on public.file_uploads
for delete
using (auth.uid() = user_id);

create index if not exists file_uploads_user_id_idx on public.file_uploads(user_id);
create index if not exists file_uploads_expires_at_idx on public.file_uploads(expires_at);

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;
