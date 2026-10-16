# How to use the progress reports

For the Included VC team. Admin account: **ops@included.vc**.

---

## A. One-time setup in Render (5 minutes)

1. Open **dashboard.render.com** → your service **included-vc-reports** → **Environment**.
2. Make sure these are set, then click **Save, rebuild and deploy**:

   | Key | Value |
   | --- | --- |
   | `ADMIN_EMAILS` | `ops@included.vc` |
   | `ADMIN_PASSWORD` | a long password only the team knows (12+ characters) |
   | `PUBLIC_URL` | your site address, e.g. `https://included-vc-reports.onrender.com` |

3. Wait until the status at the top says **Live**.

> **Plan:** on Render's free plan, everything you upload is wiped whenever the
> app restarts or sleeps. Before loading real data, switch the service to
> **Starter** (≈ US$7/month) under **Settings → Instance type**, so the disk keeps
> your data.

---

## B. Sign in as admin

1. Go to your site address followed by **`/admin`**.
2. Enter **ops@included.vc** and the `ADMIN_PASSWORD`.
3. You land in the admin. While the site still holds the demonstration data (Example Capital,
   Horizon Ventures), a yellow banner says so and you start on **Import data**. Your own
   firms only appear after step D.

---

## C. Prepare the data workbook

Open **included-vc-report-data.xlsx** (already filled from the feedback export).
Start with the **Start here** tab. Fill in the **yellow cells** (hover over one to see why it's yellow):

1. **attendance_feedback → `attended`**: 113 cells, one for each fellow who didn't send feedback
   for a session. Enter `yes` or `no` from the attendance register. A blank counts as *not attended*.
2. **sessions**: real titles for sessions 5–8 (currently "Masterclass with Aditi" etc.) and check the dates.
3. **authorised_users** (optional, only for the **Email link** button): one row per person at each firm:
   - `user_id`: any unique label, e.g. `u-madica-1`
   - `email`: the person's email
   - `firm_id`: pick from the dropdown (it matches the **firms** tab)
   - `role`: `firm_leader`
   - `access_status`: `active`

   Keep the `ops@included.vc` admin row.
4. **capstone**: add rows when Capstone results exist. Leave it empty until then.

Leave every `report_token` column blank. The system creates the private links and keeps them the same on every upload.

---

## D. Upload it

1. Admin → **Import data** → **Choose workbook (.xlsx)**.
2. The system checks every tab first. "To review" items are explained; nothing has changed yet.
3. Click **Save to database**. All reports now use this data.

Need to change something later? Edit the same workbook and upload it again. Links and logos stay the same.

---

## D2. Logos

Admin → **Firms & logos** lists every firm with its logo. The 33 logos from the
sponsor report are already linked. To add or change one, click **Upload logo** or
**Replace logo** and pick a PNG, JPG, SVG or WebP file. A wide logo on a white or transparent
background works best. **Remove** shows the firm's name instead. Rising Tide Africa
has no logo yet.

---

## E. Check before sharing

1. **Data & checks**: fix anything marked *error*; read the *warnings*.
2. **Preview reports**: open each firm's company report and a few fellows, on Desktop and Mobile.

---

## F. Publish

**Send & access → 1 · Publish a checkpoint**: click **Publish** on the checkpoint you want firms to see.
Firms only ever see published checkpoints.

---

## G. Send each firm its link

1. **Report links** tab → **Copy** the firm's *Firm link*. Each fellow has their own report: if the firm
   sponsors one fellow, the link opens that fellow's report; if it sponsors several, it opens a short
   page where leadership picks a fellow. (Each fellow's own link is listed there too.)
   To get every fellow's link at once, press **Download spreadsheet of fellow links** at the top of
   **Report links**: one row per fellow with the link, company and fellow's name (opens in Excel).
2. Email it to that firm's recipients yourself, for example:

   > Dear [name],
   >
   > Your private progress report for the Africa Investor Fellowship is ready:
   > [link]
   >
   > No sign-in is needed. The report is for [firm]'s leadership only, so
   > please don't forward the link.

(If an email service is connected — `SMTP_URL` in Render — the **Email link** button on
Send & access sends this for you.)

---

## H. What partners do

1. Open the link. No sign-in, email or password.
2. They see their fellow's report (or choose between their fellows). A mistyped link shows
   "This report link isn't available".

The link is the only key: anyone who has it can open that firm's reports, so send it only to
the firm's leadership and ask them not to forward it. Only the admin needs to sign in.

---

## I. Everyday tasks

| To… | Do this |
| --- | --- |
| Add a recipient | Add a row to **authorised_users**, upload the workbook |
| Remove someone's access | Set their `access_status` to `revoked`, upload. They're signed out immediately |
| Add new sessions' feedback | Add rows to **attendance_feedback** (and set the session's `status` to `held`), upload |
| Issue the next report | Add a row to **checkpoints** listing the sessions it covers (`s01;s02;…`), upload, then **Publish** it |
| Record a Capstone result | Add a **new** row to **capstone** (don't overwrite the old one), upload |
| See who opened what | **Send & access → Activity** |
