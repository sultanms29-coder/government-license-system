-- ينفذ مرة واحدة فقط داخل Supabase SQL Editor
create table if not exists public.app_state (
  workspace_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  client_id text,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "anon read app_state" on public.app_state;
drop policy if exists "anon insert app_state" on public.app_state;
drop policy if exists "anon update app_state" on public.app_state;

create policy "anon read app_state"
on public.app_state for select to anon using (true);

create policy "anon insert app_state"
on public.app_state for insert to anon with check (true);

create policy "anon update app_state"
on public.app_state for update to anon using (true) with check (true);

alter publication supabase_realtime add table public.app_state;
