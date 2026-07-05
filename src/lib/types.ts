// Row types mirroring supabase/migrations/20260703000001_schema.sql.

export type MembershipRole = "bo" | "worker";
export type WorkerStatus = "invited" | "active" | "inactive";
export type RateType = "hourly" | "daily";
export type JobCategory = "water" | "electric";
export type JobUrgency = "normal" | "urgent";
export type JobStatus =
  | "created"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "work_done"
  | "invoiced"
  | "paid"
  | "cancelled";
export type PhotoType = "before" | "after";
export type QuoteStatus = "draft" | "bo_signed" | "accepted";
export type SignatureSubject = "quote" | "completion";
export type SignatureParty = "bo" | "worker" | "customer";
export type SignatureMechanism = "device_handoff" | "remote_account";
export type InvoiceType = "einvoice" | "receipt";
export type InvoiceStatus = "unpaid" | "paid" | "voided";
export type PaymentMethod = "card" | "cash" | "transfer";
export type PaymentStatus = "pending" | "succeeded" | "failed";
export type SubscriptionStatus = "active" | "pending" | "past_due" | "cancelled";
export type PlanId = "starter" | "growth" | "pro";

/** Pipeline order for Kanban columns and the job-detail stepper. */
export const JOB_PIPELINE: JobStatus[] = [
  "created",
  "quoted",
  "accepted",
  "in_progress",
  "work_done",
  "invoiced",
  "paid",
];

export interface Plan {
  id: PlanId;
  name_zh: string;
  name_en: string;
  price_monthly: number;
  features: {
    einvoice: boolean;
    online_payment: boolean;
    cross_worker_dashboard: boolean;
    max_workers: number | null;
    max_jobs_per_month: number | null;
    priority_support: boolean;
  };
  sort: number;
}

export interface Company {
  id: string;
  name: string;
  tax_id: string | null;
  address: string;
  phone: string;
  plan_id: PlanId;
  created_at: string;
}

export interface Profile {
  user_id: string;
  phone: string;
  display_name: string;
}

export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: MembershipRole;
  active: boolean;
}

export interface Worker {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  status: WorkerStatus;
  user_id: string | null;
  invite_expires_at: string | null;
  activated_at: string | null;
}

export interface WorkerRate {
  worker_id: string;
  company_id: string;
  rate_type: RateType;
  rate: number;
}

export interface BoWorkerNote {
  worker_id: string;
  company_id: string;
  tags: string[];
  log: string;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface BoCustomerNote {
  customer_id: string;
  company_id: string;
  tags: string[];
}

export interface Job {
  id: string;
  company_id: string;
  job_number: number;
  code: string;
  customer_id: string;
  category: JobCategory;
  description: string;
  urgency: JobUrgency;
  needs_truck: boolean;
  estimated_hours: number | null;
  actual_hours: number | null;
  variance_note: string | null;
  status: JobStatus;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  disputed: boolean;
  disputed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface JobPhoto {
  id: string;
  company_id: string;
  job_id: string;
  type: PhotoType;
  storage_path: string;
  taken_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface Quote {
  id: string;
  company_id: string;
  job_id: string;
  status: QuoteStatus;
  created_by: string;
  created_at: string;
  accepted_at: string | null;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  company_id: string;
  description: string;
  qty: number;
  unit_price: number;
  position: number;
}

export interface Signature {
  id: string;
  company_id: string;
  job_id: string;
  quote_id: string | null;
  subject_type: SignatureSubject;
  party: SignatureParty;
  mechanism: SignatureMechanism;
  signer_user_id: string | null;
  signer_name: string | null;
  image_path: string | null;
  signed_at: string;
}

export interface Truck {
  id: string;
  company_id: string;
  name: string;
  active: boolean;
}

export interface ScheduleEntry {
  id: string;
  company_id: string;
  job_id: string;
  worker_id: string;
  truck_id: string | null;
  starts_at: string;
  ends_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  job_id: string;
  quote_id: string | null;
  type: InvoiceType;
  number: string;
  amount: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  buyer_ubn: string | null;
  einvoice_number: string | null;
  einvoice_random: string | null;
  issued_at: string;
  paid_at: string | null;
}

export interface Payment {
  id: string;
  company_id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string;
  provider_trade_no: string | null;
  created_at: string;
}

export interface Material {
  id: string;
  company_id: string;
  purchased_on: string;
  supplier: string;
  item: string;
  qty: number;
  unit_price: number;
  job_id: string | null;
  created_at: string;
}

export interface CustomerPrivateNote {
  id: string;
  user_id: string;
  job_id: string;
  note: string;
  updated_at: string;
}

export interface JobFinancials {
  job_id: string;
  company_id: string;
  code: string;
  status: JobStatus;
  customer_id: string;
  revenue: number;
  labor_cost: number;
  material_cost: number;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  newebpay_period_no: string | null;
  period_start: string | null;
  period_end: string | null;
}
