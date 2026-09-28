-- =============================================================================
-- 0003_growth.sql
-- Qubators Business Studio
--
-- Finance, campaigns, tasks, AI, brand assets, business plans, notifications
-- and subscriptions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- transactions
--
-- Sign is carried by `type`, never by the number. A sum cannot then silently
-- mix directions. amount_minor must be positive.
-- -----------------------------------------------------------------------------
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  customer_id      uuid references public.customers (id) on delete set null,
  order_id         uuid references public.orders (id) on delete set null,

  type             text not null check (type in ('income', 'expense')),
  amount_minor     bigint not null check (amount_minor > 0),
  currency         char(3) not null default 'UGX'
                     check (currency in ('UGX', 'KES', 'TZS', 'RWF', 'USD', 'GBP', 'EUR')),

  category         text,
  description      text,
  occurred_at      timestamptz not null default timezone('utc', now()),
  recorded_by      uuid references public.profiles (id) on delete set null,

  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

comment on table public.transactions is
  'Income and expenses. Direction lives in `type`; amount_minor is always positive.';

create index transactions_business_id_idx on public.transactions (business_id);
create index transactions_business_date_idx on public.transactions (business_id, occurred_at desc);
create index transactions_customer_id_idx  on public.transactions (customer_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- expenses
--
-- Separate from transactions because expense reporting needs different fields.
-- -----------------------------------------------------------------------------
create table public.expenses (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,

  vendor           text,
  description      text not null check (length(btrim(description)) between 1 and 300),
  category         text,

  amount_minor     bigint not null check (amount_minor > 0),
  currency         char(3) not null default 'UGX'
                     check (currency in ('UGX', 'KES', 'TZS', 'RWF', 'USD', 'GBP', 'EUR')),

  receipt_url      text,
  is_recurring     boolean not null default false,
  recurrence_rule  text,
  occurred_on      date not null default current_date,

  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),

  constraint expenses_recurring_needs_rule
    check (not is_recurring or recurrence_rule is not null)
);

create index expenses_business_id_idx  on public.expenses (business_id);
create index expenses_business_date_idx on public.expenses (business_id, occurred_on desc);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,

  name             text not null check (length(btrim(name)) between 1 and 160),
  goal             text,
  audience         text,
  channel          text not null default 'social'
                     check (channel in ('social', 'email', 'whatsapp', 'search',
                                        'print', 'broadcast', 'other')),

  budget_minor     bigint check (budget_minor is null or budget_minor >= 0),
  currency         char(3) not null default 'UGX'
                     check (currency in ('UGX', 'KES', 'TZS', 'RWF', 'USD', 'GBP', 'EUR')),

  starts_at        timestamptz,
  ends_at          timestamptz,
  status           text not null default 'draft'
                     check (status in ('draft', 'scheduled', 'active', 'paused', 'completed')),

  -- Performance metrics, all entered or synced, never inferred by us.
  reach            integer not null default 0 check (reach >= 0),
  engagement       integer not null default 0 check (engagement >= 0),
  leads            integer not null default 0 check (leads >= 0),
  conversions      integer not null default 0 check (conversions >= 0),
  revenue_minor    bigint not null default 0 check (revenue_minor >= 0),

  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),

  constraint campaigns_dates_ordered
    check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

create index campaigns_business_id_idx on public.campaigns (business_id);
create index campaigns_business_status_idx on public.campaigns (business_id, status);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- campaign_content
--
-- business_id is denormalised so every business-scoped table is uniformly
-- filterable, which keeps the RLS policies uniform too.
-- -----------------------------------------------------------------------------
create table public.campaign_content (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid references public.campaigns (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,

  content_type     text not null
                     check (content_type in ('social_post', 'ad', 'email', 'blog',
                                             'whatsapp', 'product_description')),
  body             text not null check (length(btrim(body)) between 1 and 20000),
  variant          text,

  ai_generated     boolean not null default false,
  ai_model         text,
  -- The assumptions behind generated copy, per PRD section 7.
  ai_assumptions   jsonb not null default '[]'::jsonb,

  approved_at      timestamptz,
  created_at       timestamptz not null default timezone('utc', now()),

  constraint campaign_content_assumptions_is_array
    check (jsonb_typeof(ai_assumptions) = 'array'),
  -- Generated content must be traceable to a model.
  constraint campaign_content_ai_has_model
    check (not ai_generated or ai_model is not null)
);

create index campaign_content_campaign_id_idx  on public.campaign_content (campaign_id);
create index campaign_content_business_id_idx   on public.campaign_content (business_id);
create index campaign_content_business_type_idx on public.campaign_content (business_id, content_type);

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,

  title              text not null check (length(btrim(title)) between 1 and 200),
  description        text,
  status             text not null default 'todo'
                       check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority           text not null default 'normal'
                       check (priority in ('low', 'normal', 'high', 'urgent')),

  due_at             timestamptz,
  completed_at       timestamptz,

  source             text not null default 'manual'
                       check (source in ('manual', 'ai_roadmap', 'ai_copilot')),
  related_entity_type text,
  related_entity_id  uuid,

  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now()),

  constraint tasks_completed_needs_status
    check (completed_at is null or status = 'done'),
  -- An AI-sourced task must point at whatever produced it.
  constraint tasks_ai_source_has_reference
    check (source = 'manual' or related_entity_id is not null)
);

