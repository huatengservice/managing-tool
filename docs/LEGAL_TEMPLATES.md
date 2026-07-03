# Legal Document Templates (Draft — Requires Lawyer Review)

> ⚠️ **These are structural templates following common SaaS industry patterns, not final legal text.** They exist so the product has something concrete to build the acceptance/consent-logging mechanism against now, without blocking development. Before real use — especially before your first paying tenant company or handling real customer PII — get these reviewed and finalized by a lawyer familiar with Taiwan's Personal Data Protection Act (PDPA) and standard commercial contract practice. Every `[bracketed]` field needs a real value; every section needs a legal review pass, not just a fill-in-the-blank.

---

## 1. Terms of Service (between the Platform and each Tenant Company)

**1. Acceptance of Terms**
By creating an account, [Company Name] ("you," "the Company") agrees to these Terms of Service with [Platform Name] ("we," "the Platform"). If you do not agree, do not use the Service.

**2. Description of Service**
The Platform provides job record management, quoting, scheduling, invoicing, and customer relationship tools for trade businesses, as described in the Platform's documentation. The Platform does not provide legal, tax, or accounting advice.

**3. Account Registration & Security**
You are responsible for maintaining the confidentiality of your account credentials, including any two-factor authentication method you configure. You must promptly notify us of any unauthorized access to your account. The Platform requires two-factor authentication for all Business Owner and Worker accounts as a condition of use.

**4. Subscription & Billing**
The Service is offered in tiers ([Starter — NT$0/month], [Growth — NT$590/month], [Pro — NT$1,290/month]). Fees for paid tiers are billed [monthly, in advance] via our payment processor. Prices may change with [30] days' notice. Failure to pay may result in suspension or downgrade of your account per §7.

**5. Data Ownership**
All job records, customer data, photos, and related content you input ("Customer Data") belong to you, the Company — not to the Platform, and not to individual Workers using the account. Upon termination, you may export your Customer Data for [30] days before it is deleted per our data retention policy.

**6. Acceptable Use**
You agree not to use the Service to store or transmit unlawful content, to misrepresent job records or financial transactions, or to attempt to circumvent the Service's security controls (including multi-tenant data isolation).

**7. Termination**
Either party may terminate with [30] days' notice. We may suspend or terminate immediately for material breach, non-payment, or unlawful use. Upon termination, §5 (data export) and our Data Processing Agreement's return/deletion provisions apply.

**8. Limitation of Liability**
To the maximum extent permitted by law, the Platform is not liable for indirect, incidental, or consequential damages arising from use of the Service, including disputes between you and your customers. The Service provides record-keeping and evidence tools; it does not mediate or resolve disputes between you and your customers.

**9. Disclaimer of Warranties**
The Service is provided "as is." We do not warrant that the Service will be error-free or uninterrupted.

**10. Governing Law & Dispute Resolution**
These Terms are governed by the laws of the Republic of China (Taiwan). Disputes shall be resolved [in the courts of ___ / via arbitration per ___] — *this clause specifically needs a lawyer's input on the right venue/mechanism*.

**11. Changes to Terms**
We may update these Terms with notice. Continued use after changes take effect constitutes acceptance.

---

## 2. Privacy Policy

**1. What We Collect**
- From you (the Company): business name, tax ID (統一編號, if provided), contact details, payment information (processed by our payment provider, never stored by us directly).
- From your Workers: name, phone number, pay rate (visible only to you), authentication credentials.
- From your Customers (collected by you, processed by us on your behalf): name, phone number, address, job details, photos, signatures.

**2. How We Use It**
To provide the Service (storing and displaying your records), to process payments, to send you service-related communications, and — in aggregated, de-identified form only — to understand feature usage and improve the product. **We do not use identifiable customer data collected on your behalf for our own purposes beyond providing the Service to you** (see the Data Processing Agreement below for the precise boundary).

**3. Data Storage & Security**
Data is stored with [Supabase], hosted in [region]. Photos and documents are stored in private, access-controlled storage — never publicly accessible. See PRODUCT_SPEC.md §15 for the technical security measures in place.

**4. Third Parties We Share Data With**
- [Supabase] — database, authentication, and file storage infrastructure.
- [NewebPay] — payment processing and e-invoice issuance.
- [Google / Facebook / LINE] — only if a Customer chooses to sign up using one of these, per their own privacy policies.

We do not sell data to third parties.

**5. Data Retention**
Job records are retained for [as long as your account is active, plus X years] to preserve their value as dispute evidence. You may request deletion per applicable law, subject to the retention needs described in §7 of the ToS.

**6. Your Rights**
You (and, through you, your Customers) may request access to or deletion of personal data, subject to Taiwan's PDPA. Contact [email] to exercise these rights.

**7. Contact**
[Company legal name, address, contact email]

---

## 3. Data Processing Agreement (DPA) — Platform as Processor for Tenant Companies

*This is the document that matters most given the PDPA analysis earlier in this project — the Platform is a data processor handling personal data on behalf of each tenant company, which is the data controller for its own customers' information.*

**1. Definitions**
"Controller" = the tenant Company. "Processor" = the Platform. "Personal Data" = any data relating to an identified or identifiable natural person processed under this Agreement (customer names, phone numbers, addresses, photos, etc.).

**2. Scope & Purpose of Processing**
The Processor processes Personal Data solely to provide the Service as described in the Terms of Service — job record storage, quoting, invoicing, scheduling, and related features. The Processor does not process Personal Data for any other purpose without the Controller's explicit instruction.

**3. Processor Obligations**
- Process Personal Data only on documented instructions from the Controller.
- Implement appropriate technical and organizational security measures (see PRODUCT_SPEC.md §15) — including Row Level Security for tenant data isolation, encrypted storage, and access controls on private notes.
- Ensure personnel with access to Personal Data are bound by confidentiality obligations.
- Notify the Controller without undue delay upon becoming aware of a personal data breach affecting their data.
- Assist the Controller in responding to data subject rights requests (access, correction, deletion) from their Customers.

**4. Sub-processors**
The Processor uses the following sub-processors: [Supabase] (hosting/database/storage), [NewebPay] (payment/e-invoice processing). The Processor will notify the Controller of any change in sub-processors.

**5. Data Return & Deletion**
Upon termination of the Service, the Processor will, at the Controller's choice, return all Personal Data (via data export, per ToS §5) and/or delete it within [30-90] days, except where retention is required by law.

**6. Audit Rights**
The Controller may request reasonable evidence of the Processor's compliance with this Agreement, such as security documentation, [subject to reasonable notice and frequency limits].

**7. Liability**
[This section requires specific legal drafting based on the actual risk allocation both parties agree to — do not use a generic clause here without review, given the real financial/reputational stakes of a data breach involving customer PII.]

---

*Reminder: these three documents are a starting structure, not something to ship as-is. The highest-priority items for actual legal review, in order: (1) the DPA's liability allocation in §7, (2) the ToS's dispute resolution mechanism in §10, (3) confirming the data retention periods in the Privacy Policy actually match PDPA requirements rather than an arbitrary guess.*
