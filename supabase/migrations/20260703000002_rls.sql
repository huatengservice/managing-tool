-- ============================================================
-- Row Level Security — the enforcement boundary for multi-tenant
-- isolation (spec §15.1) and all three private-data layers (§15.5).
-- Default deny: a table with RLS enabled and no policy for an
-- operation rejects that operation for anon/authenticated roles.
-- The service role bypasses RLS and exists only in server code (§15.2).
-- ============================================================

alter table plans                  enable row level security;
alter table companies              enable row level security;
alter table profiles               enable row level security;
alter table memberships            enable row level security;
alter table workers                enable row level security;
alter table worker_rates           enable row level security;
alter table bo_worker_notes        enable row level security;
alter table customers              enable row level security;
alter table customer_accounts      enable row level security;
alter table customer_signup_tokens enable row level security;
alter table bo_customer_notes      enable row level security;
alter table customer_private_notes enable row level security;
alter table job_counters           enable row level security;
alter table jobs                   enable row level security;
alter table job_photos             enable row level security;
alter table quotes                 enable row level security;
alter table quote_line_items       enable row level security;
alter table signatures             enable row level security;
alter table trucks                 enable row level security;
alter table schedule_entries       enable row level security;
alter table invoices               enable row level security;
alter table payments               enable row level security;
alter table materials              enable row level security;
alter table share_tokens           enable row level security;
alter table mfa_backup_codes       enable row level security;
alter table company_subscriptions  enable row level security;
alter table billing_events         enable row level security;
alter table consent_logs           enable row level security;

-- ---------- plans: public pricing config ----------
create policy plans_read on plans for select to anon, authenticated using (true);

-- ---------- companies ----------
create policy companies_select on companies for select to authenticated
  using (app.is_member(id));
create policy companies_update on companies for update to authenticated
  using (app.is_bo(id)) with check (app.is_bo(id));
-- insert happens only through app.create_company() (security definer)

-- ---------- profiles ----------
create policy profiles_select_own on profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_insert_own on profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy profiles_update_own on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- memberships (reads only; writes go through definer fns) ----------
create policy memberships_select on memberships for select to authenticated
  using (user_id = auth.uid() or app.is_bo(company_id));

-- ---------- workers roster ----------
-- BO sees all; a worker sees only their own roster row (their pay rate
-- lives in worker_rates, which has no worker-readable policy at all).
create policy workers_select on workers for select to authenticated
  using (app.is_bo(company_id) or user_id = auth.uid());
create policy workers_insert on workers for insert to authenticated
  with check (app.is_bo(company_id));
create policy workers_update on workers for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));
create policy workers_delete on workers for delete to authenticated
  using (app.is_bo(company_id) and status = 'invited');  -- deactivate, don't delete, once real (spec §7)

-- ---------- worker_rates: BO-only, full stop (spec §7) ----------
create policy worker_rates_all on worker_rates for all to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));

-- ---------- bo_worker_notes: private layer #2 — BO-only (spec §15.5) ----------
create policy bo_worker_notes_all on bo_worker_notes for all to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));

-- ---------- customers ----------
-- BO: all. Worker: only customers attached to jobs they can access.
-- Customer account: only their own record.
create policy customers_select on customers for select to authenticated
  using (
    app.is_bo(company_id)
    or id in (select app.my_customer_ids())
    or (
      app.is_member(company_id)
      and exists (
        select 1 from jobs j
        where j.customer_id = customers.id and app.worker_can_access_job(j.id)
      )
    )
  );
create policy customers_insert on customers for insert to authenticated
  with check (app.is_member(company_id));
create policy customers_update on customers for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));

-- ---------- customer_accounts ----------
create policy customer_accounts_select on customer_accounts for select to authenticated
  using (user_id = auth.uid() or app.is_bo(company_id));
-- created only server-side after QR token validation (service role)

-- ---------- customer_signup_tokens: service-role only (no policies) ----------

-- ---------- bo_customer_notes: private layer #1 — BO-only (spec §15.5) ----------
create policy bo_customer_notes_all on bo_customer_notes for all to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));

-- ---------- customer_private_notes: private layer #3 — that customer only ----------
-- Never visible to BO or Worker (spec §2), so no company-based clause exists here.
create policy customer_private_notes_select on customer_private_notes for select to authenticated
  using (user_id = auth.uid());
create policy customer_private_notes_insert on customer_private_notes for insert to authenticated
  with check (
    user_id = auth.uid()
    and job_id in (select j.id from jobs j where j.customer_id in (select app.my_customer_ids()))
  );
create policy customer_private_notes_update on customer_private_notes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy customer_private_notes_delete on customer_private_notes for delete to authenticated
  using (user_id = auth.uid());

-- ---------- job_counters: internal (trigger runs as definer; no client access) ----------

-- ---------- jobs ----------
create policy jobs_select on jobs for select to authenticated
  using (
    app.is_bo(company_id)
    or app.worker_can_access_job(id)
    or customer_id in (select app.my_customer_ids())
  );
create policy jobs_insert on jobs for insert to authenticated
  with check (app.is_member(company_id) and created_by = auth.uid());