create index tasks_business_id_idx    on public.tasks (business_id);
create index tasks_business_status_idx on public.tasks (business_id, status);
create index tasks_due_at_idx        on public.tasks (business_id, due_at)
  where status in ('todo', 'in_progress', 'blocked');

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- brand_assets
--
-- One row per asset rather than one wide row, so a new asset type needs no
-- migration.
-- -----------------------------------------------------------------------------
create table public.brand_assets (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,

  asset_type     text not null
                   check (asset_type in ('name', 'tagline', 'mission', 'vision', 'values',
                                         'personality', 'colors', 'typography',
                                         'logo_concept', 'guidelines')),
  content        text not null,
  is_primary     boolean not null default false,

  ai_generated   boolean not null default false,
  ai_model       text,
  ai_assumptions jsonb not null default '[]'::jsonb,

  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now()),

  constraint brand_assets_assumptions_is_array
    check (jsonb_typeof(ai_assumptions) = 'array'),
  constraint brand_assets_ai_has_model
    check (not ai_generated or ai_model is not null)
);

create index brand_assets_business_id_idx     on public.brand_assets (business_id);
create index brand_assets_business_type_idx   on public.brand_assets (business_id, asset_type);

-- At most one primary asset per type.
create unique index brand_assets_one_primary_per_type
  on public.brand_assets (business_id, asset_type)
  where is_primary;

create trigger brand_assets_set_updated_at
  before update on public.brand_assets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- business_plans
--
-- sections is JSONB (ADR-2): the 16 PRD sections are written and read as a
-- whole, never queried individually. A normalised table would need 16 rows and
-- a transaction for no benefit.
-- -----------------------------------------------------------------------------
create table public.business_plans (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,

  version         integer not null default 1 check (version > 0),
  status          text not null default 'draft' check (status in ('draft', 'final', 'archived')),

  sections        jsonb not null default '{}'::jsonb,
  prompt          text,
  ai_model        text,
  ai_assumptions  jsonb not null default '[]'::jsonb,
  ai_generated_at timestamptz,

  share_token     text unique,
  shared_at       timestamptz,

  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),

  constraint business_plans_sections_is_object check (jsonb_typeof(sections) = 'object'),
  constraint business_plans_assumptions_is_array check (jsonb_typeof(ai_assumptions) = 'array'),
  -- A share token is required for a plan to count as shared.
  constraint business_plans_shared_needs_token
    check (shared_at is null or share_token is not null),
  constraint business_plans_version_unique unique (business_id, version)
);

create index business_plans_business_id_idx on public.business_plans (business_id, version desc);

create trigger business_plans_set_updated_at
  before update on public.business_plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ai_conversations / ai_messages
--
-- system_context_snapshot freezes the business facts used at generation time,
-- so a conversation stays reproducible after the business changes.
-- -----------------------------------------------------------------------------
create table public.ai_conversations (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references public.businesses (id) on delete cascade,
  user_id                   uuid not null references public.profiles (id) on delete cascade,

  title                     text,
  model                     text,
  system_context_snapshot   jsonb not null default '{}'::jsonb,

  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now()),

  constraint ai_conversations_snapshot_is_object
    check (jsonb_typeof(system_context_snapshot) = 'object')
);

create index ai_conversations_business_user_idx
  on public.ai_conversations (business_id, user_id, created_at desc);

