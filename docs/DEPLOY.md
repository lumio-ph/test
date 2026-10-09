# Putting it online and testing partner access

The app is one small Node server: it stores data in a SQLite file, sends
sign-in emails, and serves the report pages. It needs a host with a
**persistent disk**, so data survives restarts.

## 1. Deploy (about 15 minutes, Render)

1. Create a Render account and connect GitHub.
2. **New → Blueprint**, choose this repository. Render reads `render.yaml`.
3. Fill in the prompted settings:
   - `ADMIN_EMAILS`: your email, plus any colleagues (comma-separated)
   - `PUBLIC_URL`: the service address Render shows, e.g. `https://included-vc-reports.onrender.com`
   - leave `SMTP_URL` empty for now (test mode)
4. Deploy. The first start loads the demonstration data.

Any host that runs Docker with a persistent volume works the same way
(Railway, Fly.io, a VM): build the `Dockerfile` and set the variables listed
in `server/index.ts`.

Later, point a subdomain such as `reports.included.vc` at the service and update
`PUBLIC_URL`.

## 2. Test mode: no email provider yet

Without `SMTP_URL`, emails are not sent. Each one is kept in the admin's
**Send & access → Email outbox**, and its subject line (including sign-in
codes) is printed in the server log (Render → Logs).

To sign in as admin the first time: open the site, enter your admin email,
and copy the code from the log.

## 3. Test the partner journey

1. **Admin → Import data**: upload an `authorised_users.csv` that adds *your
   own email* (or a colleague's) as a `firm_leader` of Example Capital.
   (Download the current file there first, add a row, upload it back.)
2. **Admin → Send & access → Email link** for Example Capital.
3. In a private browser window, open the link from that email (or from the outbox).
   You're asked for your email and a code, then you land on Example Capital's
   report, and only that report.
4. Try Horizon Ventures' link (on the Report links tab): you'll see "This report
   link isn't available". The attempt shows under **Activity** as blocked.
5. Set your `access_status` to `revoked` and re-import: you're signed out on your
   next click.

## 4. Turn on real email

Use any transactional email service (Postmark, Resend, SendGrid, Amazon SES,
or Google Workspace SMTP). Verify your sending domain with them, then set:

```
SMTP_URL=smtps://USERNAME:PASSWORD@smtp.provider.com:465
MAIL_FROM=Included VC Africa <reports@included.vc>
```

From then on, codes and report links go to partners' inboxes, and the outbox
keeps only the recipient and subject.

## 5. Go live with real data

1. Fill in the data template (`templates/included-vc-report-data-template.xlsx`).
2. Admin → Import data: upload each tab as CSV, in the order of the tabs. Each
   upload replaces the demonstration rows for that table.
3. Check **Data & checks**, preview every report, then publish the checkpoint.
4. Email each firm its link.

To start from an empty database instead, set `SEED_DEMO=0` before the first start.

## Backups

The whole database is one file (`DATABASE_PATH`). Use Render's disk
snapshots, or copy the file on a schedule.
