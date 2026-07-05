-- ============================================================
-- Schema: multi-tenant job management SaaS (PRODUCT_SPEC.md §12)
-- Every tenant-scoped table carries company_id; RLS (next
-- migration) is the enforcement boundary, keyed on company_id.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- enums ----------
create type membership_role as enum ('bo', 'worker');
create type worker_status as enum ('invited', 'active', 'inactive');
create type rate_type as enum ('hourly', 'daily');
create type job_category as enum ('water', 'electric');
create type job_urgency as enum ('normal', 'urgent');
create type job_status as enum
  ('created', 'quoted', 'accepted', 'in_progress', 'work_done', 'invoiced', 'paid', 'cancelled');
create type photo_type as enum ('before', 'after');
create type quote_status as enum ('draft', 'bo_signed', 'accepted');
create type signature_subject as enum ('quote', 'completion');
create type signature_party as enum ('bo', 'worker', 'customer');
create type signature_mechanism as enum ('device_handoff', 'remote_account');
create type invoice_type as enum ('einvoice', 'receipt');
create type invoice_status as enum ('unpaid', 'paid', 'voided');
create type payment_method as enum ('card', 'cash', 'transfer');
create type payment_status as enum ('pending', 'succeeded', 'failed');
create type subscription_status as enum ('active', 'pending', 'past_due', 'cancelled');

-- ---------- plan/entitlement config (global, not tenant-scoped) ----------
-- Pricing changes are config, not code (spec §10).
create table plans (
  id            text primary key,               -- 'starter' | 'growth' | 'pro'
  name_zh       text not null,
  name_en       text not null,
  price_monthly integer not null,               -- NT$/month
  features      jsonb not null default '{}',    -- entitlement flags/limits
  sort          integer not null default 0
);

-- ---------- tenancy ----------
create table companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tax_id     text check (tax_id ~ '^\d{8}$'),   -- 統一編號, optional, addable later
  plan_id    text not null default 'starter' references plans (id),
  created_at timestamptz not null default now()
);

create table profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  phone        text not null,                   -- primary identifier even for OAuth signups (spec §8)
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       membership_role not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on memberships (user_id);

-- ---------- team ----------
-- Roster entry exists before the worker has an auth account ('invited').
create table workers (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies (id) on delete cascade,
  name              text not null,
  phone             text not null,
  status            worker_status not null default 'invited',
  user_id           uuid references auth.users (id),
  invite_token_hash text unique,                -- sha256 of the single-use invite token
  invite_expires_at timestamptz,
  invited_at        timestamptz not null default now(),
  activated_at      timestamptz,
  unique (company_id, user_id)
);
create index on workers (company_id);

