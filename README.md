# 華騰工程行 — Job Management SaaS

Multi-tenant job management for small trade companies (水電工程行): job
records, quotes with mutual signing, scheduling (workers + trucks),
invoicing (統一發票 / informal receipts), materials tracking, business
insights, and an opt-in customer portal.

Built per `docs/PRODUCT_SPEC.md` (the single source of truth). Next.js App
Router + TypeScript + Tailwind, Supabase (Postgres + RLS + Auth + Storage),
TapPay for card payments; billing document is the 免用統一發票收據.

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
- **Payments (TapPay)**: card fields are TapPay-served iframes (prime
  tokenization — card numbers never touch us); charges are synchronous
  authenticated server calls, so payment truth is our own outbound call,
  not an inbound webhook. SaaS subscriptions (Growth NT$590 / Pro
  NT$1,290) charge month 1 at checkout with `remember: true`, store only
  the returned card token, and `/api/cron/billing` (Vercel cron, daily)
  renews monthly with a 7-day past-due grace before downgrade.
  Entitlements live in the `plans.features` JSON — pricing is data, not
  code.
- **Receipts**: 免用統一發票收據 PDF (seller/buyer blocks, 大寫金額, stamp
  areas). No e-invoice vendor — the business is a 小規模營業人 that doesn't
  issue 統一發票.

## Production setup checklist

1. Supabase project: run migrations (`npx supabase db push`), confirm both
   storage buckets are **private**, enable TOTP MFA, set session
   timebox/inactivity timeout (Auth → Sessions).
2. OAuth: configure the Google provider (callback:
   `https://<project-ref>.supabase.co/auth/v1/callback`). Google is the
   only social login — Facebook/LINE were dropped by owner decision
   (2026-07-05), diverging from spec §8; phone+password is the primary
   path.
3. Auth rate limits: Supabase provides defaults — confirm they're enabled
   (spec §15.9), don't assume.
4. Env vars on Vercel: everything in `.env.example` — TapPay keys
   (sandbox from portal.tappaysdk.com, production after merchant
   approval) and a random `CRON_SECRET` for the billing cron.
5. Legal pages (`/legal/*`) are drafts from `docs/LEGAL_TEMPLATES.md` —
   lawyer review required before first paying tenant (spec §16); consent
   logging is already live.

## Repo map

```
supabase/migrations/   schema, RLS, storage policies, plan seed, grants
src/middleware.ts      session refresh + aal2 gating for staff areas
src/lib/               supabase clients, auth, i18n, actions, TapPay
src/app/(bo)/bo/       owner app: pipeline, schedule, jobs, customers,
                       team, materials, insights, billing
src/app/(worker)/      worker app: my jobs, job detail
src/app/(customer)/    customer portal
src/app/auth/          login, signup, 2FA, invites, OAuth callbacks
src/app/{c,s,invite,pay}/  QR signup, share links, worker invites, payment
scripts/               RLS test suite, smoke test, PDF font check
```
