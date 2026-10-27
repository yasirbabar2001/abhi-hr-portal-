# ABHI People: talent acquisition, onboarding and HR portal

A single portal for **ABHI Microfinance Bank** that covers the whole hiring journey, from approved headcount to a new colleague's employee ID:

```
Headcount budget → Requisition (approvals) → Job description → Job posting → Careers site
   → Application → CV screening → Shortlisting → Interviews (calendar, in-person / live video / recorded video, scorecards)
   → References & eCIB → Offer (approvals, e-acceptance) → Appointment letter
   → Orientation (PDF, video, gamified presentation, quiz, SCORM) → Employee ID auto-generated → Onboarding journey
   → Employee master ⇄ bank HR system API → Status changes (promotion, transfer, confirmation, exit…)
```

Every change is written to an **audit trail**.

## Who uses it

| User | Signs in at | Can do |
|---|---|---|
| **External candidate** | `/careers`, `/register` | Browse and apply for jobs, track status, confirm and join interviews, record video answers, give eCIB consent, accept offers with e-signature, acknowledge the appointment letter, complete orientation and onboarding, give feedback |
| **HR** (internal) | `/login` → `/hr` | Everything in recruitment and onboarding, employee master, status changes, analytics, audit trail |
| **Hiring team** (internal) | `/login` → `/hr` | Raise requisitions, review their pipelines and shortlists, interview and submit scorecards, approve their steps, follow their new hires' onboarding |
| **Administrator** | `/login` → `/admin` | All of HR, plus user management and roles, master data, portal settings and the employee API integration |

## Feature map

| Area | Where |
|---|---|
| Dashboard (KPIs, funnel, sources, budget vs actual, items needing your attention) | `/hr` |
| Experience analytics (candidate NPS, CSAT, ease by touchpoint, comments, drop-off, time in stage) | `/hr/analytics` |
| Headcount budgeting (approved vs filled vs open, cost, variance, CSV) | `/hr/headcount` |
| Requisitions with a configurable approval chain | `/hr/requisitions` |
| Job description bank (versioned, approved, reusable) | `/hr/job-descriptions` |
| Job postings (channels, knock-out questions, screening criteria) | `/hr/postings` |
| Public careers site and candidate portal | `/careers`, `/me` |
| Candidate pipeline (kanban) and 360° application view | `/hr/pipeline`, `/hr/applications/[id]` |
| Talent database | `/hr/candidates` |
| CV screening (explainable match score, knock-outs, blind screening) | `/hr/screening` |
| Shortlisting with hiring-manager review and side-by-side comparison | `/hr/shortlisting` |
| Interviews: calendar, scheduling, in-person, live video (Jitsi / Teams / Zoom), recorded one-way video, scorecards, .ics invites | `/hr/interviews`, `/me/interviews/[id]` |
| References (online referee form) and eCIB verification with candidate consent | `/hr/verification`, `/reference/[token]` |
| Offers: approvals, e-acceptance, decline, counter-offer | `/hr/offers`, `/me/offers/[id]` |
| Appointment letters (printable, acknowledged online) | `/hr/letters` |
| Orientation: PDF, video, gamified presentation, quiz, SCORM 1.2 | `/hr/orientation`, `/me/orientation` |
| Employee ID auto-generation when orientation is complete | configurable pattern in `/admin/settings` |
| Onboarding journey (before joining → day one → first 90 days) | `/hr/onboarding`, `/me/onboarding` |
| Employee master | `/hr/employees` |
| Bank employee data API (inbound sync and outbound API) | `/admin/integrations`, `/api/v1/*` |
| Status changes with approvals | `/hr/status-changes` |
| User management and roles | `/admin/users` |
| Master data (departments, branches, grades, designations, sources, reasons, competencies…) | `/admin/master-data` |
| Portal settings | `/admin/settings` |
| Audit trail | `/hr/audit` |

## Run it

Requirements: Node.js 20.9+ and pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3100
```

On first start the portal creates `data/db.json` with realistic demo data. To start again from fresh demo data: stop the server, run `pnpm seed:reset`, start again.

**Demo accounts** (password `Abhi@2026` for all):

| Email | Role |
|---|---|
| admin@abhi.com.pk | Administrator |
| hr@abhi.com.pk | HR |
| manager@abhi.com.pk | Hiring manager |
| candidate@example.com | Candidate |

Set `DEMO_MODE=off` to hide the demo accounts on the sign-in page, and set `SESSION_SECRET` to a long random value in production.

Checks before committing: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Bank employee data API

**Inbound (sync from the bank's HR system).** In *Admin → Employee API*, enter the endpoint URL, the auth header (for example `Authorization: Bearer …`) and the field mapping (`ourField = source.path`, one per line). *Test connection* shows the first mapped record; *Sync now* creates and updates employees by employee number. The endpoint may return an array, or an object with `data`, `employees` or `items`, and may page with a `next` URL. A demo endpoint (`/api/mock/hris/employees`, token `Bearer demo-token`) is built in so the flow can be tried at once.

**Outbound (for other bank systems).** Send the `x-api-key` header with the key shown in *Admin → Employee API*:

```bash
curl -H "x-api-key: <key>" "https://<host>/api/v1/employees?status=confirmed&updated_since=2026-01-01"
curl -H "x-api-key: <key>" "https://<host>/api/v1/employees/ABHI-2026-1001"
curl -H "x-api-key: <key>" "https://<host>/api/v1/new-hires"
```

## Architecture

- **Next.js 16** (App Router, React Server Components, server actions), TypeScript, Tailwind CSS 4.
- **Data:** `src/lib/store.ts` is a small JSON document store (`data/db.json`, atomic writes). Pages only use `db()` and `mutate()`, so it can be swapped for PostgreSQL or SQL Server behind the same two functions when the bank moves to production. Uploaded files are in `data/uploads/`.
- **Auth:** email and password (scrypt hashes), HMAC-signed HTTP-only session cookie, lock-out after 5 failed attempts, role checks on every page and action (`src/lib/auth.ts`, `src/lib/nav.ts`).
- **Audit:** `audit()` is written in the same transaction as each change, with before/after values (secrets masked).
- **Domain model:** `src/lib/types.ts`.

## Before going live (recommended)

1. Move the store to the bank's database (PostgreSQL / SQL Server) and file storage to object storage with encryption at rest.
2. Connect single sign-on (Azure AD / Entra ID) for internal users.
3. Connect email and SMS (notifications are in-app today).
4. Replace the demo eCIB step with the bank's eCIB process: the portal records consent, submission and the result, and does not call SBP systems itself.
5. Set `SESSION_SECRET`, `DEMO_MODE=off`, HTTPS, backups and a retention job for candidate data.
