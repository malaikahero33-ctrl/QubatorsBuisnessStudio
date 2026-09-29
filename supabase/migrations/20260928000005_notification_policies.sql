-- =============================================================================
-- 0005_notification_policies.sql
--
-- Closes an RLS gap that only appears once notifications actually work.
--
-- Depends on: 0004_grants.sql (table privileges must already exist, or the
-- error is "permission denied for table" and RLS is never consulted).
-- Apply with:  npm run db:push
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Why this migration exists
--
-- 0003 created read and update policies on `notifications` but no INSERT and
-- no DELETE. That looked deliberate — notifications arrive from somewhere
-- trusted — but nothing in this codebase writes them with a service-role key.
-- They are written by server actions running as the signed-in user, so the
-- missing INSERT policy made "new order" notifications impossible to create.
-- Confirmed against the live database:
--
--   POST /rest/v1/notifications
--   403  new row violates row-level security policy for table "notifications"
--
-- Both new policies are scoped to the row's own `user_id`. A user can
-- therefore create a notification addressed to themselves, which is all the
-- server actions need, and cannot create one that would appear in someone
-- else's list.
--
-- Written idempotently: `create policy if not exists` does not exist in
-- Postgres, and this file may well be pasted into the SQL Editor more than
-- once while working out why notifications were not appearing.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'own notifications insertable'
  ) then
    create policy "own notifications insertable"
      on public.notifications for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'own notifications deletable'
  ) then
    create policy "own notifications deletable"
      on public.notifications for delete
      using (user_id = auth.uid());
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Stable ordering for the unread list.
--
-- 0003's partial index is (user_id, created_at desc) WHERE read_at IS NULL,
-- which covers the "unread" query. What it does not settle is the case where
-- two notifications share a created_at — they do, when one order fires its
-- trigger and inserts two rows in the same transaction. Without a tiebreak the
-- list can reorder itself between renders.
--
-- id is a uuid, not sequential, but it is unique, and uniqueness is all a
-- tiebreak needs.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'notifications_user_created_idx'
  ) then
    create index notifications_user_created_idx
      on public.notifications (user_id, created_at desc, id desc);
  end if;
end
$$;
