# PRODUCT SPEC — Trade Business Job Management SaaS (Final, Consolidated)

This is the single source of truth for the build. It supersedes all earlier spec drafts (`trade-saas-spec-and-cost.md`, `trade-saas-spec-v2.md`) — those documents show the reasoning trail; this one is what to actually build. Example company used throughout: 華騰工程行.

---

## 1. What This Is

A multi-tenant SaaS for small trade companies (starting with one real company, ~3 workers) to manage job records, quotes, scheduling, invoicing, and customer relationships — not a marketplace, not a lead-gen platform. Three roles: **Business Owner (BO)**, **Worker (W)**, **Customer (C)**.

## 2. Roles & Permissions

| Capability | BO | Worker | Customer |
|---|---|---|---|
| See all jobs/workers/customers | ✅ | Own assigned jobs only | Own job history only |
| Create/edit job records | ✅ | ✅ | — |
| Upload before/after photos | ✅ | ✅ | — |
| Build/sign quotes | ✅ | — | Signs (device handoff or own account) |
| Mark job complete | ✅ | ✅ | Signs (device handoff or own account) |
| Issue invoices | ✅ only | ❌ | — |
| **BO's private notes about a customer** | ✅ only — never visible to Worker or that Customer | ❌ | ❌ |
| **BO's private notes about a worker** | ✅ only — never visible to that Worker | ❌ | — |
| **Customer's own private notes** | ❌ | ❌ | ✅ only — never visible to BO or Worker |
| Team management (roster, rates, invites) | ✅ only | — | — |
| Materials purchase log | ✅ | — | — |
| Business insights/profitability | ✅ only | — | — |
| Schedule/assign jobs | ✅ | View own only | — |

## 3. Core Flow

1. **Job creation** (BO or Worker): customer name, phone, address, category (**水 / 電** — separate, not combined), description, urgency (一般/緊急), `needs_truck` checkbox, estimated working time (**store as structured hours, not free text** — e.g. `estimated_hours: 12`, not `"1.5 天"`), optional before-photos.
2. **Quoting** (BO): itemized line items (description, qty, unit price). BO signs first (authenticated in-app action). Customer signs second — either **device handoff** (BO/W hands their device to the customer, who draws a signature or taps confirm) or, if the customer has an account, **remotely** from their own device. Both mechanisms log identically: timestamp, party, mechanism.
3. **Scheduling**: once a quote is accepted, BO assigns it via the schedule board (see §6). A job needing a truck also gets a truck assignment, checked for conflicts.
4. **Work performed**: Worker (or BO, if they personally do the job) updates the job with after-photos (**required** — job cannot be marked complete without at least one after-photo) and actual working time. If actual time differs meaningfully from estimated, an optional variance note explains why.
5. **Completion sign-off**: same mutual-signing pattern as quoting — whoever did the work signs first, then the customer (device handoff or remote).
6. **Invoicing** (BO only): choice of **official e-invoice (統一發票)** or **informal receipt**. Payment via card online or manual cash/transfer marking. Both quote and invoice have a **Share** button generating a secure unguessable link and/or downloadable PDF, exposed through the device's native share sheet (Web Share API) — no messaging integration required.

## 4. Job Status Pipeline

`Created → Quoted → Accepted → In Progress → Work Done → Invoiced → Paid`

Side-states: `Cancelled` (requires a reason, logged with who/when), `Disputed` (flagged manually by BO — the platform holds evidence, it does not mediate).

## 5. Photos