-- Pay rate lives in its own table so RLS can hide it from the worker
-- entirely (spec §7: never shown to the worker themselves).
create table worker_rates (
  worker_id  uuid primary key references workers (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  rate_type  rate_type not null,
  rate       numeric(10, 2) not null check (rate >= 0)
);

-- BO's private notes about a worker (BO-only; spec §7).
create table bo_worker_notes (
  worker_id  uuid primary key references workers (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  tags       text[] not null default '{}',
  log        text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- customers ----------
create table customers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name       text not null,
  phone      text not null,
  address    text not null default '',
  created_at timestamptz not null default now()
);
create index on customers (company_id);

-- Optional customer login, created via QR opt-in (spec §9).
create table customer_accounts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  customer_id uuid not null unique references customers (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index on customer_accounts (user_id);

-- Single-use, time-limited QR signup tokens (spec §15.8). Raw token never stored.
create table customer_signup_tokens (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

-- BO's private notes about a customer: structured tags, one set per
-- customer (spec §6). BO-only.
create table bo_customer_notes (
  customer_id uuid primary key references customers (id) on delete cascade,
  company_id  uuid not null references companies (id) on delete cascade,
  tags        text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Customer's own private notes — visible only to that customer's auth user,
-- never to BO or Worker (spec §2). Third, separate private-data layer.
create table customer_private_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_id     uuid not null,                     -- fk added after jobs table
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

-- ---------- jobs ----------
create table job_counters (
  company_id  uuid primary key references companies (id) on delete cascade,
  last_number integer not null default 1000
);

create table jobs (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies (id) on delete cascade,
  job_number          integer not null,
  code                text generated always as ('J-' || job_number::text) stored,
  customer_id         uuid not null references customers (id),
  category            job_category not null,
  description         text not null,
  urgency             job_urgency not null default 'normal',
  needs_truck         boolean not null default false,
  estimated_hours     numeric(6, 2) check (estimated_hours > 0),  -- structured hours, not free text (spec §3.1)
  actual_hours        numeric(6, 2) check (actual_hours > 0),
  variance_note       text,
  status              job_status not null default 'created',
  cancellation_reason text,
  cancelled_by        uuid references auth.users (id),
  cancelled_at        timestamptz,
  disputed            boolean not null default false,             -- flagged manually by BO (spec §4)
  disputed_at         timestamptz,
  created_by          uuid not null references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, job_number)
);
create index on jobs (company_id, status);
create index on jobs (customer_id);

alter table customer_private_notes
  add constraint customer_private_notes_job_id_fkey
  foreign key (job_id) references jobs (id) on delete cascade;

create table job_photos (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  job_id       uuid not null references jobs (id) on delete cascade,
  type         photo_type not null,
  storage_path text not null,
  -- EXIF timestamp/GPS captured client-side before compression and kept here
  -- as structured dispute evidence (spec §5); never exposed via Share.
  taken_at     timestamptz,
  gps_lat      double precision,
  gps_lng      double precision,
  uploaded_by  uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);
create index on job_photos (job_id);

-- ---------- quotes ----------
create table quotes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  job_id      uuid not null references jobs (id) on delete cascade,
  status      quote_status not null default 'draft',
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create index on quotes (job_id);

create table quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes (id) on delete cascade,
  company_id  uuid not null references companies (id) on delete cascade,
  description text not null,
  qty         numeric(10, 2) not null check (qty > 0),
  unit_price  numeric(12, 2) not null check (unit_price >= 0),
  position    integer not null default 0
);
create index on quote_line_items (quote_id);

-- ---------- signatures (append-only; spec §15.3) ----------
create table signatures (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies (id) on delete cascade,
  job_id         uuid not null references jobs (id),
  quote_id       uuid references quotes (id),
  subject_type   signature_subject not null,
  party          signature_party not null,
  mechanism      signature_mechanism not null,
  signer_user_id uuid references auth.users (id), -- null for device-handoff customers without accounts
  signer_name    text,
  image_path     text,                            -- drawn signature image in private storage
  signed_at      timestamptz not null default now(),
  check (subject_type != 'quote' or quote_id is not null)
);
create index on signatures (job_id);

-- ---------- scheduling ----------
create table trucks (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name       text not null,
  active     boolean not null default true
);

-- Trucks are a second bookable resource alongside workers; conflicts are
-- surfaced to the BO, not auto-resolved (spec §6).
create table schedule_entries (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  job_id     uuid not null references jobs (id) on delete cascade,
  worker_id  uuid not null references workers (id),
  truck_id   uuid references trucks (id),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on schedule_entries (company_id, starts_at);
create index on schedule_entries (worker_id);
create index on schedule_entries (truck_id);

-- ---------- invoicing & payments ----------
create table invoices (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies (id) on delete cascade,
  job_id           uuid not null references jobs (id),
  quote_id         uuid references quotes (id),
  type             invoice_type not null,
  number           text not null,               -- internal number; e-invoice号 lives in einvoice_number
  amount           integer not null check (amount >= 0),  -- NT$, whole dollars
  status           invoice_status not null default 'unpaid',
  payment_method   payment_method,
  einvoice_number  text,                        -- 統一發票號碼 from ezPay, when type = 'einvoice'
  einvoice_random  text,
  provider_raw     jsonb,
  issued_by        uuid not null references auth.users (id),
  issued_at        timestamptz not null default now(),
  paid_at          timestamptz
);
create index on invoices (company_id, status);
create index on invoices (job_id);

create table payments (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies (id) on delete cascade,
  invoice_id        uuid not null references invoices (id) on delete cascade,
  amount            integer not null check (amount > 0),
  method            payment_method not null,
  status            payment_status not null default 'pending',
  provider          text not null default 'manual',   -- 'manual' | 'newebpay'
  provider_trade_no text,
  raw               jsonb,
  created_at        timestamptz not null default now()
);
create index on payments (invoice_id);

-- ---------- materials purchase log (BO-only; spec §6) ----------
create table materials (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  purchased_on date not null,
  supplier     text not null,
  item         text not null,
  qty          numeric(10, 2) not null check (qty > 0),
  unit_price   numeric(12, 2) not null check (unit_price >= 0),
  job_id       uuid references jobs (id) on delete set null,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);
create index on materials (company_id, purchased_on);
create index on materials (job_id);

-- ---------- share links (unguessable, time-limited; spec §3.6, §15.8) ----------
create table share_tokens (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  subject_type text not null check (subject_type in ('quote', 'invoice')),
  subject_id   uuid not null,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);

-- ---------- 2FA backup codes, hashed at rest (spec §15.7) ----------
create table mfa_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  code_hash  text not null,                     -- bcrypt
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on mfa_backup_codes (user_id);

-- ---------- SaaS billing ----------
create table company_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies (id) on delete cascade,
  plan_id            text not null references plans (id),
  status             subscription_status not null default 'pending',
  newebpay_period_no text,                      -- NewebPay 定期定額委託單號
  period_start       date,
  period_end         date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on company_subscriptions (company_id);

-- Raw provider webhook audit trail (payment + subscription events).
create table billing_events (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references companies (id) on delete set null,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- legal consent logging (spec §16) ----------
create table consent_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  uuid references companies (id) on delete set null,
  doc_type    text not null check (doc_type in ('tos', 'privacy', 'dpa')),
  doc_version text not null,
  accepted_at timestamptz not null default now()
);

-- ============================================================
-- Helper functions (security definer so RLS policies can consult
-- memberships without recursive RLS evaluation)
-- ============================================================
create schema if not exists app;

create or replace function app.user_company_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select company_id from memberships where user_id = auth.uid() and active
$$;

create or replace function app.is_member(cid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where company_id = cid and user_id = auth.uid() and active
  )
$$;

create or replace function app.is_bo(cid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where company_id = cid and user_id = auth.uid() and role = 'bo' and active
  )
$$;

-- Customer records linked to the current auth user via QR opt-in accounts.
create or replace function app.my_customer_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select customer_id from customer_accounts where user_id = auth.uid()
$$;

-- A worker can access a job they created or are scheduled on (spec §2:
-- "own assigned jobs only").
create or replace function app.worker_can_access_job(jid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs j
    where j.id = jid
      and app.is_member(j.company_id)
      and (
        j.created_by = auth.uid()
        or exists (
          select 1 from schedule_entries se
          join workers w on w.id = se.worker_id
          where se.job_id = j.id and w.user_id = auth.uid()
        )
      )
  )
$$;

create or replace function app.can_access_job(jid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs j
    where j.id = jid
      and (
        app.is_bo(j.company_id)
        or app.worker_can_access_job(j.id)
        or j.customer_id in (select app.my_customer_ids())
      )
  )
$$;

-- ---------- signup / invite flows (definer functions so RLS on
-- memberships/companies can stay locked down) ----------

-- Public company signup (spec §8): creates tenant + BO membership atomically.
create or replace function app.create_company(p_name text, p_tax_id text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'company name required';
  end if;
  insert into companies (name, tax_id) values (trim(p_name), nullif(trim(coalesce(p_tax_id, '')), ''))
  returning id into cid;
  insert into memberships (company_id, user_id, role) values (cid, auth.uid(), 'bo');
  insert into job_counters (company_id) values (cid);
  return cid;
end;
$$;

-- Worker invite acceptance (spec §8): single-use token, flips roster
-- Invited → Active, creates the worker membership.
create or replace function app.accept_worker_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  w workers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into w from workers
  where invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and status = 'invited'
    and invite_expires_at > now()
  for update;
  if not found then
    raise exception 'invite invalid, expired, or already used';
  end if;
  update workers
  set user_id = auth.uid(),
      status = 'active',
      activated_at = now(),
      invite_token_hash = null,   -- single-use: token can never match again
      invite_expires_at = null
  where id = w.id;
  insert into memberships (company_id, user_id, role)
  values (w.company_id, auth.uid(), 'worker')
  on conflict (company_id, user_id) do update set active = true, role = 'worker';
  return w.company_id;
end;
$$;

-- Read-only invite preview so the invite landing page can show company
-- name + pre-filled phone before the worker authenticates.
create or replace function app.peek_worker_invite(p_token text)
returns table (company_name text, worker_name text, worker_phone text)
language sql stable security definer set search_path = public as $$
  select c.name, w.name, w.phone
  from workers w
  join companies c on c.id = w.company_id
  where w.invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and w.status = 'invited'
    and w.invite_expires_at > now()
$$;

-- ============================================================
-- Business-rule triggers (spec §15.10: enforce at the DB, not the UI)
-- ============================================================

create or replace function app.assign_job_number()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into job_counters (company_id, last_number)
  values (new.company_id, 1001)
  on conflict (company_id)
  do update set last_number = job_counters.last_number + 1
  returning last_number into new.job_number;
  return new;
end;
$$;

create trigger jobs_assign_number
before insert on jobs
for each row execute function app.assign_job_number();

create or replace function app.enforce_job_rules()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Cancellation requires a reason, logged with who/when (spec §4).
  if new.status = 'cancelled' and (old.status is distinct from 'cancelled') then
    if new.cancellation_reason is null or length(trim(new.cancellation_reason)) = 0 then
      raise exception 'cancellation requires a reason';
    end if;
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  -- At least one after-photo is a hard requirement before completion (spec §5).
  if new.status in ('work_done', 'invoiced', 'paid')
     and old.status not in ('work_done', 'invoiced', 'paid') then
    if not exists (select 1 from job_photos p where p.job_id = new.id and p.type = 'after') then
      raise exception 'job cannot be marked complete without at least one after-photo';
    end if;
  end if;

  -- Invoicing is BO-only (spec §2) — reject even if the UI is bypassed.
  -- auth.uid() is null for service-role/server contexts, which are trusted.
  if new.status in ('invoiced', 'paid') and old.status not in ('invoiced', 'paid') then
    if auth.uid() is not null and not app.is_bo(new.company_id) then
      raise exception 'only the business owner can invoice or mark paid';
    end if;
  end if;

  if new.disputed and not old.disputed then
    new.disputed_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger jobs_enforce_rules
before update on jobs
for each row execute function app.enforce_job_rules();

-- New jobs always enter the pipeline at 'created' — a client cannot insert
-- a job pre-marked invoiced/paid (spec §15.10).
create or replace function app.enforce_job_insert()
returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.status := 'created';
    new.cancellation_reason := null;
    new.cancelled_by := null;
    new.cancelled_at := null;
    new.disputed := false;
    new.disputed_at := null;
  end if;
  return new;
end;
$$;

create trigger jobs_enforce_insert
before insert on jobs
for each row execute function app.enforce_job_insert();

-- An already-signed quote must not be editable (spec §15.10).
create or replace function app.enforce_quote_immutability()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'quotes' then
    if old.status != 'draft' then
      -- only the forward status transition may change on a signed quote
      if new.job_id != old.job_id or new.company_id != old.company_id
         or new.created_by != old.created_by or new.created_at != old.created_at then
        raise exception 'a signed quote cannot be edited';
      end if;
      if old.status = 'accepted' then
        raise exception 'an accepted quote cannot be modified';
      end if;
      if old.status = 'bo_signed' and new.status != 'accepted' then
        raise exception 'a signed quote can only progress to accepted';
      end if;
    end if;
    if new.status = 'accepted' and old.status != 'accepted' then
      new.accepted_at := coalesce(new.accepted_at, now());
    end if;
    return new;
  else
    -- line items: frozen once the parent quote leaves draft
    if exists (
      select 1 from quotes q
      where q.id = coalesce(new.quote_id, old.quote_id) and q.status != 'draft'
    ) then
      raise exception 'line items of a signed quote cannot be changed';
    end if;
    return coalesce(new, old);
  end if;
end;
$$;

create trigger quotes_immutability
before update on quotes
for each row execute function app.enforce_quote_immutability();

create trigger quote_line_items_immutability
before insert or update or delete on quote_line_items
for each row execute function app.enforce_quote_immutability();

-- Signatures are append-only at the database level (spec §15.3) — no role,
-- including BO and the service role, may rewrite history.
create or replace function app.block_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'signatures are append-only; % is not permitted', tg_op;
end;
$$;

create trigger signatures_append_only
before update or delete on signatures
for each row execute function app.block_mutation();

-- ---------- per-job financials for Business Insights (spec §6) ----------
-- security_invoker: RLS of the querying user applies, so labor cost
-- (worker_rates, BO-only) never leaks to workers.
create view job_financials
with (security_invoker = true) as
select
  j.id as job_id,
  j.company_id,
  j.code,
  j.status,
  j.customer_id,
  coalesce((
    select sum(li.qty * li.unit_price)
    from quotes q join quote_line_items li on li.quote_id = q.id
    where q.job_id = j.id and q.status = 'accepted'
  ), 0)::numeric(12,2) as revenue,
  coalesce((
    select sum(
      case wr.rate_type
        when 'hourly' then wr.rate * coalesce(j.actual_hours, j.estimated_hours, 0)
        when 'daily'  then wr.rate * ceil(coalesce(j.actual_hours, j.estimated_hours, 0) / 8.0)
      end
    )
    from (select distinct se.worker_id from schedule_entries se where se.job_id = j.id) sw
    join worker_rates wr on wr.worker_id = sw.worker_id
  ), 0)::numeric(12,2) as labor_cost,
  coalesce((
    select sum(m.qty * m.unit_price) from materials m where m.job_id = j.id
  ), 0)::numeric(12,2) as material_cost
from jobs j;
