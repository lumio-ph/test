# Included VC Africa — Investment Cohort progress reports

A private, personalised progress report for the leadership of each investment
firm that sponsors fellows on the Investment Cohort, with an individual report
for every fellow. One report design, driven entirely by data.

Partners open their firm's private link, sign in with a one-time code sent
to their email, and see only their own firm's report. The Included VC team
manages data, checkpoints, recipients and invitations in the admin.

> The repository ships with **demonstration data** (Example Capital, Horizon
> Ventures). See [docs/DEPLOY.md](docs/DEPLOY.md) to put it online, test the
> partner journey and load real data.

## What's here

| | |
| --- | --- |
| Company report | Introduction, sponsored fellows at a glance, their own words on what they'll apply, comparison with the cohort, closing |
| Individual report | 01 Participation & attendance · 02 Feedback & engagement · 03 Learning journey · 04 Capstone Lab · closing |
| Checkpoints | Switch between reporting checkpoints; earlier reports stay as issued |
| Sign-in | Email + 6-digit one-time code; firm-level access enforced on the server |
| Admin (`/admin`) | Preview reports at any width, publish checkpoints, email each firm its link, outbox, activity log, data checks, CSV import, recipients |

Sample reports: **Example Capital** (Alexandra Smith, Daniel Mensah) and
**Horizon Ventures** (Amara Okafor), plus 17 anonymous demo fellows who only
feed the cohort averages.

## Run it

```bash
npm install
npm run build && ADMIN_EMAILS=you@included.vc npm start   # http://localhost:8787
npm test              # calculations, import, and access-control tests

# development
npm run dev:server    # API on :8787 (sign-in codes print in this terminal)
npm run dev           # app on :5173, proxied to the API
npm run dev:demo      # self-contained demo, no server

npm run build:single  # self-contained demo in one HTML file (dist-single/)
npm run templates     # regenerate data-templates/*.csv
```

Requires Node 22.5 or newer.

## Data template

`templates/included-vc-report-data-template.xlsx` is the spreadsheet to fill in: one tab per table, dropdowns, notes on every column, example rows, and a `check_figures` tab. Export each tab as CSV and upload it in the admin's Import tab.

## Docs

- [docs/DATA_IMPORT.md](docs/DATA_IMPORT.md) — import format, and exactly how every number is calculated
- [docs/DEPLOY.md](docs/DEPLOY.md) — deploy, test partner access, connect email, go live
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — code structure, routes, and the access-control rules

## Design

The visual language follows the Africa Investor Fellowship sponsor report:
Archivo (display), Manrope (body) and IBM Plex Mono (labels); black, white
and off-white with Included VC Kelly green, lime and gold; the brand gradient
rule; highlighter headlines; and large tabular figures. Tokens live in
`src/styles/tokens.css`.
