-- Security fix: RLS let a BO update any column of their own company,
-- including plan_id — i.e. a free self-upgrade to a paid tier via the API
-- (confirmed by a live probe on 2026-07-06). Plan escalation must only
-- happen through the billing flow (service role, after a successful
-- TapPay authorization). Client-side downgrades to the free tier remain
-- allowed — that's the legitimate self-service cancel path.

create or replace function app.enforce_plan_change()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan_id is distinct from old.plan_id
     and auth.uid() is not null            -- service role / server context is exempt
     and new.plan_id != 'starter' then     -- downgrade-to-free stays self-service
    raise exception 'plan upgrades must go through billing';
  end if;
  return new;
end;
$$;

create trigger companies_enforce_plan_change
before update on companies
for each row execute function app.enforce_plan_change();
