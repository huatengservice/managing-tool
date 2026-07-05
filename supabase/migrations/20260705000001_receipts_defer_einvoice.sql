-- Owner decision 2026-07-05: the business is a small-scale operation that
-- doesn't issue 統一發票 — e-invoice (ezPay) is removed and the informal
-- receipt (免用統一發票收據) becomes the complete billing document.

-- Seller details shown on receipts.
alter table companies
  add column address text not null default '',
  add column phone   text not null default '';

-- Optional buyer 統編 printed on the receipt for business customers.
alter table invoices
  add column buyer_ubn text check (buyer_ubn ~ '^\d{8}$');

-- Keep the pricing page honest: no tier advertises e-invoice anymore.
update plans set features = jsonb_set(features, '{einvoice}', 'false');
