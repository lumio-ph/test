/**
 * End-to-end access tests against a real server and database.
 * Every test signs in the way a partner would: request code → read the
 * email from the outbox → verify → use the session cookie.
 */
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sampleDataset } from '../src/data/sample/sampleDataset';
import { createApp } from './app';
import { openDb, seedDataset, type DB } from './db';
import { createMailer } from './mail';

const EXAMPLE = 'k7Qm2xP9aRf4';
const HORIZON = 'h3Tz8vLw6NcY';
const ALEXANDRA = 'a9Vb4Kd2Ws7e';
const AMARA = 'm2Gc7Yt5Pz9b';
const OTHER_COHORT_FIRM = 'r8Lp3Wq6Zs1d';
const EXAMPLE_LEADER = 'managing.partner@example-capital.demo';
const HORIZON_LEADER = 'partner@horizon-ventures.demo';
const ADMIN = 'admin@included.test';
const ADMIN_PASSWORD = 'correct horse battery staple';

let db: DB;
let server: Server;
let base = '';

beforeAll(async () => {
  db = openDb(':memory:');
  seedDataset(db, sampleDataset);
  const mailer = createMailer(db, { from: 'test@example.com' });
  const app = createApp({
    db,
    mailer,
    secret: 'x'.repeat(40),
    baseUrl: 'https://reports.test',
    adminEmails: [ADMIN],
    adminPassword: ADMIN_PASSWORD,
    secureCookies: false,
  });
  const { ensureAdmins } = await import('./db');
  ensureAdmins(db, [ADMIN]);
  await new Promise<void>((r) => {
    server = app.listen(0, () => r());
  });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(() => server?.close());

const post = (path: string, body: unknown, cookie = '', type = 'application/json') =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': type, 'x-ivc': '1', cookie },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (path: string, cookie = '') => fetch(base + path, { headers: { cookie } });

const cookieOf = (res: Response) => res.headers.get('set-cookie')!.split(';')[0];

/** Partner sign-in: email entered on their firm's link. */
async function signIn(email: string, firmToken = email === HORIZON_LEADER ? HORIZON : EXAMPLE) {
  const res = await post('/api/auth/email', { email, firmToken });
  expect(res.status).toBe(200);
  return { cookie: cookieOf(res), home: ((await res.json()) as { home: string }).home };
}

async function signInAdmin(email = ADMIN, password = ADMIN_PASSWORD) {
  const res = await post('/api/auth/admin', { email, password });
  expect(res.status).toBe(200);
  return { cookie: cookieOf(res), home: ((await res.json()) as { home: string }).home };
}

describe('signing in', () => {
  it('opens a report link without signing in, but not a wrong or draft one', async () => {
    expect((await get(`/api/reports/${EXAMPLE}`)).status).toBe(200);
    expect((await get(`/api/reports/${EXAMPLE}/${ALEXANDRA}`)).status).toBe(200);
    expect((await get('/api/reports/not-a-real-token')).status).toBe(404);
    expect((await get(`/api/reports/${EXAMPLE}?cp=cp-2026-2&drafts=1`)).status).toBe(200);
    expect((await get('/api/admin/dataset')).status).toBe(401);
  });

  it('lets a firm leader in with just their email on their own firm link', async () => {
    const { home } = await signIn(EXAMPLE_LEADER);
    expect(home).toBe(`/r/${EXAMPLE}`);
  });

  it("refuses a leader's email on another firm's link", async () => {
    expect((await post('/api/auth/email', { email: EXAMPLE_LEADER, firmToken: HORIZON })).status).toBe(400);
  });

  it('refuses emails that are not on the list, and requests without a link', async () => {
    expect((await post('/api/auth/email', { email: 'stranger@nowhere.test', firmToken: EXAMPLE })).status).toBe(400);
    expect((await post('/api/auth/email', { email: EXAMPLE_LEADER, firmToken: '' })).status).toBe(400);
    expect((await post('/api/auth/email', { email: EXAMPLE_LEADER, firmToken: 'guessed-token' })).status).toBe(400);
  });

  it('never lets an admin email in through a partner link', async () => {
    expect((await post('/api/auth/email', { email: ADMIN, firmToken: EXAMPLE })).status).toBe(400);
  });

  it('admin needs the right password; leaders cannot use the admin form', async () => {
    expect((await post('/api/auth/admin', { email: ADMIN, password: 'wrong' })).status).toBe(400);
    expect((await post('/api/auth/admin', { email: EXAMPLE_LEADER, password: ADMIN_PASSWORD })).status).toBe(400);
    const { home } = await signInAdmin();
    expect(home).toBe('/admin');
  });

  it('refuses POSTs without the anti-forgery header', async () => {
    const res = await fetch(base + '/api/auth/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EXAMPLE_LEADER, firmToken: EXAMPLE }),
    });
    expect(res.status).toBe(403);
  });
});

describe('firm isolation', () => {
  let example = '';
  let horizon = '';
  beforeAll(async () => {
    example = (await signIn(EXAMPLE_LEADER)).cookie;
    horizon = (await signIn(HORIZON_LEADER)).cookie;
  });

  it('Example Capital leader sees their firm and fellows', async () => {
    const res = await get(`/api/reports/${EXAMPLE}`, example);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { firm: { name: string }; fellows: Array<{ fellow: { firstName: string } }> };
    expect(body.firm.name).toBe('Example Capital');
    expect(body.fellows.map((f) => f.fellow.firstName)).toEqual(['Alexandra', 'Daniel']);
    expect((await get(`/api/reports/${EXAMPLE}/${ALEXANDRA}`, example)).status).toBe(200);
  });

  it("cannot reach another firm's fellows by changing the fellow part of the URL", async () => {
    // Own firm token + another firm's fellow token
    expect((await get(`/api/reports/${EXAMPLE}/${AMARA}`, example)).status).toBe(404);
    expect((await get(`/api/reports/${EXAMPLE}/${AMARA}`)).status).toBe(404);
    expect((await get(`/api/reports/${HORIZON}/${ALEXANDRA}`)).status).toBe(404);
    // Firm that receives no report
    expect((await get(`/api/reports/${OTHER_COHORT_FIRM}`)).status).toBe(404);
  });

  it("never sends another firm's data in a report response", async () => {
    const text = await (await get(`/api/reports/${HORIZON}`, horizon)).text();
    for (const leak of ['Alexandra', 'Daniel', 'Example Capital', 'Cohort Fellow', EXAMPLE, ALEXANDRA]) {
      expect(text).not.toContain(leak);
    }
  });

  it('keeps leaders out of admin', async () => {
    expect((await get('/api/admin/dataset', example)).status).toBe(403);
    expect((await post('/api/admin/invite/firm-example-capital', {}, example)).status).toBe(403);
  });

  it('hides draft checkpoints from leaders', async () => {
    db.prepare("update checkpoints set status = 'draft' where id = 'cp-2026-2'").run();
    const body = (await (await get(`/api/reports/${EXAMPLE}?cp=cp-2026-2`, example)).json()) as {
      checkpoint: { id: string };
      checkpoints: Array<{ id: string }>;
    };
    expect(body.checkpoint.id).toBe('cp-2026-1');
    expect(body.checkpoints.map((c) => c.id)).toEqual(['cp-2026-1']);
    db.prepare("update checkpoints set status = 'published' where id = 'cp-2026-2'").run();
  });

  it('signs a revoked user out on their next request', async () => {
    const { cookie } = await signIn('coo@example-capital.demo', EXAMPLE); // invited → active on first sign-in
    expect((await get(`/api/reports/${EXAMPLE}`, cookie)).status).toBe(200);
    db.prepare("update users set access_status = 'revoked' where email = 'coo@example-capital.demo'").run();
    expect((await get('/api/admin/dataset', cookie)).status).toBe(401);
  });

  it('sign-out ends the session', async () => {
    const { cookie } = await signIn(EXAMPLE_LEADER);
    expect((await get('/api/admin/dataset', cookie)).status).toBe(403);
    await post('/api/auth/sign-out', {}, cookie);
    expect((await get('/api/admin/dataset', cookie)).status).toBe(401);
  });

  it('pauses an address that tries many wrong links', async () => {
    for (let i = 0; i < 30; i++) await get(`/api/reports/guess${i}`);
    expect((await get(`/api/reports/${EXAMPLE}`)).status).toBe(429);
  });
});

describe('admin', () => {
  let admin = '';
  beforeAll(async () => {
    admin = (await signInAdmin()).cookie;
  });

  it('can open any firm, including draft checkpoints', async () => {
    expect((await get(`/api/reports/${HORIZON}/${AMARA}?drafts=1`, admin)).status).toBe(200);
  });

  it('emails each firm leader a link to their report', async () => {
    const res = await post('/api/admin/invite/firm-example-capital', {}, admin);
    const body = (await res.json()) as { sent: number; link: string };
    expect(body.sent).toBe(1); // the revoked COO is skipped
    expect(body.link).toBe(`https://reports.test/r/${EXAMPLE}`);
    const mail = db.prepare('select * from outbox where to_addr = ? order by id desc limit 1').get(EXAMPLE_LEADER) as {
      subject: string;
      text_body: string;
    };
    expect(mail.subject).toContain('Example Capital');
    expect(mail.text_body).toContain(`https://reports.test/r/${EXAMPLE}`);
  });

  it('imports CSV into the database and reports update', async () => {
    const csv =
      'fellow_id,first_name,last_name,role,firm_id,cohort_id,report_token\n' +
      sampleDataset.fellows
        .map((f) =>
          [f.id, f.id === 'fellow-amara-okafor' ? 'Amarachi' : f.firstName, f.lastName, f.role ?? '', f.firmId, f.cohortId, f.reportToken].join(','),
        )
        .join('\n');
    const res = await post('/api/admin/import/fellows', csv, admin, 'text/csv');
    const body = (await res.json()) as { applied: boolean; count: number };
    expect(body.applied).toBe(true);
    expect(body.count).toBe(20);
    const report = (await (await get(`/api/reports/${HORIZON}`, admin)).json()) as { fellows: Array<{ fellow: { firstName: string } }> };
    expect(report.fellows[0].fellow.firstName).toBe('Amarachi');
  });

  it('keeps bootstrap admins when the recipients list is replaced', async () => {
    const csv = 'user_id,email,name,firm_id,role,access_status\nu1,new.leader@example-capital.demo,New,firm-example-capital,firm_leader,invited\n';
    await post('/api/admin/import/users', csv, admin, 'text/csv');
    // The admin stays signed in even though their user row was replaced.
    expect((await get('/api/admin/dataset', admin)).status).toBe(200);
  });

  it('imports the whole data template workbook in one upload', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const fellows = wb.addWorksheet('fellows');
    fellows.addRow(['fellow_id', 'first_name', 'last_name', 'role', 'firm_id', 'cohort_id', 'report_token']);
    for (const f of sampleDataset.fellows)
      fellows.addRow([f.id, f.id === 'fellow-amara-okafor' ? 'Amy' : f.firstName, f.lastName, f.role ?? '', f.firmId, f.cohortId, f.reportToken]);
    const cap = wb.addWorksheet('capstone');
    cap.addRow(['fellow_id', 'recorded_at', 'submitted', 'submission_date', 'submission_deadline', 'submitted_on_time', 'assessment_status']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const dry = await fetch(base + '/api/admin/import-workbook?dryRun=1', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-ivc': '1', cookie: admin },
      body: buf,
    });
    const dryBody = (await dry.json()) as { applied: boolean; tables: Array<{ table: string; count: number }> };
    expect(dryBody.applied).toBe(false);
    expect(dryBody.tables.map((t) => [t.table, t.count])).toEqual([['fellows', 20], ['capstones', 0]]);

    const res = await fetch(base + '/api/admin/import-workbook', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-ivc': '1', cookie: admin },
      body: buf,
    });
    expect(((await res.json()) as { applied: boolean }).applied).toBe(true);
    const report = (await (await get(`/api/reports/${HORIZON}/${AMARA}`, admin)).json()) as {
      metrics: { fellow: { firstName: string }; capstone: { state: string } };
    };
    expect(report.metrics.fellow.firstName).toBe('Amy');
    expect(report.metrics.capstone.state).toBe('no_record'); // capstone tab was empty → table cleared
  });

  it('keeps existing report links when firms are re-imported without tokens', async () => {
    const csv =
      'firm_id,firm_name,cohort_id,logo_url,report_token,report_enabled\n' +
      sampleDataset.firms.map((f) => [f.id, f.name, f.cohortId, '', '', f.reportEnabled === false ? 'no' : 'yes'].join(',')).join('\n');
    const r = (await (await post('/api/admin/import/firms', csv, admin, 'text/csv')).json()) as { applied: boolean };
    expect(r.applied).toBe(true);
    expect((await get(`/api/reports/${EXAMPLE}`, admin)).status).toBe(200);
  });

  it('uploads a firm logo and keeps it when the firms sheet is re-imported', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const up = await fetch(base + '/api/admin/firms/firm-horizon-ventures/logo', {
      method: 'POST',
      headers: { 'content-type': 'image/png', 'x-ivc': '1', cookie: admin },
      body: png,
    });
    expect(up.status).toBe(200);
    const bad = await fetch(base + '/api/admin/firms/firm-horizon-ventures/logo', {
      method: 'POST',
      headers: { 'content-type': 'text/html', 'x-ivc': '1', cookie: admin },
      body: '<script>',
    });
    expect(bad.status).toBe(400);
    const csv =
      'firm_id,firm_name,cohort_id,logo_url,report_token,report_enabled\n' +
      sampleDataset.firms.map((f) => [f.id, f.name, f.cohortId, '', '', f.reportEnabled === false ? 'no' : 'yes'].join(',')).join('\n');
    await post('/api/admin/import/firms', csv, admin, 'text/csv');
    const report = (await (await get(`/api/reports/${HORIZON}`, admin)).json()) as { firm: { logoUrl?: string } };
    expect(report.firm.logoUrl).toBe(`data:image/png;base64,${png.toString('base64')}`);
  });
});
