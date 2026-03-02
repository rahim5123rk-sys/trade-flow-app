# Product Requirements Document (PRD)
## TradeFlow — Trade Business Management App

**Version:** 1.0.0
**Bundle ID:** com.reezy95.tradeflowapp
**Platform:** iOS & Android (React Native / Expo)
**Last Updated:** March 2026
**Governing Law:** England & Wales

---

## 1. Product Overview

### 1.1 Purpose
TradeFlow is a mobile-first business management application built for tradespeople and their teams. It provides a unified platform to manage jobs, customers, workers, invoices, quotes, and gas safety certificates — replacing paper-based and fragmented workflows with a single tool.

### 1.2 Problem Statement
Tradespeople (electricians, gas engineers, plumbers, etc.) typically juggle multiple tools — paper job sheets, spreadsheets, WhatsApp, and separate invoicing software. This creates:
- Lost job records and disorganised documentation
- Difficulty tracking payment status
- Time-consuming manual invoice creation
- No audit trail for compliance documents (e.g. gas safety certificates)
- Poor communication between admin and field workers

### 1.3 Solution
TradeFlow consolidates all trade business operations into one mobile app with:
- Role-based access for admin and field worker
- Real-time job tracking and status updates
- Professional document generation (invoices, quotes, gas certificates)
- Photo and signature capture for proof of work
- Calendar scheduling and upcoming job visibility

### 1.4 Target Users
| User Type | Description |
|-----------|-------------|
| **Admin / Business Owner** | Manages the company, creates jobs, generates documents, views revenue |
| **Field Worker** | Assigned to jobs, updates status, captures photos and signatures |

### 1.5 Market
- UK-based tradespeople (gas engineers, plumbers, electricians, HVAC, builders, etc.)
- Small to medium trade businesses (1–20 employees)
- Solo traders managing their own work

---

## 2. Goals & Success Metrics

### 2.1 Business Goals
- Reduce time spent on admin tasks for tradespeople by 50%
- Become the go-to all-in-one tool for UK trade businesses
- Drive user retention through deep workflow integration

### 2.2 Key Success Metrics
| Metric | Target |
|--------|--------|
| Monthly Active Users (MAU) | Growth MoM |
| Average jobs created per user/month | ≥ 10 |
| Invoice/quote generation rate | ≥ 60% of jobs |
| Session length | ≥ 5 minutes |
| Day-7 retention | ≥ 40% |
| Gas certificate creation rate | Tracked by trade type |

---

## 3. User Stories

### 3.1 Admin (Business Owner)

| ID | As an admin, I want to... | So that... |
|----|--------------------------|------------|
| A1 | Create and assign jobs to workers | Workers know what to do each day |
| A2 | View all jobs with status filters | I can track overall business progress |
| A3 | Generate professional invoices from jobs | I get paid faster and look professional |
| A4 | Generate quotes for prospective clients | I can win new business efficiently |
| A5 | Create gas safety certificates (CP12/LGSR) | I meet legal compliance requirements |
| A6 | View revenue stats on my dashboard | I understand business performance |
| A7 | Manage my customer database | I have organised client records |
| A8 | Invite and manage workers | My team can use the app collaboratively |
| A9 | Generate and share PDFs via email | Clients receive professional documentation |
| A10 | Configure company and user details | The app represents my business correctly |

### 3.2 Worker (Field Operative)

| ID | As a worker, I want to... | So that... |
|----|--------------------------|------------|
| W1 | See only my assigned jobs | I stay focused without distractions |
| W2 | Update job status (start / finish) | The admin knows real-time job progress |
| W3 | Take and attach photos to jobs | I provide evidence of completed work |
| W4 | Capture customer signatures | I have proof of work sign-off |
| W5 | See today's schedule clearly | I plan my day efficiently |

---

## 4. Features & Requirements

### 4.1 Authentication & Onboarding

**Requirements:**
- Email and password authentication via Supabase Auth
- Email confirmation required before access is granted
- Multi-step registration:
  - Step 1: Personal details (name, email, password)
  - Step 2: Create company or join existing team via invite code
  - Step 3: Business address, phone, trade type selection
- GDPR consent acknowledgment on registration
- Forgot password and reset password flows
- Persistent session via secure token storage (expo-secure-store)
- Pending registration state handled across sessions

**Acceptance Criteria:**
- User can register and receive a confirmation email
- Invite code flow correctly places user under the correct company
- Sessions persist after app restart
- Incorrect credentials show clear error messages

---

### 4.2 Dashboard

**Requirements:**
- Personalised greeting based on time of day
- Stats cards (admin): Active jobs, Pending jobs, Total revenue
- Stats cards (worker): Active jobs, Pending jobs, Done jobs
- Quick action buttons: New Job, Quote, Invoice, Add Client, Gas Certificate
- Today's Schedule section with job count
- Up Next section (next 5 upcoming jobs)
- Navigation grid (admin): All Jobs, Customers, Team, Documents
- Pull-to-refresh
- First-time onboarding tips

**Acceptance Criteria:**
- Admin and worker views are distinct and role-appropriate
- Stats reflect real-time data from the database
- Quick actions navigate to correct screens with pre-context where relevant

