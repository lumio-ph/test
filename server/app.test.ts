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

function lastCodeFor(email: string) {
  const row = db
    .prepare('select subject from outbox where to_addr = ? order by id desc limit 1')
    .get(email) as { subject: string } | undefined;
  return row?.subject.match(/^(\d{6})/)?.[1];
}

async function signIn(email: string) {
  expect((await post('/api/auth/request-code', { email })).status).toBe(200);
  const code = lastCodeFor(email);
  expect(code).toMatch(/^\d{6}$/);
  const res = await post('/api/auth/verify', { email, code });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  return { cookie, home: ((await res.json()) as { home: string }).home };
}

describe('signing in', () => {
  it('blocks reports without a session', async () => {
    expect((await get(`/api/reports/${EXAMPLE}`)).status).toBe(401);
  });

  it('sends a code only to authorised emails, but answers identically', async () => {
    const before = (db.prepare('select count(*) as c from outbox').get() as { c: number }).c;
    const res = await post('/api/auth/request-code', { email: 'stranger@nowhere.test' });
    expect(res.status).toBe(200);
    const after = (db.prepare('select count(*) as c from outbox').get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it('takes a firm leader straight to their own report', async () => {
    const { home } = await signIn(EXAMPLE_LEADER);
    expect(home).toBe(`/r/${EXAMPLE}`);
  });

  it('rejects a wrong code and locks after too many attempts', async () => {
    await post('/api/auth/request-code', { email: HORIZON_LEADER });
    const real = lastCodeFor(HORIZON_LEADER)!;
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/verify', { email: HORIZON_LEADER, code: wrong })).status).toBe(400);
    // Locked: even the right code fails now; a new code must be requested.
    expect((await post('/api/auth/verify', { email: HORIZON_LEADER, code: real })).status).toBe(400);
  });

  it('a code works once only', async () => {
    await post('/api/auth/request-code', { email: HORIZON_LEADER });
    const code = lastCodeFor(HORIZON_LEADER)!;
    expect((await post('/api/auth/verify', { email: HORIZON_LEADER, code })).status).toBe(200);
    expect((await post('/api/auth/verify', { email: HORIZON_LEADER, code })).status).toBe(400);
  });

  it('refuses POSTs without the anti-forgery header', async () => {
    const res = await fetch(base + '/api/auth/request-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EXAMPLE_LEADER }),
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

  it("cannot open another firm's report or fellows by changing the URL", async () => {
    expect((await get(`/api/reports/${HORIZON}`, example)).status).toBe(404);
    expect((await get(`/api/reports/${HORIZON}/${AMARA}`, example)).status).toBe(404);
    // Own firm token + another firm's fellow token
    expect((await get(`/api/reports/${EXAMPLE}/${AMARA}`, example)).status).toBe(404);
    // Firm that receives no report
    expect((await get(`/api/reports/${OTHER_COHORT_FIRM}`, example)).status).toBe(404);
    // And the other way round
    expect((await get(`/api/reports/${EXAMPLE}`, horizon)).status).toBe(404);
    expect((await get(`/api/reports/${EXAMPLE}/${ALEXANDRA}`, horizon)).status).toBe(404);
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
    const { cookie } = await signIn('coo@example-capital.demo'); // invited → active on first sign-in
    expect((await get(`/api/reports/${EXAMPLE}`, cookie)).status).toBe(200);
    db.prepare("update users set access_status = 'revoked' where email = 'coo@example-capital.demo'").run();
    expect((await get(`/api/reports/${EXAMPLE}`, cookie)).status).toBe(401);
  });

  it('sign-out ends the session', async () => {
    const { cookie } = await signIn(EXAMPLE_LEADER);
    await post('/api/auth/sign-out', {}, cookie);
    expect((await get(`/api/reports/${EXAMPLE}`, cookie)).status).toBe(401);
  });
});

describe('admin', () => {
  let admin = '';
  beforeAll(async () => {
    admin = (await signIn(ADMIN)).cookie;
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
    expect((await get('/api/admin/dataset', admin)).status).toBe(200);
  });
});