create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.ai_conversations (id) on delete cascade,
  business_id       uuid not null references public.businesses (id) on delete cascade,

  role              text not null check (role in ('user', 'assistant', 'system')),
  content           text not null,
  model             text,

  input_tokens      integer not null default 0 check (input_tokens  >= 0),
  output_tokens     integer not null default 0 check (output_tokens >= 0),
  latency_ms        integer check (latency_ms is null or latency_ms >= 0),

  -- Persisted so the PRD's "AI must state its assumptions" rule is auditable
  -- rather than merely promised.
  assumptions       jsonb not null default '[]'::jsonb,
  warnings          jsonb not null default '[]'::jsonb,

  created_at        timestamptz not null default timezone('utc', now()),

  constraint ai_messages_assumptions_is_array check (jsonb_typeof(assumptions) = 'array'),
  constraint ai_messages_warnings_is_array    check (jsonb_typeof(warnings) = 'array')
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_business_idx     on public.ai_messages (business_id, created_at desc);

-- -----------------------------------------------------------------------------
-- ai_usage
--
-- Added in ADR-6. The PRD names AI cost as a key risk but gives it nowhere to
-- record usage, so per-user cost limits could not be enforced.
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  business_id              uuid references public.businesses (id) on delete cascade,

  feature                  text not null
                             check (feature in ('copilot', 'idea', 'business_plan',
                                                'brand', 'marketing')),
  model                    text not null,
  input_tokens             integer not null default 0 check (input_tokens  >= 0),
  output_tokens            integer not null default 0 check (output_tokens >= 0),
  estimated_cost_micros    bigint not null default 0 check (estimated_cost_micros >= 0),

  created_at               timestamptz not null default timezone('utc', now())
);

comment on table public.ai_usage is
  'Per-call AI usage. Enforces the daily cap in AI_REQUESTS_PER_USER_PER_DAY.';

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_business_date_idx on public.ai_usage (business_id, created_at desc);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  business_id  uuid references public.businesses (id) on delete cascade,

  type         text not null,
  title        text not null,
  body         text,
  data         jsonb not null default '{}'::jsonb,

  channel      text not null default 'in_app' check (channel in ('in_app', 'email')),
  read_at      timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default timezone('utc', now()),

  constraint notifications_data_is_object check (jsonb_typeof(data) = 'object')
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references public.businesses (id) on delete cascade,

  plan                      text not null default 'free'
                              check (plan in ('free', 'starter', 'pro', 'enterprise')),
  status                    text not null default 'active'
                              check (status in ('trialing', 'active', 'past_due', 'cancelled', 'paused')),

  provider                  text,
  provider_customer_id      text,
  provider_subscription_id  text,

  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,

  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now()),

  constraint subscriptions_one_per_business unique (business_id),
  constraint subscriptions_period_ordered
    check (current_period_start is null
           or current_period_end is null
           or current_period_start <= current_period_end)
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.transactions       enable row level security;
alter table public.expenses           enable row level security;
alter table public.campaigns         enable row level security;
alter table public.campaign_content  enable row level security;
alter table public.tasks              enable row level security;
alter table public.brand_assets       enable row level security;
alter table public.business_plans     enable row level security;
alter table public.ai_conversations  enable row level security;
alter table public.ai_messages        enable row level security;
alter table public.ai_usage           enable row level security;
alter table public.notifications      enable row level security;
alter table public.subscriptions      enable row level security;

do $$
declare
  t text;
begin
  -- One policy pair per business-scoped table. Generated rather than repeated
  -- so a new table cannot be added without its RLS.
  foreach t in array array[
    'transactions', 'expenses', 'campaigns', 'campaign_content', 'tasks',
    'brand_assets', 'business_plans', 'ai_messages'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select using (public.is_member(business_id))', t || '_read', t);
    execute format(
      'create policy %I on public.%I for all using (public.member_role(business_id) in (''owner'',''admin'',''editor'')) with check (public.member_role(business_id) in (''owner'',''admin'',''editor''))',
      t || '_write', t);
  end loop;
end;
$$;

create policy "ai_conversations readable by member"
  on public.ai_conversations for select using (public.is_member(business_id));
create policy "ai_conversations writable by owner"
  on public.ai_conversations for all
  using (public.member_role(business_id) in ('owner', 'admin'))
  with check (public.member_role(business_id) in ('owner', 'admin'));

create policy "own ai usage readable"
  on public.ai_usage for select using (user_id = auth.uid());

create policy "own notifications readable"
  on public.notifications for select using (user_id = auth.uid());
create policy "own notifications writable"
  on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subscriptions readable by member"
  on public.subscriptions for select using (public.is_member(business_id));
create policy "subscriptions writable by owner"
  on public.subscriptions for all
  using (public.member_role(business_id) = 'owner')
  with check (public.member_role(business_id) = 'owner');
