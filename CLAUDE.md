# CLAUDE.md — Trade Flow App Context

## What This App Is

**Trade Flow** is a mobile-first field service management app for trade professionals (primarily gas/plumbing engineers). It lets engineers and their companies manage jobs, customers, quotes, invoices, and Gas Safety Certificates (CP12) with team collaboration and offline support.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo + React Native (v0.81.5), React 19.1.0 |
| Routing | Expo Router v6 (file-based) |
| Backend | Supabase (PostgreSQL v17, Auth, Storage, Realtime) |
| Edge Functions | Deno (hosted on Supabase) |
| Email | Resend API (via edge function) |
| Language | TypeScript |
| State | React Context (Auth, CP12, Theme, Offline) |
| PDF | Custom PDF generation (cp12PdfGenerator, pdfGenerator) |
| Platforms | iOS, Android, Web |

---

## Project Structure

```
trade-flow-app/
├── app/
│   ├── (auth)/         # Login, register, forgot/reset password, legal
│   └── (app)/          # Protected main app routes
├── components/         # Reusable React Native components
├── constants/          # Theme and app-wide constants
├── hooks/              # Custom hooks (useJobs, useCustomers, useWorkers, useRealtime, etc.)
├── src/
│   ├── config/         # Supabase client setup
│   ├── context/        # AuthContext, CP12Context, ThemeContext, OfflineContext
│   ├── services/       # Email, PDF generation, storage, notifications
│   ├── types/          # TypeScript types (Job, Customer, Document, CP12, etc.)
│   └── utils/          # Date formatting, HTML escaping, misc utilities
├── supabase/
│   ├── migrations/     # SQL migration files
│   ├── functions/      # Deno edge functions (send-email)
│   └── config.toml     # Local Supabase dev config
└── assets/             # Images, icons, splash screens
```

---

## Key App Routes

**Auth** (`app/(auth)/`): login, register, forgot-password, reset-password, privacy-policy, terms-of-service

**Main App** (`app/(app)/`):
- `dashboard` — home screen
- `jobs/`, `jobs/[id]`, `jobs/[id]/edit`, `jobs/create`
- `customers/`, `customers/[id]`, `customers/add`
- `documents/`, `documents/[id]`
- `quote`, `invoice`
- `cp12/` — Gas Safety Certificate flow (start → appliances → final-checks → review-sign)
- `calendar`
- `settings/` — user-details, company-details, legal
- `workers/` — team list, add/invite

---

## Database (Supabase / PostgreSQL)

**Core Tables:**
- `profiles` — user accounts, linked to `companies`, role: `admin` | `worker`, Gas Safe consent tracking
- `companies` — company data
- `jobs` — work jobs, status: `pending` | `in_progress` | `complete` | `paid` | `cancelled`
- `customers` — customer contact info
- `documents` — invoices, quotes, CP12 certificates
- `job_activity` — activity/audit log per job
- `global_counters` — atomic counter for CP12 reference number sequencing

**Key RPC Functions:**
- `get_next_gas_cert_reference()` — generates sequential CP12 reference numbers (e.g. `REF-0001`)
- `delete_user_account()` — GDPR-compliant atomic account + data deletion

**RLS:** Row-Level Security enforced on all tables; company-scoped data isolation.

---

## Auth & Security

- Supabase JWT auth; tokens stored in `expo-secure-store` (never localStorage on native)
- JWT verification enforced on all edge functions
- HTML escaping applied to user-generated content (XSS prevention)
- Server-side account deletion (GDPR)
- Password strength enforcement at registration
- Email confirmation required on signup

---

## Edge Functions

**`send-email`** (`supabase/functions/send-email/`):
- Requires `Authorization: Bearer <JWT>` header
- Sends email via Resend API
- Supports PDF attachments
- Max 5 recipients per call
- Input validated and sanitised

---

## Context Providers

| Context | Purpose |
|---|---|
| `AuthContext` | Auth state, user profile, login/logout |
| `CP12Context` | Manages CP12 certificate multi-step form state |
| `ThemeContext` | Light/dark mode |
| `OfflineContext` | Offline detection |

---

## Key Services & Hooks

**Services** (`src/services/`):
- `cp12PdfGenerator.ts` — generates CP12 PDF certificates
- `pdfGenerator.ts` — general PDF utilities
- `email.ts` — sends email via edge function
- `storage.ts` — Supabase Storage operations
- `notifications.ts` — Expo push notifications
- `DocumentGenerator.ts` — creates quote/invoice document objects

**Hooks** (`hooks/`):
- `useJobs()` — fetch/filter jobs for company
- `useCustomers()` — fetch customers for company
- `useWorkers()` — fetch team members
- `useRealtime()` — Supabase real-time subscriptions
- `useColorScheme()`, `useThemeColor()` — theming

---

## User Roles

- `admin` — full access, can manage company, workers, all jobs/documents
- `worker` — can view and action jobs assigned to them; limited settings access

---

## Core Domain Types (`src/types/`)

```typescript
UserProfile, Job, Customer, Document
UserRole: 'admin' | 'worker'
JobStatus: 'pending' | 'in_progress' | 'complete' | 'paid' | 'cancelled'
DocumentType: 'quote' | 'invoice' | 'cp12'

// CP12 specific
CP12Certificate, CP12Appliance, CP12FinalChecks
CP12LandlordDetails, CP12TenantDetails
YesNoNA, PassFailNA, FlueType
```

---

## Development Notes

- **Multi-tenant:** All data is company-scoped via RLS; never query without company context
- **Offline mode:** `OfflineContext` gates network calls; design features to degrade gracefully
- **CP12 flow is stateful:** form state lives in `CP12Context` across multiple screens
- **PDF generation runs client-side** on device; large PDFs may affect performance
- **No ORM:** uses Supabase JS client with direct SQL for complex queries
- **Migrations:** always add new schema changes as migration files under `supabase/migrations/`

---

## Running Locally

```bash
npm install
npx expo start          # Start dev server (iOS/Android/Web)
npx supabase start      # Start local Supabase stack
```

Environment variables (`.env.local`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
