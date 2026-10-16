# Putting it online and testing partner access

The app is one small Node server: it stores data in a SQLite file, sends
invitation emails (optional), and serves the report pages. It needs a host with a
**persistent disk**, so data survives restarts.

## 1. Deploy (about 15 minutes, Render)

1. Create a Render account and connect GitHub.
2. **New → Blueprint**, choose this repository. Render reads `render.yaml`.
3. Fill in the prompted settings:
   - `ADMIN_PASSWORD`: a long password for the admin account (`ops@included.vc` is preset in `ADMIN_EMAILS`)
   - `PUBLIC_URL`: the service address Render shows, e.g. `https://included-vc-reports.onrender.com`
   - leave `SMTP_URL` empty (optional; see section 3)
4. Deploy. The first start loads the demonstration data.

Any host that runs Docker with a persistent volume works the same way
(Railway, Fly.io, a VM): build the `Dockerfile` and set the variables listed
in `server/index.ts`.

Later, point a subdomain such as `reports.included.vc` at the service and update
`PUBLIC_URL`.

## 2. Sign in and test

Day-to-day use is described step by step in [HOW_TO_USE.md](HOW_TO_USE.md).

- **Admin:** `/admin`, sign in with an `ADMIN_EMAILS` address (default
  `ops@included.vc`) and `ADMIN_PASSWORD`.
- **Partners:** open their firm's link (Admin → Report links). No sign-in.

## 3. Email (optional)

Partners don't need email to sign in. Connecting an email service only makes
the admin's **Email link** button send invitations for you. Without it, copy
the link from **Report links** and send it yourself. To connect one (Postmark,
Resend, SendGrid, Amazon SES, Google Workspace SMTP), set:

```
SMTP_URL=smtps://USERNAME:PASSWORD@smtp.provider.com:465
MAIL_FROM=Included VC Africa <reports@included.vc>
```

## 4. Go live with real data

1. Fill in the data template (`templates/included-vc-report-data-template.xlsx`).
2. Admin → Import data → **Choose workbook**: the whole file is checked, then
   saved in one go, replacing the demonstration data.
3. Check **Data & checks**, preview every report, then publish the checkpoint.
4. Email each firm its link.

To start from an empty database instead, set `SEED_DEMO=0` before the first start.

## Backups

The whole database is one file (`DATABASE_PATH`). Use Render's disk
snapshots, or copy the file on a schedule.
