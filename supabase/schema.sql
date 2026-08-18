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

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  trial_days integer not null check (trial_days between 1 and 365),
  max_redemptions integer not null default 1 check (max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  trial_days integer not null check (trial_days between 1 and 365),
  payment_provider text not null default 'iyzico',
  payment_reference text,
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  pro_expires_at timestamptz,
  unique (promo_code_id, user_id)
);

alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;

create policy "Admins can read promo codes"
on public.promo_codes
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can read their own promo redemptions"
on public.promo_code_redemptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists promo_codes_code_idx on public.promo_codes(code);
create index if not exists promo_codes_active_idx on public.promo_codes(active);
create index if not exists promo_code_redemptions_user_id_idx on public.promo_code_redemptions(user_id);

-- One-time hardening for older accounts:
-- Move plan claims from user-editable user metadata into server-managed app metadata.
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('plan', raw_user_meta_data ->> 'plan')
where raw_user_meta_data ? 'plan'
  and (raw_app_meta_data ->> 'plan') is null;
