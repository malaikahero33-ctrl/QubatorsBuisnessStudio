-- =============================================================================
-- 0004_grants.sql
-- Qubators Business Studio
--
-- Table and function privileges for the API roles.
--
-- Migrations 0001-0003 created tables and attached RLS policies but never
-- GRANTed anything. Supabase's automatic grants only apply to objects created
-- by the platform's own role, so tables created by a direct connection got no
-- privileges at all. The result was:
--
--   42501  permission denied for table businesses
--   hint:  GRANT SELECT ON public.businesses TO authenticated
--
-- RLS is never even consulted when a table privilege is missing, so the whole
-- 42-policy security model was inert. Every read and write returned 403.
--
-- Two halves, both required:
--   1. grant on what already exists
--   2. ALTER DEFAULT PRIVILEGES, so tables created by later migrations are
--      granted automatically and this file never has to be revisited
--
-- anon is granted nothing on purpose. Public tables here are all tenant data;
-- unauthenticated requests should be refused by the database, not by the
-- application layer that might be bypassed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. existing tables and sequences
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      t.relname
    );
  end loop;

  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
  loop
    execute format(
      'grant usage, select on public.%I to authenticated',
      t.relname
    );
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. helper functions used by the RLS policies
--
-- Policies call is_member() and member_role() as the invoking role, so
-- `authenticated` needs EXECUTE on them. SECURITY DEFINER then runs them as
-- the owner, which is what lets them read business_members without recursing
-- back into the policies that call them.
-- -----------------------------------------------------------------------------
grant execute on all functions in schema public to authenticated;
grant usage on schema public to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. future tables
--
-- Without this, migration 0005 would recreate the identical 403. Default
-- privileges apply to every table created by this role from now on.
-- -----------------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
