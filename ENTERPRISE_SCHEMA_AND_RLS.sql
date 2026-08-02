-- قالب تأسيسي فقط. يُراجع ويُختبر في بيئة تجريبية قبل الإنتاج.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','manager','supervisor','coordinator','legal','viewer')),
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile self read" on public.profiles
for select using (auth.uid() = id);

create policy "admins read profiles" on public.profiles
for select using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_active));

create policy "admins manage profiles" on public.profiles
for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_active));

create policy "authorized audit read" on public.audit_logs
for select using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','manager') and p.is_active));

-- لا تمنح الواجهة صلاحية INSERT مباشرة إلى audit_logs.
-- يُفضّل الكتابة من دالة خادم SECURITY DEFINER أو Backend موثوق.