- Both BO and Worker can upload before/after photos (the BO may personally perform work).
- Client-side compression before upload (resize to ~1920px longest edge, JPEG ~80% quality) and EXIF auto-rotation.
- Timestamp/GPS metadata is **kept** on the stored original (dispute evidence) but **stripped** from any copy sent via the Share feature (avoid leaking a customer's home address).
- At least one after-photo is a hard requirement before a job can be marked complete.

## 6. Dashboards

- **Pipeline (Kanban)**: jobs grouped by status column. BO-only, full visibility.
- **Schedule**: Google Calendar-style (week/month toggle), built with `react-big-calendar` (free, MIT — **not** FullCalendar Premium, which requires a ~$480 paid license for the resource-timeline view). Draggable event blocks to reschedule/reassign. "New Entry" popup: searchable job dropdown (only jobs at Accepted+ stage) → worker dropdown → truck dropdown (conditional, only if `needs_truck`, checked for time-conflicts) → estimated time auto-displayed (read-only) → date/time. Trucks are modeled as a second bookable resource alongside workers; conflicts are surfaced for the BO to resolve manually (no auto-optimization needed at this scale — this isn't a GPS/routing problem, it's a shared-resource-booking problem).
- **Customers directory**: one row per customer, expandable to show private notes (BO-only, structured tags — e.g. "pays-late", "access-notes" — not open-ended personality text) and full job history. This is where private notes live — not buried in individual job tabs.
- **Materials purchase log**: date, supplier, item, qty, unit price, subtotal, optional linked job. Filterable by supplier **and** by date range (quick presets: this week / this month / last month / custom range) — used to cross-check a supplier's month-end bill.
- **Business Insights**: revenue / labor cost / material cost / profit / margin, both aggregate and per-job (surfacing low-margin jobs), an unpaid-invoices alert, and a revenue-vs-cost trend chart.

## 7. Team Management (BO-only)

Worker roster: name, phone, active/inactive, **hourly or daily rate** (used for labor-cost calculations in Insights — **never shown to the worker themselves**). Invite flow: BO enters name/phone/rate, generates an invite link. Deactivating a worker keeps their historical job records with the company.

**Private notes about each worker** (BO-only, never visible to the worker or anyone else): structured tags (quick-glance, e.g. "reliable," "occasionally late") plus a free-text log for specific incidents/observations (e.g. a customer complaint, a strength worth noting) — this is distinct from, and in addition to, the customer-facing private notes in §6, and exists specifically to help the BO decide how to staff and manage each worker over time.

## 8. Authentication & Security

- **Account creation and login for BO and Worker** offer the same four options as the customer flow (§9): **phone number + password**, or continue with **Google / Facebook / LINE**. This applies consistently at company signup, worker invite acceptance, and returning login — whichever method was used to sign up must also be available at login.
- **2FA is mandatory regardless of which method was used to authenticate** — TOTP authenticator app (Google Authenticator/Authy), not SMS (keeps cost at zero; BO/Worker accounts hold sensitive data and warrant the extra step beyond whatever Google/Facebook/LINE's own login security provides). Enrollment flow: QR code + manual key fallback → 6-digit confirmation → backup recovery codes (user must acknowledge saving them before continuing).
- **Phone number is still collected and used as the primary identifier** even when signing up via OAuth (auto-filled from the provider profile if available, entered manually otherwise) — needed for the invite-matching, multi-company, and roster-display mechanics described below.
- **Company signup** (BO, first time) is a **public, discoverable** entry point — a real "Sign Up" / "建立公司帳號" path, separate and clearly distinguished from "Log In," not buried inside the login screen. This is how any new company (starting with the pilot company) gets started at all: company name, optional 統一編號 (can be added later), then phone+password or Google/Facebook/LINE → 2FA enrollment.
- **Worker invite is NOT publicly discoverable** — a worker never self-registers. The exact mechanics:
  1. BO adds a worker via Team Management (name, phone, rate) — this single action both adds them to the roster *and* generates a unique, single-use invite link/token.
  2. The roster shows this worker with status **Invited** (not yet Active) until they complete setup.
  3. BO must be shown the generated link immediately (copy button and/or native share sheet — no automated SMS/messaging) so they can personally send it to the worker via whatever channel they use (LINE, text, in person).
  4. The worker opens that unique link and lands **directly** on the invite-acceptance screen (phone pre-filled from the invite, then chooses phone+password or Google/Facebook/LINE) → 2FA enrollment. They never see or need the generic login screen for this step.
  5. Once accepted, roster status flips from Invited to Active.
  6. BO can resend (regenerate) or revoke a pending invite link from the roster.
- **Multi-company accounts**: if one phone number/account belongs to more than one company, show a company picker between credentials and 2FA. Skip entirely for the common single-company case — no added friction.
- Sessions auto-expire after inactivity.

## 9. Customer Access (No Account Required by Default)

- Default: no account. BO/Worker device-handoff covers all signing needs.
- **Opt-in account**: BO/Worker shows a QR code (tied to that specific customer record) on their own device. Customer scans with their phone's native camera (no custom scanner needed — it's just a URL), lands on a signup page with phone number pre-filled, and either sets a password or continues with Google / Facebook / **LINE** (LINE via Supabase's Custom OIDC Provider support — LINE is OIDC-compliant, fits within Supabase's free-tier 3-custom-provider limit).
- Once an account exists, it shows the customer's **full job history**, not just jobs going forward.
- **No SMS anywhere in this flow** — this was deliberately removed; it's not needed since the QR/device-handoff pattern covers the default case, and SMS added cost and a friend-requirement dependency (in the LINE case) without enough benefit to justify it.
- Customers can add their own private notes to any job — visible only to them, never to BO or Worker.

## 10. Billing (the SaaS itself)

Three tiers — plan/entitlement data model built now so pricing changes are config, not code:

| Tier | Price | Notes |
|---|---|---|
| 入門版 (Starter) | **NT$0/month** | Core recordkeeping, scheduling, informal billing |
| 成長版 (Growth) | **NT$590/month** | Adds e-invoice, online payment, cross-worker dashboard |
| 專業版 (Pro) | **NT$1,290/month** | Higher limits, priority support |

Clicking Tier 2/3 routes to a real payment/checkout flow (tiers 2 and 3 are priced for real, not placeholders) — this needs a working NewebPay subscription/recurring-billing integration from the start, not deferred.

## 11. Language Toggle

The toggle switches the **app's own interface** (nav, buttons, labels, headers, status names) between Traditional Chinese and English — **never business data** (customer names, addresses, job descriptions, supplier names stay exactly as entered, since that's real content entered by Taiwan users about Taiwan customers). When Chinese is selected, labels are pure Chinese with no leftover English fragments (e.g. no "(BO)" suffix), and vice versa.

