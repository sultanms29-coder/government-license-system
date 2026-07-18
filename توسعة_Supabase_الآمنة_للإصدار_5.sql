-- ============================================================
-- منصة العلاقات العامة والحكومية — توسعة آمنة على مشروع Supabase الحالي
-- الإصدار 5.0 / المرحلة الأولى
-- لا يحذف هذا الملف أي جدول أو بيانات أو مساحة عمل موجودة.
-- ============================================================

begin;

create table if not exists public.app_state (
  workspace_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  client_id text,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.app_state
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists revision bigint not null default 0,
  add column if not exists client_id text,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.app_state enable row level security;

drop policy if exists "anon read app_state" on public.app_state;
drop policy if exists "anon insert app_state" on public.app_state;
drop policy if exists "anon update app_state" on public.app_state;

create policy "anon read app_state"
on public.app_state for select to anon using (true);

create policy "anon insert app_state"
on public.app_state for insert to anon
with check (
  workspace_id in (
    'alandiyah-licenses',
    'alandiyah-projects',
    'alandiyah-contracts',
    'alandiyah-cases',
    'alandiyah-home',
    'alandiyah-shomoos'
  )
);

create policy "anon update app_state"
on public.app_state for update to anon
using (
  workspace_id in (
    'alandiyah-licenses',
    'alandiyah-projects',
    'alandiyah-contracts',
    'alandiyah-cases',
    'alandiyah-home',
    'alandiyah-shomoos'
  )
)
with check (
  workspace_id in (
    'alandiyah-licenses',
    'alandiyah-projects',
    'alandiyah-contracts',
    'alandiyah-cases',
    'alandiyah-home',
    'alandiyah-shomoos'
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;

-- إنشاء مساحتي العمل الجديدتين فقط إذا لم تكونا موجودتين.
insert into public.app_state (workspace_id, payload, revision, client_id, updated_by)
values
  ('alandiyah-home', '{"news":[],"gallery":[],"settings":{}}'::jsonb, 0, 'setup', 'تهيئة الإصدار 5.0'),
  ('alandiyah-shomoos', '{"branches":[],"users":[],"activityLog":[],"settings":{}}'::jsonb, 0, 'setup', 'تهيئة الإصدار 5.0')
on conflict (workspace_id) do nothing;

commit;

-- تحقق اختياري بعد التنفيذ:
select workspace_id, revision, updated_by, updated_at
from public.app_state
order by workspace_id;
