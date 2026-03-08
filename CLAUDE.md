# TradeFlow App — Claude Context

> **One-liner:** React Native (Expo SDK 54) job management app for tradespeople (plumbers, gas engineers, etc.) with Supabase backend.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Expo ~54, React Native 0.81, React 19 |
| Routing | expo-router v6 (file-based, tabs + stacks) |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions, Storage) |
| Styling | StyleSheet + glassmorphism design system (`constants/theme.ts`) |
| Animations | react-native-reanimated ~4.1 |
| Auth | Supabase Auth with expo-secure-store (chunked token storage) |

---

## Project Structure

```
trade-flow-app/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root: providers (Auth, Theme, SafeArea, Gesture)
│   ├── index.tsx                 # Entry point redirect
│   ├── (auth)/                   # Auth stack (login, register, forgot-password, etc.)
│   └── (app)/                    # Main app (tab layout)
│       ├── _layout.tsx           # Tab nav: Dashboard, Calendar, Jobs, Documents (admin)
│       ├── dashboard.tsx         # Home screen with stats, quick actions, today's schedule
│       ├── calendar.tsx          # Calendar view
│       ├── jobs/
│       │   ├── index.tsx         # Jobs list with FAB (admin), swipeable cards
│       │   ├── create.tsx        # Create job form (full + quick entry toggle)
│       │   └── [id]/             # Job detail + edit screens
│       ├── customers/            # Customer CRUD
│       ├── workers/              # Team management
│       ├── documents/            # Invoice/quote viewer
│       ├── settings/             # User & company settings
│       ├── cp12/                 # Gas safety certificate flow (multi-step wizard)
│       ├── quote.tsx             # Quote creation
│       └── invoice.tsx           # Invoice creation
├── components/
│   ├── CustomerSelector.tsx      # Shared customer picker/creator (used in job + document creation)
│   ├── WorkerPicker.tsx          # Worker assignment (toggle list of team members)
│   ├── JobCard.tsx               # Reusable job card
│   ├── CalendarStrip.tsx         # Horizontal date selector
│   ├── SignaturePad.tsx          # Signature capture (WebView-based)
│   ├── Onboarding.tsx            # First-run tips overlay
│   ├── StatusBadge.tsx           # Status pill component
│   ├── Badge.tsx, Avatar.tsx, Card.tsx, Input.tsx
│   └── ui/Button.tsx, EmptyState.tsx
├── hooks/
│   ├── useJobs.ts                # useJobs (fetch+filter), useCreateJob, useUpdateJobStatus
│   ├── useCustomers.ts           # Customer CRUD hooks
│   ├── useWorkers.ts             # Team member hooks
│   └── useRealtime.ts            # Real-time subscriptions (jobs, job_activity, generic)
├── src/
│   ├── config/supabase.ts        # Supabase client (chunked SecureStore adapter)
│   ├── context/
│   │   ├── AuthContext.tsx        # Auth provider (session, profile, role)
│   │   ├── ThemeContext.tsx       # Light/dark mode provider
│   │   └── OfflineContext.tsx     # Offline detection
│   ├── services/
│   │   ├── notifications.ts      # Push notifications (expo-notifications)
│   │   ├── email.ts              # Email via Supabase edge function
│   │   ├── storage.ts            # File upload to Supabase Storage
│   │   ├── DocumentGenerator.ts  # PDF generation for invoices/quotes
│   │   └── cp12PdfGenerator.ts   # Gas cert PDF generation
│   └── types/
│       ├── index.ts              # Core types: UserProfile, Job, Customer, Document
│       └── cp12.ts               # Gas safety certificate types
├── constants/
│   └── theme.ts                  # Design tokens: UI (light), DarkUI, Colors, gradients, glass
├── supabase/
│   ├── config.toml               # Local dev config
│   ├── migrations/               # 5 SQL migrations
│   └── functions/send-email/     # Deno edge function (Resend transactional email)
└── package.json
```

---

## Database Schema (Supabase / Postgres)

### Tables

**`profiles`** — User accounts (synced with Supabase Auth)
- `id` (uuid, FK → auth.users), `email`, `display_name`, `company_id` (FK → companies), `role` ('admin' | 'worker'), `push_token`, `accepted_gas_safe_terms`, `gas_safe_terms_accepted_at`

