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

## Hosted app

```
browser ──HTTPS──▶ server/app.ts ──▶ SQLite (server/db.ts)
  sign-in page        auth: one-time email codes, sessions (server/auth.ts)
  report pages        access rules on every request
  admin               email: SMTP or test outbox (server/mail.ts)
```

The server builds each report with the same `InMemoryRepository` and
`metrics.ts` used by the prototype, from data loaded out of the database, and
returns only that one view-model.

### Routes

| Route | Shows |
| --- | --- |
| `/r/{firmToken}` | Company report (latest published checkpoint) |
| `/r/{firmToken}/{fellowToken}` | Individual fellow report |
| `…?cp={checkpointId}` | A specific (historical) checkpoint |
| `/sign-in` | Partners: email (arriving from their firm link). Admins: email + password |
| `/admin` | Internal admin (admins only) |

The self-contained demo (`npm run build:single`) uses the same routes behind
`#`, with sample data in the page and no sign-in.

## Access control (implemented and tested)

Enforced by the server on every request (`server/app.ts`), covered by
`server/app.test.ts`:

- **Sign-in (partners)**: email only, entered on the firm's private link.
  Access needs both the link token and an email on that firm's recipient list
  (`authorised_users`, role `firm_leader`). No code or password, by design
  choice: whoever holds a forwarded link and knows a listed email can open it.
  Attempts are rate-limited per IP and per link, and refusals are logged.
- **Sign-in (admins)**: an `ADMIN_EMAILS` address plus `ADMIN_PASSWORD`.
  Admin sign-in is off until the password is set.
- **Sessions**: random 256-bit token in an HttpOnly, SameSite=Lax cookie
  (Secure in production), valid 14 days, stored only as a keyed hash and tied
  to the user's email (so re-uploading recipients never signs anyone out). Revoking a user ends their sessions on the next request.
- **Firm isolation**: a firm leader gets a report only when the link's firm
  is their own firm. Another firm's link, another firm's fellow under their
  own firm link, or a firm without reports all return the same 404 as a
  mistyped link, and the attempt is logged.
- **No other firms' data on the wire**: report responses hold the firm's own
  fellows plus cohort *averages* only. The browser bundle contains no data.
- **Drafts**: only published checkpoints are visible to firms.
- **Admin**: separate role, required for every admin endpoint.
- **Hardening**: anti-forgery header on all writes, strict
  Content-Security-Policy, no framing, `Referrer-Policy: no-referrer` (links
  carry tokens), `noindex`, HSTS in production.
- **Audit log**: sign-ins, report views, blocked attempts, imports and
  invitations (Admin → Send & access → Activity).

### Not yet done

- An external security review or penetration test.
- Automatic database backups beyond the host's disk snapshots.
- SSO / Google sign-in (email codes are enough to start with).

SQLite is the right size for tens of firms and a few hundred fellows. The
data layer is behind one interface, so moving to Postgres/Supabase later
doesn't touch the report design.
