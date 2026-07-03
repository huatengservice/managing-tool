-- Plan tiers (spec §10). Entitlements are data, not code — changing a
-- price or a feature flag is an UPDATE here, not a deploy.
insert into plans (id, name_zh, name_en, price_monthly, features, sort) values
  (
    'starter', '入門版', 'Starter', 0,
    '{
      "einvoice": false,
      "online_payment": false,
      "cross_worker_dashboard": false,
      "max_workers": 3,
      "max_jobs_per_month": 50,
      "priority_support": false
    }',
    1
  ),
  (
    'growth', '成長版', 'Growth', 590,
    '{
      "einvoice": true,
      "online_payment": true,
      "cross_worker_dashboard": true,
      "max_workers": 10,
      "max_jobs_per_month": 500,
      "priority_support": false
    }',
    2
  ),
  (
    'pro', '專業版', 'Pro', 1290,
    '{
      "einvoice": true,
      "online_payment": true,
      "cross_worker_dashboard": true,
      "max_workers": null,
      "max_jobs_per_month": null,
      "priority_support": true
    }',
    3
  )
on conflict (id) do update
  set name_zh = excluded.name_zh,
      name_en = excluded.name_en,
      price_monthly = excluded.price_monthly,
      features = excluded.features,
      sort = excluded.sort;
