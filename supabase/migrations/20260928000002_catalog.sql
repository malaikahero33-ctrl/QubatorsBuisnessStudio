-- =============================================================================
-- 0002_catalog.sql
-- Qubators Business Studio
--
-- Products, services, customers and orders.
--
-- Money columns are *_minor: integers in the business currency's minor unit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- products
--
-- Stock-tracked. Separate from services because a product has inventory and
-- a service has a duration; merging them would leave nullable fields on both.
-- -----------------------------------------------------------------------------
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,

  name                 text not null check (length(btrim(name)) between 1 and 160),
  description          text,
  category             text,

  price_minor          bigint not null check (price_minor >= 0),
  cost_minor           bigint not null default 0 check (cost_minor >= 0),

  sku                  text,
  inventory_count      integer not null default 0,
  reorder_level        integer not null default 0 check (reorder_level >= 0),
  low_stock_threshold  integer not null default 0 check (low_stock_threshold >= 0),

  image_url            text,
  is_active            boolean not null default true,

  created_at           timestamptz not null default timezone('utc', now()),
  updated_at           timestamptz not null default timezone('utc', now()),

  constraint products_sku_unique_per_business
    unique (business_id, sku)
);

comment on table public.products is
  'Stock-tracked items. price_minor and cost_minor are integers, never decimals.';

create index products_business_id_idx     on public.products (business_id);
create index products_business_active_idx on public.products (business_id, is_active);
create index products_name_trgm_idx       on public.products using gin (name gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- services
--
-- Time-based. No inventory.
-- -----------------------------------------------------------------------------
create table public.services (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,

  name                text not null check (length(btrim(name)) between 1 and 160),
  description         text,
  category            text,

  price_minor         bigint not null check (price_minor >= 0),
  cost_minor          bigint not null default 0 check (cost_minor >= 0),

  duration_minutes    integer check (duration_minutes is null or duration_minutes > 0),
  requirements        text,
  availability        text not null default 'available'
                        check (availability in ('available', 'limited', 'unavailable')),

  image_url           text,
  is_active           boolean not null default true,

  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create index services_business_id_idx     on public.services (business_id);
create index services_business_active_idx on public.services (business_id, is_active);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- customers
--
-- PRD section 6 stage flow: lead -> prospect -> customer -> returning -> vip.
--
-- lifetime_value_minor and first_order_at are DERIVED, maintained by trigger.
-- The API never accepts them from the client.
-- -----------------------------------------------------------------------------
create table public.customers (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses (id) on delete cascade,

  name                   text not null check (length(btrim(name)) between 1 and 160),
  email                  text,
  phone                  text,
  location               text,
  stage                  text not null default 'lead'
                           check (stage in ('lead', 'prospect', 'customer', 'returning', 'vip')),
  notes                  text,

  first_order_at         timestamptz,
  lifetime_value_minor   bigint not null default 0 check (lifetime_value_minor >= 0),

  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now()),

  constraint customers_phone_e164
    check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  -- A customer must be reachable one way or the other before being created.
  constraint customers_has_contact
    check (email is not null or phone is not null)
);

comment on column public.customers.lifetime_value_minor is
  'Derived from completed orders. Maintained by trigger, never client-supplied.';

create index customers_business_id_idx on public.customers (business_id);
create index customers_business_stage_idx on public.customers (business_id, stage);
create index customers_email_idx        on public.customers (business_id, email);
create index customers_name_trgm_idx   on public.customers using gin (name gin_trgm_ops);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- orders
--
-- currency is denormalised onto the order on purpose: a later change to the
-- business currency must never silently rewrite the value of past orders.
-- -----------------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  customer_id      uuid references public.customers (id) on delete set null,

  order_number     text not null
                     check (order_number ~ '^[A-Z]{2,4}-[0-9]{4,10}$'),
  status           text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'in_progress',
                                       'shipped', 'completed', 'cancelled')),
  total_minor      bigint not null default 0 check (total_minor >= 0),
  currency         char(3) not null default 'UGX'
                     check (currency in ('UGX', 'KES', 'TZS', 'RWF', 'USD', 'GBP', 'EUR')),

  placed_at        timestamptz not null default timezone('utc', now()),
  due_at           timestamptz,
  notes            text,

  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),

  constraint orders_number_unique_per_business
    unique (business_id, order_number)
);

comment on column public.orders.currency is
  'Denormalised so a business currency change cannot rewrite historical totals.';

