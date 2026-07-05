# 華騰工程行 — Job Management SaaS

Multi-tenant job management for small trade companies (水電工程行): job
records, quotes with mutual signing, scheduling (workers + trucks),
invoicing (統一發票 / informal receipts), materials tracking, business
insights, and an opt-in customer portal.

Built per `docs/PRODUCT_SPEC.md` (the single source of truth). Next.js App
Router + TypeScript + Tailwind, Supabase (Postgres + RLS + Auth + Storage),
NewebPay for payments and e-invoices.

## Local development

Prereqs: Node 22+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage; applies migrations
cp .env.example .env.local  # then paste the keys `supabase start` printed
npm run dev
```

`npx supabase start` prints the local `ANON_KEY` and `SERVICE_ROLE_KEY`.

### Tests

```bash
npm run test:rls            # 38 security assertions against the local DB
node scripts/smoke.mjs      # route smoke test (needs `next start -p 3100`)
npx tsx scripts/test-pdf-font.tsx  # CJK PDF rendering sanity check
```

`test:rls` is the spec §15.1 requirement made executable: two fake
companies, cross-tenant reads must return nothing; plus worker/customer
role boundaries, the three private-note layers, append-only signatures,
quote immutability, the after-photo completion gate, and single-use invite
tokens.

## Architecture notes

- **RLS is the enforcement boundary** (`supabase/migrations/*_rls.sql`).
  Every tenant-scoped table is keyed on `company_id`. App-layer checks are
  UX; the database is the security control.
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) is server-only:
  `src/lib/supabase/admin.ts` imports `server-only` so client-side imports
  fail the build. Used only for webhooks, token redemption, and
  post-access-check signed URLs.
- **Phone+password without SMS**: Supabase phone auth requires an SMS
  provider, and the spec forbids SMS. Accounts are stored as email+password
  under a deterministic internal address derived from the normalized phone
  (`src/lib/auth/phone.ts`); the UI only ever shows phone numbers.
- **2FA is mandatory for BO/Worker**: middleware requires an `aal2` session
  for `/bo` and `/worker`; backup codes are bcrypt-hashed
  (`mfa_backup_codes`), and redeeming one removes the stale TOTP factor so
  the user re-enrolls.
- **Signatures are append-only** at the DB level: no UPDATE/DELETE grants,
  no policies, plus a trigger that blocks even the service role.
- **Photos** are compressed client-side (~1920px, JPEG 80%, EXIF
  auto-rotation). Capture time/GPS is extracted *before* compression into
  structured columns (dispute evidence); the uploaded binary carries no
  EXIF, so shared copies can't leak a customer's address. Offline captures
  queue in IndexedDB and flush on reconnect.
- **Payments**: invoices are marked paid only by the SHA-256-verified
  NewebPay webhook (`/api/webhooks/newebpay`); the browser return URL is
  display-only. SaaS subscriptions (Growth NT$590 / Pro NT$1,290) use
  NewebPay 定期定額; entitlements flip on the period webhook and live in the
  `plans.features` JSON — pricing changes are data, not code.

## Production setup checklist

1. Supabase project: run migrations (`npx supabase db push`), confirm both
   storage buckets are **private**, enable TOTP MFA, set session
   timebox/inactivity timeout (Auth → Sessions).
2. OAuth: configure Google + Facebook providers; add LINE as a **custom
   OIDC provider** named `line` (LINE is OIDC-compliant; free tier allows 3
   custom providers).
3. Auth rate limits: Supabase provides defaults — confirm they're enabled
   (spec §15.9), don't assume.
4. Env vars on Vercel: everything in `.env.example`; NewebPay + ezPay
   production credentials.
5. NewebPay back office: point the MPG and 定期定額 NotifyURLs at
   `/api/webhooks/newebpay` and `/api/webhooks/newebpay/period`.
6. Legal pages (`/legal/*`) are drafts from `docs/LEGAL_TEMPLATES.md` —
   lawyer review required before first paying tenant (spec §16); consent
   logging is already live.

## Repo map

```
supabase/migrations/   schema, RLS, storage policies, plan seed, grants
src/middleware.ts      session refresh + aal2 gating for staff areas
src/lib/               supabase clients, auth, i18n, actions, NewebPay
src/app/(bo)/bo/       owner app: pipeline, schedule, jobs, customers,
                       team, materials, insights, billing
src/app/(worker)/      worker app: my jobs, job detail
src/app/(customer)/    customer portal
src/app/auth/          login, signup, 2FA, invites, OAuth callbacks
src/app/{c,s,invite,pay}/  QR signup, share links, worker invites, payment
scripts/               RLS test suite, smoke test, PDF font check
```