create policy jobs_update on jobs for update to authenticated
  using (app.is_bo(company_id) or app.worker_can_access_job(id))
  with check (app.is_bo(company_id) or app.worker_can_access_job(id));

-- ---------- job_photos ----------
create policy job_photos_select on job_photos for select to authenticated
  using (app.can_access_job(job_id));
create policy job_photos_insert on job_photos for insert to authenticated
  with check (
    app.is_member(company_id)
    and (app.is_bo(company_id) or app.worker_can_access_job(job_id))
    and uploaded_by = auth.uid()
  );
-- photos are evidence: no update policy; delete is BO-only
create policy job_photos_delete on job_photos for delete to authenticated
  using (app.is_bo(company_id));

-- ---------- quotes: BO builds/signs (spec §2); customers read their own ----------
create policy quotes_select on quotes for select to authenticated
  using (
    app.is_bo(company_id)
    or exists (
      select 1 from jobs j
      where j.id = quotes.job_id and j.customer_id in (select app.my_customer_ids())
    )
  );
create policy quotes_insert on quotes for insert to authenticated
  with check (app.is_bo(company_id) and created_by = auth.uid());
create policy quotes_update on quotes for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));
create policy quotes_delete on quotes for delete to authenticated
  using (app.is_bo(company_id) and status = 'draft');

create policy quote_line_items_select on quote_line_items for select to authenticated
  using (
    app.is_bo(company_id)
    or exists (
      select 1 from quotes q join jobs j on j.id = q.job_id
      where q.id = quote_line_items.quote_id
        and j.customer_id in (select app.my_customer_ids())
    )
  );
create policy quote_line_items_write on quote_line_items for insert to authenticated
  with check (app.is_bo(company_id));
create policy quote_line_items_update on quote_line_items for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));
create policy quote_line_items_delete on quote_line_items for delete to authenticated
  using (app.is_bo(company_id));

-- ---------- signatures: append-only log (spec §15.3) ----------
create policy signatures_select on signatures for select to authenticated
  using (app.can_access_job(job_id));
create policy signatures_insert on signatures for insert to authenticated
  with check (app.can_access_job(job_id));
-- No update/delete policies + append-only trigger + explicit REVOKE below.
revoke update, delete on signatures from anon, authenticated;

-- ---------- trucks ----------
create policy trucks_select on trucks for select to authenticated
  using (app.is_member(company_id));
create policy trucks_write on trucks for insert to authenticated
  with check (app.is_bo(company_id));
create policy trucks_update on trucks for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));
create policy trucks_delete on trucks for delete to authenticated
  using (app.is_bo(company_id));

-- ---------- schedule_entries: BO manages; worker views own (spec §2) ----------
create policy schedule_select on schedule_entries for select to authenticated
  using (
    app.is_bo(company_id)
    or exists (select 1 from workers w where w.id = schedule_entries.worker_id and w.user_id = auth.uid())
  );
create policy schedule_insert on schedule_entries for insert to authenticated
  with check (app.is_bo(company_id));
create policy schedule_update on schedule_entries for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));
create policy schedule_delete on schedule_entries for delete to authenticated
  using (app.is_bo(company_id));

-- ---------- invoices: BO-only issuance (spec §2, §15.10); customer reads own ----------
create policy invoices_select on invoices for select to authenticated
  using (
    app.is_bo(company_id)
    or exists (
      select 1 from jobs j
      where j.id = invoices.job_id and j.customer_id in (select app.my_customer_ids())
    )
  );
create policy invoices_insert on invoices for insert to authenticated
  with check (app.is_bo(company_id) and issued_by = auth.uid());
create policy invoices_update on invoices for update to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id));

-- ---------- payments ----------
create policy payments_select on payments for select to authenticated
  using (
    app.is_bo(company_id)
    or exists (
      select 1 from invoices i join jobs j on j.id = i.job_id
      where i.id = payments.invoice_id and j.customer_id in (select app.my_customer_ids())
    )
  );
create policy payments_insert on payments for insert to authenticated
  with check (app.is_bo(company_id));  -- manual cash/transfer marking; card flows via service role

-- ---------- materials: BO-only (spec §2) ----------
create policy materials_all on materials for all to authenticated
  using (app.is_bo(company_id)) with check (app.is_bo(company_id) and created_by = auth.uid());

-- ---------- share_tokens: service-role only (no policies) ----------
-- ---------- mfa_backup_codes: service-role only (no policies; hashed at rest §15.7) ----------

-- ---------- company_subscriptions ----------
create policy subscriptions_select on company_subscriptions for select to authenticated
  using (app.is_bo(company_id));
-- writes via service role only (webhook-driven)

-- ---------- billing_events ----------
create policy billing_events_select on billing_events for select to authenticated
  using (company_id is not null and app.is_bo(company_id));

-- ---------- consent_logs ----------
create policy consent_logs_select on consent_logs for select to authenticated
  using (user_id = auth.uid() or (company_id is not null and app.is_bo(company_id)));
create policy consent_logs_insert on consent_logs for insert to authenticated
  with check (user_id = auth.uid());
