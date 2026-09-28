-- =============================================================================
-- 0001_foundation.sql
-- Qubators Business Studio
--
-- Identity, tenancy and the shared trigger/RLS helpers everything else uses.
--
-- Depends on: Supabase's auth schema (auth.users, auth.uid()).
-- Apply with:  supabase db push
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- trigram search on names

-- -----------------------------------------------------------------------------
-- updated_at maintenance
--
-- Applied to every mutable table. Keeps "last modified" honest without
-- trusting the client to send it.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper. Sets new.updated_at to the current UTC time.';

-- -----------------------------------------------------------------------------
-- profiles
--
-- One row per auth user, created automatically on signup.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text,
  avatar_url          text,
  phone               text,
  country_code        char(2),
  onboarding_complete boolean     not null default false,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),

  constraint profiles_country_code_format
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint profiles_phone_e164
    check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$')
);

comment on table public.profiles is
  'Mirrors auth.users. Created by trigger on signup.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- businesses
--
-- A business is the tenant boundary. Every other business-scoped table
-- references this, and every RLS policy keys off it.
--
-- Money columns are *_minor: integers in the currency's minor unit.
-- UGX is zero-decimal, so 10000 means UGX 10,000. See docs/DATABASE.md.
-- -----------------------------------------------------------------------------
create table public.businesses (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete restrict,

  name               text not null check (length(btrim(name)) between 1 and 120),
  slug               text not null unique
                       check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
                       check (length(slug) between 2 and 80),
  industry           text,
  location           text,
  stage              text not null default 'idea'
                       check (stage in ('idea', 'planning', 'branding', 'launched', 'growing')),

  currency           char(3) not null default 'UGX'
                       check (currency in ('UGX', 'KES', 'TZS', 'RWF', 'USD', 'GBP', 'EUR')),
  locale             text not null default 'en-UG',
  timezone           text not null default 'Africa/Kampala',

  logo_url           text,
  target_customer    text,
  price_range_minor  bigint check (price_range_minor is null or price_range_minor >= 0),
  price_range_maxor  bigint check (price_range_maxor is null or price_range_maxor >= 0),
  brand_personality  text,
  goals              text,

  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now()),

  constraint businesses_price_range_ordered
    check (
      price_range_minor is null
      or price_range_maxor is null
      or price_range_minor <= price_range_maxor
    )
);

comment on table public.businesses is
  'Tenant boundary. All business-scoped tables reference this and all RLS keys off it.';

create index businesses_owner_id_idx   on public.businesses (owner_id);
create index businesses_stage_idx      on public.businesses (stage);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- business_settings
--
-- One-to-one with businesses. Non-AI preferences only: notification flags,
-- report cadence, onboarding state, feature toggles.
-- -----------------------------------------------------------------------------
create table public.business_settings (
  business_id           uuid primary key references public.businesses (id) on delete cascade,

  notify_new_order      boolean not null default true,
  notify_consultation   boolean not null default true,
  weekly_digest         boolean not null default false,

  onboarding_step       text not null default 'create_business'
                          check (onboarding_step in (
                            'create_business', 'describe_idea', 'generate_plan',
                            'build_brand', 'add_product', 'first_customer', 'done'
                          )),
  features              jsonb not null default '{}'::jsonb,

  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now()),

  constraint business_settings_features_is_object
    check (jsonb_typeof(features) = 'object')
);

create trigger business_settings_set_updated_at
  before update on public.business_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- business_members
--
-- Added on day one even though the MVP is owner-only (ADR-8). Adding a second
-- user later means backfilling this table and revisiting every RLS policy.
--
-- SECURITY DEFINER so RLS policies can read it without recursing into its own
-- policy.
-- -----------------------------------------------------------------------------
create table public.business_members (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'owner'
                check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_at   timestamptz not null default timezone('utc', now()),
  joined_at    timestamptz,

  primary key (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);

comment on table public.business_members is
  'Who may access a business. MVP uses owner-only, but RLS reads this table.';

-- -----------------------------------------------------------------------------
-- Ownership bootstrap
--
-- Every new business gets an owner membership row and default settings,
-- in one transaction. Without this the owner has no RLS access at all.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, user_id, role, joined_at)
  values (new.id, new.owner_id, 'owner', timezone('utc', now()));

  insert into public.business_settings (business_id)
  values (new.id);

  return new;
end;
$$;

create trigger businesses_bootstrap
  after insert on public.businesses
  for each row execute function public.handle_new_business();

-- -----------------------------------------------------------------------------
-- New auth user -> profile
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Membership lookup used by every RLS policy
--
-- SECURITY DEFINER deliberately: without it, a policy on business_members
-- would need to read business_members, which is infinite recursion.
-- -----------------------------------------------------------------------------
create or replace function public.is_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = target_business_id
      and m.user_id    = auth.uid()
  );
$$;

comment on function public.is_member(uuid) is
  'True when the calling user belongs to the business. Used by all RLS policies.';

create or replace function public.member_role(target_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.business_members m
  where m.business_id = target_business_id
    and m.user_id    = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_members  enable row level security;

create policy "own profile readable"
  on public.profiles for select
  using (id = auth.uid());

create policy "own profile writable"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "member businesses readable"
  on public.businesses for select
  using (public.is_member(id));

create policy "owner updates business"
  on public.businesses for update
  using (public.member_role(id) in ('owner', 'admin'))
  with check (public.member_role(id) in ('owner', 'admin'));

create policy "authenticated creates business"
  on public.businesses for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "owner deletes business"
  on public.businesses for delete
  using (public.member_role(id) = 'owner');

create policy "settings readable by member"
  on public.business_settings for select
  using (public.is_member(business_id));

create policy "settings writable by owner"
  on public.business_settings for update
  using (public.member_role(business_id) in ('owner', 'admin'))
  with check (public.member_role(business_id) in ('owner', 'admin'));

-- Members can read their own membership rows.
create policy "own memberships readable"
  on public.business_members for select
  using (user_id = auth.uid() or public.is_member(business_id));
