-- Prepline beta waitlist (applied to the "prepline" Supabase project on 2026-11-26).
-- The landing page inserts with the project's publishable (anon) key. Row-level
-- security has a single INSERT policy, so that key can add sign-ups but cannot read,
-- change or delete them. View sign-ups in Supabase -> Table editor -> waitlist.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  source text not null default 'landing' check (char_length(source) <= 40),
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_key on public.waitlist (email);

alter table public.waitlist enable row level security;

create policy "Anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);
