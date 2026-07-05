# Project: 華騰工程行 Job Management SaaS

Read `docs/PRODUCT_SPEC.md` in full before writing any code — it is the

single source of truth for every product decision. Reference

`docs/UI_REFERENCE.jsx` for the validated visual design.

`docs/LEGAL_TEMPLATES.md` is reference-only draft legal text.

## Conventions

- Next.js App Router, TypeScript, Tailwind

- Supabase for DB/Auth/Storage — Row Level Security on every tenant-scoped

  table, keyed on `company_id`

## Git Workflow

- Commit at meaningful checkpoints using Conventional Commits format

  (feat/fix/docs/refactor/test/chore).