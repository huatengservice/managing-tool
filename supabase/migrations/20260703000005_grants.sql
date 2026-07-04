-- ============================================================
-- Base table privileges. Supabase's security model: anon/authenticated
-- hold table-level privileges and Row Level Security is the enforcement
-- boundary. These grants make that explicit (hosted projects get them via
-- default privileges; migration-created objects here did not).
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- RLS policies call app.* helper predicates as the querying role.
grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;
alter default privileges in schema app
  grant execute on functions to anon, authenticated, service_role;

-- Re-assert append-only after the blanket grant (spec §15.3): no UPDATE or
-- DELETE on the signature log for any client role. The trigger blocks the
-- service role as well.
revoke update, delete on signatures from anon, authenticated;

-- Tables with no policies stay locked to service-role-only access, but
-- keep client grants revoked too (defense in depth).
revoke all on customer_signup_tokens from anon, authenticated;
revoke all on share_tokens from anon, authenticated;
revoke all on mfa_backup_codes from anon, authenticated;
revoke all on job_counters from anon, authenticated;
