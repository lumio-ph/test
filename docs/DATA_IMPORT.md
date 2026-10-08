# Data import format

The reports are generated from eight tables. Keep one Google Sheet (one tab
per table) or one CSV per table. Ready-made templates filled with the
demonstration data are in [`/data-templates`](../data-templates); the admin
**Import data** tab also downloads the current data as CSV and validates
uploads.

Column names are lower-case. `*` = required. Dates are `YYYY-MM-DD`.
Yes/no columns accept `yes/no`, `y/n`, `true/false` or `1/0`.

## Tables

| File | One row per | Notes |
| --- | --- | --- |
| `cohorts.csv` | cohort | `cohort_id*`, `cohort_name*`, `programme_name*`, `start_date*`, `end_date*` |
| `firms.csv` | participating firm | `firm_id*`, `firm_name*`, `cohort_id*`, `logo_url`, `report_token`, `report_enabled` |
| `fellows.csv` | sponsored fellow | `fellow_id*`, `first_name*`, `last_name*`, `role`, `firm_id*`, `cohort_id*`, `report_token` |
| `sessions.csv` | programme session | `session_id*`, `cohort_id*`, `session_number*`, `session_title*`, `session_date*`, `status` (`held`/`scheduled`/`cancelled`), `facilitator` |
| `attendance_feedback.csv` | fellow × session held | `fellow_id*`, `session_id*`, `attended*`, `feedback_submitted*`, `what_i_learned`, `what_ill_apply`, `feedback_submitted_at` |
| `capstone.csv` | Capstone status change | `fellow_id*`, `recorded_at*`, `submitted*`, `submission_date`, `submission_deadline*`, `submitted_on_time`, `assessment_status*` (`not_started`/`pending`/`complete`), `assessment_score`, `assessment_max_score`, `detailed_feedback` |
| `checkpoints.csv` | reporting checkpoint | `checkpoint_id*`, `cohort_id*`, `checkpoint_title*`, `reporting_date*`, `session_ids*` (`s01;s02;…`), `status` (`draft`/`published`) |
| `authorised_users.csv` | report recipient | `user_id*`, `email*`, `name`, `firm_id` (blank for Included VC admins), `role*` (`firm_leader`/`admin`), `access_status` (`active`/`invited`/`revoked`) |

### Things to get right

- **Reflections are shown verbatim.** Paste the original form responses into
  `what_i_learned` / `what_ill_apply`. The importer does not trim, correct or
  rewrite them. Nothing in the system uses AI on them.
- **Report tokens are the links.** Leave `report_token` blank the first time
  and the importer generates a random one; save it back to the sheet so links
  stay stable. Never use names or sequential numbers as tokens.
- **Capstone is append-only.** When a status changes (submitted → assessed),
  add a new row with a new `recorded_at` date instead of editing the old one.
  Each report reads the latest row on or before its reporting date, so earlier
  checkpoint reports keep showing what was true when they were issued.
- **Checkpoints freeze scope.** A checkpoint lists exactly which sessions it
  covers. Once published, don't edit it; create the next checkpoint instead.
- **One attendance row per fellow per session held.** A missing row is counted
  as *not attended* and flagged on the Data & checks tab.
- `report_enabled = no` keeps a firm's fellows in the cohort averages without
  issuing that firm a report.

## How every number is calculated

All calculations are deterministic and live in
[`src/data/metrics.ts`](../src/data/metrics.ts) (covered by tests). No AI is
involved.

| Figure | Rule |
| --- | --- |
| Sessions held | Sessions on the checkpoint with status `held` and dated on or before the reporting date. Cancelled and future sessions are excluded. |
| Attendance % | sessions attended ÷ sessions held × 100 |
| Feedback opportunities | sessions attended |
| Feedback completion % | feedback submissions ÷ sessions attended × 100. Feedback on a session not attended is ignored. With 0 sessions attended the rate is shown as "—", never 0%. |
| Cohort average (attendance or feedback) | Equal-weighted mean of each cohort fellow's rate. Fellows with no rate (e.g. 0 sessions attended, for feedback) are excluded. |
| Firm combined attendance / feedback | Pooled: total attended ÷ total held across the firm's fellows (feedback: total submissions ÷ total attended). |
| "N points above/below the cohort average" | Difference between the two *displayed* (rounded) percentages, so the sentence always matches the numbers on screen. |
| Submitted on time | `submitted_on_time` if given, otherwise `submission_date ≤ submission_deadline`. |
| Capstone score and detailed feedback | Shown only when `assessment_status = complete`. Otherwise "Assessment Pending". |

Percentages are rounded to the nearest whole number (half up).

## Connecting a live source later (Phase 2)

The app reads data only through the `ReportRepository` interface in
[`src/data/repository.ts`](../src/data/repository.ts). Options, in order of
effort:

1. **CSV / Google Sheets export** → load into the database on a schedule or by
   upload from the admin (the parser and validation already exist).
2. **Google Sheets API** → a server-side job that reads the tabs and writes the
   tables. Keeps the team's existing workflow.
3. **Database first (recommended for production)** → Supabase/Postgres tables
   matching the schema in [ARCHITECTURE.md](ARCHITECTURE.md); the sheet becomes
   an import source rather than the system of record.
