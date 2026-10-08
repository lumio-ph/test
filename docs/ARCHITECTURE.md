# Architecture

## Layers

```
data source ─▶ ReportRepository ─▶ metrics (pure functions) ─▶ view-models ─▶ report components
 (sample /       src/data/            src/data/metrics.ts        FirmReportModel     src/report/*
  CSV / DB)      repository.ts                                   FellowReportModel
```

- **`src/data/types.ts`** — one interface per table (Firms, Fellows, Sessions,
  SessionRecords, Capstone, Checkpoints, AuthorisedUsers, Cohorts).
- **`src/data/metrics.ts`** — every derived number, as pure functions with
  tests. The only place calculations happen.
- **`src/data/repository.ts`** — the data access layer. Resolves a report by
  opaque token, applies firm scoping, picks the checkpoint and returns a
  ready-to-render view-model. `InMemoryRepository` serves the demo data; a
  `SupabaseRepository` with the same interface replaces it in Phase 2.
- **`src/data/sample/`** — demonstration data only. Not imported by any
  component.
- **`src/report/`** — the single report design. Reusable components:
  `ReportHeader`, `CompanyIntro`, `FellowOverview`, `ComparisonBar`
  (cohort comparison), `SessionStrip`, `AttendanceSection`, `FeedbackSection`,
  `LearningJourney`, `CapstoneLab`, `ReportClosing`, `ReportFooter`. They
  receive view-models and never touch raw tables.
- **`src/admin/`** — internal admin (preview, links, data checks, import,
  recipients). Separate route and styling from the leadership report.

Report layouts respond to the width of the report container (CSS container
queries), so the admin preview can show genuine mobile/tablet/desktop layouts.

## Routes (prototype)

| Route | Shows |
| --- | --- |
| `#/r/{firmToken}` | Company report (latest published checkpoint) |
| `#/r/{firmToken}/{fellowToken}` | Individual fellow report |
| `…?cp={checkpointId}` | A specific (historical) checkpoint |
| `#/admin` | Internal admin |
| `#/` | Prototype index (review only — not part of production) |

A fellow token only resolves under that fellow's own firm token; any other
combination returns the same "link isn't available" page as an invalid link.

## Security status — be explicit

**The prototype is not secure and must not hold real data.** All demo data is
bundled into the page, there is no sign-in, and the admin is open. Opaque tokens
stop casual URL editing, nothing more.

## Phase 3 plan: authentication, permissions, row-level security

Recommended stack: **Supabase** (Postgres + Auth + Row Level Security) with
this front end deployed on Vercel/Netlify, or an equivalent.

1. **Sign-in** — passwordless email (magic link / one-time code) for
   recipients listed in `authorised_users`. No passwords to manage.
2. **Server-side data only** — report data is fetched per request for the
   signed-in user; nothing for other firms is ever sent to the browser.
3. **Row-level security** — every table carries `firm_id` (directly or via
   `fellow_id`), and policies restrict reads to the caller's firm. The cohort
   averages are exposed through a view/function that returns only aggregates.
4. **Links** — keep the opaque token URLs for convenience, but require sign-in
   *and* firm membership; a token alone never grants access.
5. **Admin** — separate role (`admin`), required for the admin routes and for
   writes.
6. **Audit** — log report views and data imports.

Draft schema and policies (to be finalised in Phase 2/3 — not yet applied):

```sql
create table firms (
  id text primary key,
  cohort_id text not null references cohorts(id),
  name text not null,
  logo_url text,
  report_token text unique not null,
  report_enabled boolean not null default true
);

create table fellows (
  id text primary key,
  firm_id text not null references firms(id),
  cohort_id text not null references cohorts(id),
  first_name text not null,
  last_name text not null,
  role text,
  report_token text unique not null
);

create table session_records (
  fellow_id text not null references fellows(id),
  session_id text not null references sessions(id),
  attended boolean not null,
  feedback_submitted boolean not null,
  what_i_learned text,       -- stored verbatim
  what_ill_apply text,       -- stored verbatim
  feedback_submitted_at date,
  primary key (fellow_id, session_id)
);

create table authorised_users (
  id uuid primary key references auth.users(id),
  email text unique not null,
  firm_id text references firms(id),           -- null for admins
  role text not null check (role in ('firm_leader','admin')),
  access_status text not null default 'invited'
);

-- helper: the caller's firm, only while their access is active
create function my_firm() returns text language sql stable security definer as $$
  select firm_id from authorised_users
  where id = auth.uid() and access_status = 'active'
$$;

alter table fellows enable row level security;
create policy "leaders read own firm's fellows" on fellows
  for select using (firm_id = my_firm());

alter table session_records enable row level security;
create policy "leaders read own firm's records" on session_records
  for select using (
    exists (select 1 from fellows f where f.id = fellow_id and f.firm_id = my_firm())
  );
-- same pattern for capstone_records; admins get a separate policy via role.
-- Cohort averages come from a security-definer function returning aggregates only.
```

These policies must be tested with real accounts from two different firms
(including attempts to read the other firm's rows by ID) before any real data
is loaded.