---

### 4.3 Jobs Management

**Requirements:**

**Job List:**
- List all jobs with status indicators (pending, in progress, complete, paid)
- Admin: filter between All Jobs and My Jobs
- Worker: show only assigned jobs
- Swipe actions for status transitions and deletion
- Pull-to-refresh, empty state handling
- FAB to create new job (admin only)

**Create Job:**
- Quick mode (minimal fields) and Full mode toggle
- Fields: Title, Customer, Notes, Price, Duration, Scheduled Date/Time
- Optional worker assignment
- Auto-generated reference number (TF-YYYY-0001 format)
- Quote mode trigger option
- Job reminder scheduling

**Job Detail:**
- Hero card: status, reference, title
- Customer name and address
- Status progression flow
- Worker actions: Start Job, Add Photo, Finish Job (with signature capture)
- Admin actions: Change Status, Create Invoice, Generate PDF, Edit
- Google Maps integration for location
- Photo gallery (horizontal scroll)
- Customer signature display
- Payment status tracking
- Price visible to admin only

**Acceptance Criteria:**
- Jobs created appear immediately in the list
- Status transitions follow correct flow (pending → in progress → complete → paid)
- Workers can only see and interact with their assigned jobs
- Photos and signatures attach correctly to job records

---

### 4.4 Customers

**Requirements:**
- Customer directory with search (by name or address)
- Customer cards showing name, avatar initials, and address preview
- Add customer screen with fields: Name, Company, Address, Postcode, Email, Phone
- Contact import from device contacts (with permission)
- Pull-to-refresh
- FAB for adding new customers

**Acceptance Criteria:**
- Search filters results in real-time
- Contact import correctly populates the add customer form
- Customers are scoped to the company (no cross-company visibility)

---

### 4.5 Invoices

**Requirements:**
- Invoice meta: Number, Due Date, linked Job reference
- Customer selector (shared component)
- Job prefilling if created from job context
- Line items: Description, Quantity, Unit Price, VAT %
- Add and remove line items dynamically
- Discount percentage field
- Notes and payment instructions fields
- Real-time totals: Subtotal, Discount, Total (GBP)
- Save as Draft
- Save and Generate PDF
- Currency formatting: GBP (£)

**Acceptance Criteria:**
- Totals calculate correctly with VAT and discount applied
- PDF generates and can be shared via email or native share sheet
- Invoice linked to job is pre-populated with correct job data

---

### 4.6 Quotes

**Requirements:**
- Quote number and expiry date
- Line items matching invoice structure
- Scope of works and notes fields
- Terms field (default: "Valid for 30 days")
- Job prefilling capability
- Discount and totals calculation
- PDF generation and sharing

**Acceptance Criteria:**
- Quote PDF matches professional formatting
- Expiry date defaults correctly
- Quote can be converted to invoice (or referenced from job)

---

### 4.7 Gas Safety Certificates (CP12 / LGSR)

**Requirements:**
- Multi-step wizard (4 steps):
  1. Details: Landlord info, Tenant info (optional), Property address
  2. Appliances: List and details of gas appliances inspected
  3. Final Checks: Safety check results
  4. Review & Sign: Summary and digital signature
- Shared customer selector for landlord
- "Use landlord address" autofill for property
- Certificate duplication feature (pre-fill from previous certificate)
- Gas Safe branding on output
- PDF generation and sharing

**Acceptance Criteria:**
- All four steps must be completed before certificate generation
- Certificate PDF matches legal LGSR format
- Gas Safe registration number is captured and shown on certificate
- Duplicate feature correctly pre-fills from the most recent certificate

---

### 4.8 Workers / Team Management

**Requirements:**
- Team directory listing all workers under the company
- Worker cards: Avatar, Name, Email
- Invite worker via generated invite code
- Admin can remove workers
- Test user badge for dev/test accounts
- Pull-to-refresh

**Acceptance Criteria:**
- Invite code correctly associates new user to company
- Removed workers lose access immediately
- Workers appear in job assignment selector after joining

---

### 4.9 Documents

**Requirements:**
- Central document store for all generated documents
- Filter or list by type (invoices, quotes, certificates)
- View and re-share previously generated PDFs
- Document linked to originating job/customer

**Acceptance Criteria:**
- All generated documents appear in the document list
- PDFs can be reopened and reshared without regeneration

---

### 4.10 Settings

**Requirements:**
- Company Details: Name, Address, Phone, Logo
- User Details: Name, Email, Profile photo
- Privacy Policy (in-app, scrollable, GDPR compliant)
- Terms of Service (in-app, scrollable)
- Export My Data (GDPR right of access)
- Delete My Account (GDPR right to erasure)
- Logout

**Acceptance Criteria:**
- Company details reflect across all generated documents
- Account deletion removes all personal data within 30 days
- Export generates a downloadable data file

---

### 4.11 Calendar

**Requirements:**
- Calendar view of scheduled jobs
- Day view showing jobs for selected date
- Pull-to-refresh
- Tap to navigate to job detail