## 12. Data Model (Key Entities)

`companies` (tenant, plan tier, optional 統一編號), `plans` (feature entitlements per tier), `users` (BO/Worker, RBAC via RLS keyed on `company_id`), `customers`, `customer_accounts` (optional, created via QR opt-in), `jobs` (category, description, urgency, `needs_truck`, `estimated_hours`, `actual_hours`, `variance_note`, `cancellation_reason`, status), `job_photos` (typed before/after, EXIF-processed), `quotes` + `quote_line_items`, `signatures` (append-only: job/quote reference, party, mechanism [device-handoff | remote-account], timestamp), `invoices` (typed e-invoice | informal), `payments`, `bo_customer_notes` (structured tags, one set per customer), `materials` (date, supplier, item, qty, unit price, optional job link), `trucks`, `schedule_entries`.

**Critical**: every tenant-scoped table is filtered by `company_id` via Postgres Row-Level Security — this is the single most important security control in the system.

## 13. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, PWA | No native app; lightweight offline queue (service worker + IndexedDB) covers photo/note capture in poor-signal areas |
| Backend | Supabase (Postgres + RLS + Auth + Storage) | One vendor, bundled, RLS-native multi-tenancy |
| Auth | Supabase Auth: phone+password (native), Google/Facebook (built-in), LINE (custom OIDC provider) | Covers all required login paths without custom auth code |
| File storage | Supabase Storage, private buckets, signed URLs | Confirmed cheaper-in-practice than AWS S3/Cloudflare R2/Backblaze B2 for this app's profile (private, low-egress, authenticated access) — R2's zero-egress advantage matters for public high-traffic content, not this use case. Revisit only if the product ever adds public-facing photo galleries. |
| Signatures | `react-signature-canvas` | Captures device-handoff signature as an image |
| QR codes | `qrcode` (npm) | Encodes signed token/URL tied to customer record |
| Photo handling | `browser-image-compression` + EXIF orientation correction | Standardization requirement — see §5 |
| Schedule board | `react-big-calendar` (MIT, free) | NOT FullCalendar Premium — same visual pattern achievable for $0 |
| Drag-and-drop | Native HTML5 drag events, or `@dnd-kit` if more polish is needed | |
| PDF generation | `@react-pdf/renderer` or `pdf-lib` | Informal receipts |
| E-invoice + payment | **NewebPay** (not ECPay, not TapPay) | TapPay doesn't bundle e-invoice (would need 2 vendors); NewebPay's back-office is cleaner than ECPay's for non-technical business-owner users |
| Charts | `recharts` | Business Insights page |
| Sharing | Web Share API + signed token links | No messaging integration needed |
| Client-side data caching | SWR or TanStack Query | Avoids redundant re-fetching when navigating between pages (e.g. back to Pipeline after viewing a job) — cheap to add, real UX benefit. No server-side cache (Redis, etc.) needed at this scale; that solves a high-concurrency problem this app doesn't have |
| Hosting | Vercel (app) + Supabase (backend) | |

**Codebase architecture**: a single Next.js monolith, organized by role (`app/(bo)/`, `app/(worker)/`, `app/(customer)/`), not a monorepo or microservices split. A monorepo would only make sense if a native mobile app were also being built and needed to share code — not the case here (see §14). Revisit this decision only if that changes.

## 14. Explicitly Out of Scope for v1

- Native mobile apps
- SMS/LINE automated messaging for notifications
- GPS/live-location tracking, automated route optimization
- Formal third-party e-signature vendor (in-app mutual signing log is the mechanism)
- Recurring/repeating job schedules (one-off only)
- Public-facing marketplace/lead-gen features (this is a standalone tool, separate from any earlier marketplace concept)