**`companies`** — Business entities
- `id`, `name`, `invite_code`, `logo_url`, `email`, `phone`, `address`, `trade`
- `settings` (jsonb): `{ nextJobNumber, signatureBase64, invoiceTerms, quoteTerms }`

**`jobs`** — Work assignments
- `id`, `company_id`, `reference` (e.g. TF-2026-0001), `customer_id` (FK), `customer_snapshot` (jsonb — denormalized name+address for display)
- `title`, `assigned_to` (uuid[]), `status` ('pending' | 'in_progress' | 'complete' | 'paid' | 'cancelled')
- `scheduled_date` (bigint, epoch ms), `estimated_duration`, `price`, `notes`, `photos` (text[]), `signature`, `payment_status`

**`customers`** — Client records
- `id`, `company_id`, `name`, `company_name`, `address_line_1`, `address_line_2`, `city`, `region`, `postal_code`, `address` (computed full address), `phone`, `email`

**`documents`** — Invoices, quotes, CP12 certificates
- `id`, `company_id`, `type` ('invoice' | 'quote' | 'cp12'), `number`, `reference`, `status`, `date`, `expiry_date`
- `job_id`, `customer_id`, `customer_snapshot` (jsonb), `job_address` (jsonb)
- `items` (jsonb[] — line items with description, qty, unitPrice, vatPercent)
- `subtotal`, `discount_percent`, `total_vat`, `total`, `notes`, `payment_info`

**`job_activity`** — Audit log
- `job_id`, `company_id`, `actor_id`, `action` (e.g. 'created', 'status_change'), `details` (jsonb)

**`global_counters`** — Sequences (CP12 reference numbers)

### Storage Buckets
- `job-photos` — Job site photographs
- `logos` — Company logos

### RLS Policies
- Users can only read/update their own company
- Users can view teammates in same company (via `current_user_company_id()` helper)
- All data scoped by `company_id`

### Edge Functions
- `send-email` — Transactional email via Resend (supports PDF attachments)

### RPCs
- `create_company_and_profile` — Registration
- `delete_user_account` — GDPR-compliant cascade deletion
- `get_next_gas_cert_reference` — Atomic CP12 reference counter

---

## Key Patterns

### Auth & Data Scoping
- All queries filter by `userProfile.company_id` from `AuthContext`
- Workers see only jobs in their `assigned_to` array
- Admins see all company jobs

### Job Creation Flow
1. Get next reference number from `companies.settings.nextJobNumber`
2. Create/select customer → get `customer_id`
3. Build `customer_snapshot` (denormalized copy for display)
4. Insert into `jobs` table
5. Schedule push notification reminders
6. Increment `nextJobNumber` in company settings
7. Log to `job_activity`

### Real-time
- `useRealtimeJobs(companyId, callback)` — listens to jobs table changes
- `useRealtimeJobActivity(jobId, callback)` — listens to activity for a job
- `useRealtimeTable(table, filter, callback)` — generic subscription

### Design System
- Single source of truth: `constants/theme.ts`
- `UI` object for light mode, `DarkUI` for dark mode
- Glassmorphism cards (semi-transparent backgrounds, blur)
- `Colors` compat layer for older components
- Status colors: pending=amber, in_progress=blue, complete=emerald, paid=violet

### Roles
- `admin` — Full access: create jobs, view revenue, manage team, create documents
- `worker` — View assigned jobs, update status, take photos

---

## Common Tasks

### Adding a new screen
1. Create file in `app/(app)/` following expo-router conventions
2. If it needs a stack, create a `_layout.tsx` in its folder
3. Add to tab layout if visible, or set `href: null` if hidden

### Adding a new database table
1. Create migration in `supabase/migrations/`
2. Add TypeScript interface in `src/types/index.ts`
3. Add RLS policy scoped to `company_id`
4. Create hook in `hooks/` for data fetching

### Working with jobs
- Use `useJobs()` hook for fetching with filters
- Use `useCreateJob()` hook for creation
- Use `useUpdateJobStatus()` for status changes
- All mutations should log to `job_activity`

---

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=<project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Commands
```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run in browser
npm run lint       # ESLint
```
