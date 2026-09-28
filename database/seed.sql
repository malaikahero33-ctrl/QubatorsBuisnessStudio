-- =============================================================================
-- seed.sql  —  local development data only
-- Qubators Business Studio
--
-- Run with:  supabase db reset
--
-- NOT for production. Creates one demo business with products, services,
-- customers, orders, transactions, campaigns, tasks and brand assets, so the
-- app has something real to render before the AI engine exists.
--
-- Requires a user in auth.users. The first section finds or creates one and
-- reuses its id, so this is safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demo user
--
-- A verified account with a known password for local development.
-- The hash below is bcrypt for the password "demo-password-123".
-- -----------------------------------------------------------------------------
do $$
declare
  demo_email constant text := 'founder@qubators.test';
  demo_id   uuid;
begin
  select id into demo_id from auth.users where email = demo_email;

  if demo_id is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated', demo_email,
      crypt('demo-password-123', gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Amina K"}',
      timezone('utc', now()), timezone('utc', now())
    )
    returning id into demo_id;
  end if;

  -- profiles / business_members rows are created by the signup triggers, so
  -- only the profile name needs filling in for an existing user.
  update public.profiles set full_name = 'Amina K' where id = demo_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Demo business
-- -----------------------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_biz  uuid;
begin
  select id into v_user from auth.users where email = 'founder@qubators.test';
  select id into v_biz from public.businesses where owner_id = v_user limit 1;

  if v_biz is null then
    insert into public.businesses (
      owner_id, name, slug, industry, location, stage,
      currency, locale, timezone,
      target_customer, price_range_minor, price_range_maxor,
      brand_personality, goals
    ) values (
      v_user, 'Sunrise Foods', 'sunrise-foods',
      'Food and beverage', 'Kampala, Uganda', 'planning',
      'UGX', 'en-UG', 'Africa/Kampala',
      'Urban young professionals aged 20-35 who buy convenience snacks weekly',
      2000000, 15000000,
      'Warm, optimistic, no-nonsense',
      'Reach 500 direct customers and 20 stockists within 12 months'
    )
    returning id into v_biz;
  end if;

  -- ---- products ------------------------------------------------------------
  insert into public.products (business_id, name, description, category, price_minor, cost_minor, sku, inventory_count, low_stock_threshold)
  values
    (v_biz, 'Sunrise Granola 250g',  'Roasted oats, honey and cashew mix',   'Snacks',  1200000, 620000, 'SUN-GRA-250', 184, 40),
    (v_biz, 'Sunrise Trail Mix 150g','Almonds, seeds and dried fruit',       'Snacks',   950000, 480000, 'SUN-TRA-150',  96, 30),
    (v_biz, 'Sunrise Energy Bites 8','Date and cacao energy bites, 8 pack',  'Snacks',   650000, 300000, 'SUN-ENE-008', 212, 50)
  on conflict (business_id, sku) do nothing;

  -- ---- services ------------------------------------------------------------
  insert into public.services (business_id, name, description, category, price_minor, cost_minor, duration_minutes, availability)
  values
    (v_biz, 'Brand identity package', 'Logo, palette, type and a usage guide',   'Branding', 3500000,  900000, 21, 'limited'),
    (v_biz, 'Monthly social content',  'Twelve designed posts per month',         'Marketing',1800000,  300000, 30, 'available'),
    (v_biz, 'Packaging design review', 'One-hour review of artwork and print spec','Design',   600000,  120000, 60, 'available')
  on conflict do nothing;

  -- ---- customers -----------------------------------------------------------
  insert into public.customers (business_id, name, email, phone, location, stage, notes)
  values
    (v_biz, 'Kampala Mini Mart',  'orders@kampalamini.example', '+256700000001', 'Kampala',  'customer', 'Weekly restock, pays on delivery'),
    (v_biz, 'Nabugoes Corner Shop','nabugoes@example.com',      '+256700000002', 'Nabugoes', 'customer', NULL),
    (v_biz, 'Fatuma N.',           'fatuma@example.com',        '+256700000003', 'Mukono',   'prospect', 'Interested in a 50-unit corporate order'),
    (v_biz, 'Daniel Okello',       'daniel@example.com',        '+256700000004', 'Jinja',    'lead',     'Saw the flyer at the trade fair')
  on conflict do nothing;

  -- ---- orders --------------------------------------------------------------
  -- total_minor is recalculated from order_items by trigger.
  insert into public.orders (business_id, customer_id, order_number, status, currency, placed_at, due_at)
  select v_biz, c.id, 'QB-1001', 'completed', 'UGX', timezone('utc', now()) - interval '12 days', timezone('utc', now()) - interval '5 days'
  from public.customers c where c.business_id = v_biz and c.name = 'Kampala Mini Mart'
  on conflict (business_id, order_number) do nothing;

  insert into public.order_items (order_id, business_id, product_id, description, quantity, unit_price_minor)
  select o.id, v_biz, p.id, p.name, 40, p.price_minor
  from public.orders o, public.products p
  where o.business_id = v_biz
    and o.order_number = 'QB-1001'
    and p.sku = 'SUN-GRA-250'
  on conflict do nothing;

  insert into public.orders (business_id, customer_id, order_number, status, currency, placed_at, due_at)
  select v_biz, c.id, 'QB-1002', 'in_progress', 'UGX', timezone('utc', now()) - interval '4 days', timezone('utc', now()) + interval '3 days'
  from public.customers c where c.business_id = v_biz and c.name = 'Nabugoes Corner Shop'
  on conflict (business_id, order_number) do nothing;

  insert into public.order_items (order_id, business_id, service_id, description, quantity, unit_price_minor)
  select o.id, v_biz, s.id, s.name, 1, s.price_minor
  from public.orders o, public.services s
  where o.business_id = v_biz
    and o.order_number = 'QB-1002'
    and s.name = 'Packaging design review'
  on conflict do nothing;

  -- ---- finance -------------------------------------------------------------
  insert into public.transactions (business_id, customer_id, type, amount_minor, currency, category, description, occurred_at)
  select v_biz, c.id, 'income', 48000000, 'UGX', 'sales', 'QB-1001 wholesale order', timezone('utc', now()) - interval '5 days'
  from public.customers c where c.business_id = v_biz and c.name = 'Kampala Mini Mart'
  on conflict do nothing;

  insert into public.transactions (business_id, type, amount_minor, currency, category, description, occurred_at)
  values
    (v_biz, 'expense', 1800000,  'UGX', 'ingredients', 'Oats, honey and cashews', timezone('utc', now()) - interval '6 days'),
    (v_biz, 'expense',  950000,  'UGX', 'packaging',   'Pouches and labels',      timezone('utc', now()) - interval '6 days'),
    (v_biz, 'expense',  400000,  'UGX', 'transport',   'Delivery to Kampala',    timezone('utc', now()) - interval '5 days'),
    (v_biz, 'income', 12000000, 'UGX', 'sales',       'Direct walk-in sales',    timezone('utc', now()) - interval '2 days');

  -- ---- expenses ------------------------------------------------------------
  insert into public.expenses (business_id, vendor, description, category, amount_minor, currency, occurred_on)
  values
    (v_biz, 'Kampala Print Works', 'Business cards, 500',  'marketing',  350000, 'UGX', current_date - 14),
    (v_biz, 'SafeNet Security',    'Monthly bandwidth',     'utilities',   120000, 'UGX', current_date -  7);

  -- ---- campaign ------------------------------------------------------------
  do $$
  declare v_campaign uuid;
  begin
    insert into public.campaigns (business_id, name, goal, audience, channel, budget_minor, currency, starts_at, ends_at, status, reach, engagement, leads, conversions, revenue_minor)
    values (v_biz, 'Wet season launch', 'First 100 stockists', 'Urban retailers, Kampala', 'social',
            3000000, 'UGX', timezone('utc', now()) - interval '10 days', timezone('utc', now()) + interval '5 days', 'active',
            18400, 1260, 74, 11, 9200000)
    returning id into v_campaign;

    insert into public.campaign_content (campaign_id, business_id, content_type, body, variant, ai_generated, ai_model, ai_assumptions, approved_at)
    values (v_campaign, v_biz, 'social_post',
            'Sunrise Granola now in 184 stockists across Kampala. Roasted oats, real honey, no palm oil. Find us near you.',
            'launch', false, null, '[]'::jsonb, timezone('utc', now()));
  end;
  $$;

  -- ---- tasks ---------------------------------------------------------------
  insert into public.tasks (business_id, title, description, status, priority, due_at, source)
  values
    (v_biz, 'Sign 3 new stockists',      'Target Nakawa Road and Kisementi',        'todo',        'high',   timezone('utc', now()) + interval '5 days',  'manual'),
    (v_biz, 'Reorder granola packaging',  'Down to 184 units, threshold is 40',      'in_progress', 'urgent', timezone('utc', now()) + interval '2 days',  'manual'),
    (v_biz, 'Finalise brand guidelines',  'Colour, type and packaging rules',         'todo',        'normal', timezone('utc', now()) + interval '9 days',  'manual'),
    (v_biz, 'Set up monthly content',     'Twelve posts for the launch month',       'todo',        'normal', timezone('utc', now()) + interval '12 days', 'manual');

  -- ---- brand ---------------------------------------------------------------
  insert into public.brand_assets (business_id, asset_type, content, is_primary, ai_generated)
  values
    (v_biz, 'name',        'Sunrise Foods',                        true,  false),
    (v_biz, 'tagline',     'Start well, every day.',               true,  false),
    (v_biz, 'mission',     'Make a better morning affordable across East Africa.', true, false),
    (v_biz, 'vision',      'A locally made brand that competes fairly with imports.', true, false),
    (v_biz, 'personality', 'Warm, optimistic, direct, unhurried',  true,  false),
    (v_biz, 'colors',      'Primary #F4A300 sunrise amber. Secondary #2E7D32 leaf green. Accent #FFFFFF.', true, false),
    (v_biz, 'typography',  'Headings: a heavy humanist sans. Body: a readable serif at 16px minimum.', true, false)
  on conflict do nothing;

  -- ---- subscription --------------------------------------------------------
  insert into public.subscriptions (business_id, plan, status)
  values (v_biz, 'starter', 'trialing')
  on conflict (business_id) do nothing;
end;
$$;
