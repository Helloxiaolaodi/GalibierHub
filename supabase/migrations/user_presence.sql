create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'away', 'busy')),
  updated_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

drop policy if exists "users can read presence" on public.user_presence;
create policy "users can read presence"
  on public.user_presence
  for select
  to authenticated
  using (true);

drop policy if exists "users can update own presence" on public.user_presence;
create policy "users can update own presence"
  on public.user_presence
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.user_presence;
  end if;
exception
  when duplicate_object then null;
end $$;
