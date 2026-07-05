-- Payments moved from NewebPay to TapPay (owner decision 2026-07-05).
-- Recurring billing is self-managed: the checkout stores TapPay's card
-- token (never the card number) and a scheduled job charges it monthly.

alter table company_subscriptions
  drop column newebpay_period_no,
  add column card_key      text,
  add column card_token    text,
  add column billing_email text;