## 15. Security Requirements (Mandatory — Build In From Day One)

A security review at spec stage, not after the fact — retrofitting these later is far riskier than building them in from Phase 0. Ordered by severity; the first four are non-negotiable for a multi-tenant system holding financial and personal data.

### Critical (build these first, in Phase 0)

1. **Multi-tenant data isolation.** The single most catastrophic failure mode: a bug that lets Company A see Company B's customers, jobs, or financials. Every tenant-scoped table must have Row Level Security enabled and tested — not just "written," actually tested with two fake companies to confirm cross-tenant queries return nothing. Do not rely on application-layer filtering alone; RLS must be the enforcement boundary at the database level.
2. **Supabase service role key must never reach the client.** This key bypasses RLS entirely. It belongs only in server-side code (Next.js Server Actions/API routes), never in any client-shipped bundle or environment variable prefixed for browser exposure. A leaked service role key is equivalent to a full data breach.
3. **Append-only signature log.** The evidentiary value of the mutual-signing feature (§3) depends entirely on the `signatures` table being genuinely immutable — no `UPDATE` or `DELETE` permission for any role, including BO, enforced at the database level, not just hidden in the UI. If this can be edited after the fact, it's worthless as evidence in a dispute.
4. **Payment webhook validation.** NewebPay's payment confirmation webhook must be signature-verified before trusting it — an unvalidated webhook is an open door for anyone to fake a "payment succeeded" event and mark an invoice paid without actually paying.

### High priority

5. **Private data access control.** Three separate private-data layers exist (BO's notes about customers, BO's notes about workers, customers' own notes) — each needs its own tested access boundary, not a shared "is this private" flag. A bug leaking any of these undermines the product's core trust proposition.
6. **Photo/document storage.** Private Supabase Storage buckets only, signed URLs with short expiry, never public buckets. Confirm this explicitly during Phase 0 — it's an easy default to get wrong (public buckets are often the path of least resistance when testing).
7. **2FA backup codes must be hashed at rest**, the same way passwords are — never stored as plaintext. A database breach shouldn't hand out working login bypasses.
8. **QR/invite tokens must be unguessable and single-use or time-limited.** A sequential or predictable ID would let someone enumerate and access other customers' records, or reuse a stale worker-invite link to join a company they shouldn't have access to.
9. **Rate limiting on auth endpoints** — login attempts, 2FA code attempts, password reset — to prevent brute-force. Supabase Auth provides some of this by default; confirm it's actually enabled, don't assume.
10. **Enforce business rules at the database/API layer, not just the UI.** Example: a Worker's client-side "Invoice" button is hidden per §2, but the API must independently reject an invoice-creation request from a Worker's account even if someone bypasses the UI. The same applies to editing an already-signed quote — block it server-side, not just visually.

### Standard practice, worth confirming explicitly

11. React's default output escaping handles most XSS risk automatically — confirm no use of `dangerouslySetInnerHTML` anywhere user-generated text (job descriptions, notes) flows through.
12. CSRF protection on state-changing API routes (Next.js/Supabase defaults handle most of this via same-site cookies — confirm, don't assume).
13. OAuth flows (Google/Facebook/LINE) must validate state/nonce parameters to prevent account-linking attacks.
14. Data export and deletion capability for a tenant company that churns — both a good practice and likely a PDPA expectation, per the earlier legal review notes.

### Explicitly deferred (not needed at this stage, revisit if the product scales significantly)

- Formal penetration testing / third-party security audit — worth doing once there's real paying-customer data at stake, premature for a single-company pilot.
- SOC 2 / formal compliance certification — an enterprise-sales concern, not relevant yet.

## 16. Status: Prior Open Items Resolved

- ✅ Pricing locked in: NT$0 / NT$590 / NT$1,290 (Starter / Growth / Pro).
- ✅ Private notes confirmed as three separate, non-overlapping systems (BO→customer, BO→worker, customer→self) — see the updated table in §2. No worker-authored notes about customers exist in this product.
- ✅ Legal documents: common industry-standard templates for Terms of Service, Privacy Policy, and a Data Processing Agreement are provided in `LEGAL_TEMPLATES.md` as a starting draft. **These are templates based on standard SaaS industry patterns, not final legal text** — they still need a lawyer's review before real use, especially the PDPA-specific data-processor obligations and the in-app signature mechanism's evidentiary weight in an actual Taiwan dispute. Building the acceptance/consent-logging mechanism can proceed now; treat the wording itself as provisional.