create index orders_business_id_idx   on public.orders (business_id);
create index orders_customer_id_idx  on public.orders (customer_id);
create index orders_placed_at_idx    on public.orders (business_id, placed_at desc);
-- Partial index: the dashboard only ever lists open orders.
create index orders_open_idx
  on public.orders (business_id, placed_at desc)
  where status in ('pending', 'confirmed', 'in_progress', 'shipped');

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- order_items
--
-- Added because the PRD's `orders` entity is under-specified: an order with a
-- single product_id cannot represent an order of four products (ADR-6).
--
-- line_total_minor is generated from unit price and quantity so a client
-- cannot tamper with it.
-- -----------------------------------------------------------------------------
create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  business_id       uuid not null references public.businesses (id) on delete cascade,

  product_id        uuid references public.products (id) on delete set null,
  service_id        uuid references public.services (id) on delete set null,

  description       text not null check (length(btrim(description)) between 1 and 300),
  quantity          integer not null default 1 check (quantity > 0),
  unit_price_minor  bigint not null check (unit_price_minor >= 0),
  line_total_minor  bigint generated always as (unit_price_minor * quantity) stored,

  created_at        timestamptz not null default timezone('utc', now()),

  -- A line must reference the catalogue exactly once, or be a free-text line.
  constraint order_items_one_catalogue_reference
    check (num_nonnulls(product_id, service_id) <= 1)
);

create index order_items_order_id_idx    on public.order_items (order_id);
create index order_items_business_id_idx on public.order_items (business_id);

-- -----------------------------------------------------------------------------
-- Keep order totals and customer lifetime value correct
--
-- The order total is recomputed from its items rather than trusted, and the
-- customer's derived columns are updated whenever an order is completed.
-- -----------------------------------------------------------------------------
create or replace function public.recalculate_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
  set total_minor = coalesce(
    (select sum(i.line_total_minor) from public.order_items i where i.order_id = target_order),
    0
  )
  where o.id = target_order;

  return coalesce(new, old);
end;
$$;

create trigger order_items_recalculate_total
  after insert or update or delete on public.order_items
  for each row execute function public.recalculate_order_total();

create or replace function public.refresh_customer_value()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_customer uuid;
  target_business uuid;
  completed_total bigint;
  earliest timestamptz;
begin
  target_customer := coalesce(new.customer_id, old.customer_id);
  target_business  := coalesce(new.business_id,  old.business_id);

  select sum(total_minor), min(placed_at)
    into completed_total, earliest
  from public.orders
  where customer_id = target_customer
    and status     = 'completed';

  update public.customers
  set lifetime_value_minor = coalesce(completed_total, 0),
      first_order_at       = earliest
  where id = target_customer;

  -- A customer with at least one completed order is no longer a bare lead.
  perform 1
  from public.customers
  where id = target_customer
    and stage in ('lead', 'prospect');

  return coalesce(new, old);
end;
$$;

create trigger orders_refresh_customer_value
  after insert or update or delete on public.orders
  for each row execute function public.refresh_customer_value();

-- -----------------------------------------------------------------------------
-- RLS
--
-- Identical policy shape for every business-scoped table: readable by members,
-- writable by owner and admin.
-- -----------------------------------------------------------------------------
alter table public.products    enable row level security;
alter table public.services    enable row level security;
alter table public.customers   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

create policy "products readable by member"
  on public.products for select using (public.is_member(business_id));
create policy "products writable by staff"
  on public.products for all
  using (public.member_role(business_id) in ('owner', 'admin', 'editor'))
  with check (public.member_role(business_id) in ('owner', 'admin', 'editor'));

create policy "services readable by member"
  on public.services for select using (public.is_member(business_id));
create policy "services writable by staff"
  on public.services for all
  using (public.member_role(business_id) in ('owner', 'admin', 'editor'))
  with check (public.member_role(business_id) in ('owner', 'admin', 'editor'));

create policy "customers readable by member"
  on public.customers for select using (public.is_member(business_id));
create policy "customers writable by staff"
  on public.customers for all
  using (public.member_role(business_id) in ('owner', 'admin', 'editor'))
  with check (public.member_role(business_id) in ('owner', 'admin', 'editor'));

create policy "orders readable by member"
  on public.orders for select using (public.is_member(business_id));
create policy "orders writable by staff"
  on public.orders for all
  using (public.member_role(business_id) in ('owner', 'admin', 'editor'))
  with check (public.member_role(business_id) in ('owner', 'admin', 'editor'));

create policy "order_items readable by member"
  on public.order_items for select using (public.is_member(business_id));
create policy "order_items writable by staff"
  on public.order_items for all
  using (public.member_role(business_id) in ('owner', 'admin', 'editor'))
  with check (public.member_role(business_id) in ('owner', 'admin', 'editor'));