**Acceptance Criteria:**
- Jobs appear on their scheduled date
- Role filtering applies (workers see only their jobs)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- App launch time < 2 seconds on mid-range devices
- Job list loads within 1 second
- PDF generation completes within 5 seconds

### 5.2 Reliability
- 99.9% uptime for core backend services (Supabase)
- Offline state handled gracefully (clear error messaging, no crashes)

### 5.3 Security
- All data transmitted over TLS/SSL
- Authentication tokens stored in encrypted secure storage (expo-secure-store)
- Passwords hashed server-side (never stored plain text)
- Row-level security (RLS) enforced at database layer
- Company-scoped data access (no cross-company data leakage)
- ITSAppUsesNonExemptEncryption: false

### 5.4 Accessibility
- Supports iOS Dynamic Type
- Automatic light/dark mode support
- Tap targets meet minimum size requirements (44x44pt)

### 5.5 Localisation
- English (UK) only for v1.0
- Currency: GBP (£)
- Date format: DD/MM/YYYY

---

## 6. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81.5 + Expo 54 |
| Routing | Expo Router v6 |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Email Delivery | Resend |
| PDF Generation | expo-print + internal generator |
| State / Auth | React Context (AuthContext) |
| Secure Storage | expo-secure-store |
| Animations | React Native Reanimated v4 |
| Icons | Expo Vector Icons (Ionicons) |
| Calendar | react-native-calendars |
| Signature Capture | react-native-signature-canvas |
| Image Picker | expo-image-picker |
| Contacts | expo-contacts |
| Build / Deploy | EAS (Expo Application Services) |

---

## 7. Permissions

| Permission | Platform | Reason |
|-----------|----------|--------|
| Camera | iOS & Android | Capture job photos as proof of work |
| Photo Library | iOS & Android | Attach existing photos to job records |
| Contacts | iOS | Import customer details from device contacts |
| Push Notifications | iOS & Android | Job reminders and scheduling alerts |

---

## 8. Data & Privacy

### 8.1 Data Collected
- Personal: Name, email, password
- Business: Company name, address, phone, trade type, Gas Safe number
- Customer: Name, address, email, phone
- Job: Title, notes, price, status, photos, signatures, scheduled date
- Gas certificate: Landlord/tenant details, property address, appliance data
- Device: Push notification token

### 8.2 Data Processors
| Processor | Purpose |
|-----------|---------|
| Supabase | Database, authentication, file storage |
| Resend | Transactional email (document delivery) |
| Expo Push Notifications | Notification delivery |

### 8.3 GDPR Compliance
- Privacy Policy: In-app, GDPR-compliant (updated March 2026)
- Terms of Service: In-app, England & Wales law (updated March 2026)
- GDPR consent captured at registration
- User rights: Access, rectification, erasure, portability, restriction, objection
- Data retention: Account data until deletion; gas certificates minimum 2 years (legal)
- No data sold or used for advertising

---

## 9. Legal & Compliance

### 9.1 Gas Safety (Installation & Use) Regulations 1998
- App generates LGSR documents but does not verify Gas Safe registration
- User self-declares Gas Safe registration number
- Terms of Service include explicit indemnity clause
- Users are solely responsible for accuracy of gas certificate data

### 9.2 Financial Documents
- Invoices and quotes are the user's responsibility for HMRC/VAT compliance
- App does not process payments or hold financial data

### 9.3 GDPR (UK GDPR / Data Protection Act 2018)
- Data controller: TradeFlow
- Legal bases: Contract performance, legal obligation, legitimate interest, consent
- Full rights implementation in settings
- Third-party DPAs in place

---

## 10. Out of Scope (v1.0)

- In-app payment processing (Stripe, etc.)
- GPS/live location tracking of workers
- Automated VAT Returns / HMRC Making Tax Digital integration
- Multi-currency support
- Customer-facing portal
- Desktop / web app
- Offline mode with local data sync
- Gas Safe Register API verification
- Third-party integrations (Xero, QuickBooks, etc.)

---

## 11. Future Roadmap (Post v1.0)

| Priority | Feature |
|----------|---------|
| High | In-app payment processing |
| High | Stripe integration for invoice payments |
| High | HMRC Making Tax Digital (MTD) integration |
| Medium | Customer-facing job tracking portal |
| Medium | GPS worker tracking |
| Medium | Automated Gas Safe Register number verification |
| Medium | Xero / QuickBooks accounting integration |
| Low | Desktop / web dashboard for admins |
| Low | Multi-currency support |
| Low | Offline mode |

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gas certificate misuse (unqualified user) | Medium | High | Indemnity clause in ToS, self-declaration warning |
| Data breach via Supabase | Low | High | RLS policies, encrypted tokens, TLS |
| PDF generation failure | Low | Medium | Error handling with user feedback |
| App Store rejection (gas certificate feature) | Low | High | Clear disclaimer language, no verification claims |
| User generates incorrect invoice (tax error) | Medium | Medium | ToS places responsibility on user |
| Push notification permission denial | High | Low | Gracefully degrade (reminders not required) |

---

*TradeFlow PRD v1.0 — Confidential*
