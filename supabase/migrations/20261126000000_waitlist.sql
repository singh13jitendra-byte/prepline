-- Prepline beta waitlist.
-- The landing page inserts with the project's publishable (anon) key, so row-level
-- security allows INSERT only. Nobody can read, change or delete rows with that key;
-- view sign-ups in the Supabase dashboard (Table editor -> waitlist).

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  source text not null default 'landing' check (char_length(source) <= 40),
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_key on public.waitlist (email);

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- Belt and braces: the anon and authenticated roles get insert only.
revoke all on public.waitlist from anon, authenticated;
grant insert (email, source) on public.waitlist to anon;
