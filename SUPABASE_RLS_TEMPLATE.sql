-- TEMPLATE ONLY. Review with IT before execution.
-- Do not run against the current shared app_state design without migrating authentication.
alter table if exists public.app_state enable row level security;

-- Recommended future model: every row contains organization_id and created_by = auth.uid().
-- Example after migration:
-- create policy "authenticated read own organization"
-- on public.licenses for select to authenticated
-- using (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
-- create policy "authenticated insert own organization"
-- on public.licenses for insert to authenticated
-- with check (created_by = auth.uid() and organization_id = (auth.jwt() ->> 'organization_id')::uuid);
-- Never create an unrestricted policy for anon users in production.
