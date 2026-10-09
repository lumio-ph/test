/**
 * SQLite storage (Node's built-in node:sqlite — no native build step).
 * Report tables mirror src/data/types.ts; auth tables hold sign-in codes,
 * sessions, the email outbox and an audit log.
 */
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

// Loaded at runtime: bundlers and Vite don't yet resolve the new node:sqlite built-in.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = DatabaseSyncType;
import type {
  AuthorisedUser,
  CapstoneRecord,
  Checkpoint,
  Cohort,
  Dataset,
  Fellow,
  Firm,
  Session,
  SessionRecord,
} from '../src/data/types';

export type DB = DatabaseSync;

const SCHEMA = `
create table if not exists meta (key text primary key, value text);
create table if not exists cohorts (
  id text primary key, name text not null, programme_name text not null,
  start_date text, end_date text);
create table if not exists firms (
  id text primary key, report_token text unique not null, name text not null,
  logo_url text, cohort_id text not null, report_enabled integer not null default 1,
  is_sample integer not null default 0);
create table if not exists fellows (
  id text primary key, report_token text unique not null, firm_id text not null,
  cohort_id text not null, first_name text not null, last_name text not null,
  role text, is_sample integer not null default 0);
create table if not exists sessions (
  id text primary key, cohort_id text not null, number integer not null,
  title text not null, date text not null, facilitator text, status text not null);
create table if not exists session_records (
  fellow_id text not null, session_id text not null, attended integer not null,
  feedback_submitted integer not null, what_i_learned text, what_ill_apply text,
  feedback_submitted_at text, primary key (fellow_id, session_id));
create table if not exists capstones (
  seq integer primary key autoincrement, fellow_id text not null, recorded_at text not null,
  submitted integer not null, submission_date text, submission_deadline text not null,
  submitted_on_time integer, assessment_status text not null, assessment_score real,
  assessment_max_score real, detailed_feedback text);
create table if not exists checkpoints (
  id text primary key, cohort_id text not null, title text not null,
  reporting_date text not null, session_ids text not null, status text not null);
create table if not exists users (
  id text primary key, email text unique not null collate nocase, name text,
  firm_id text, role text not null, access_status text not null);

create table if not exists login_codes (
  email text primary key collate nocase, code_hash text not null,
  expires_at integer not null, attempts integer not null default 0);
create table if not exists auth_sessions (
  token_hash text primary key, user_id text not null,
  created_at integer not null, expires_at integer not null);
create table if not exists rate_events (key text not null, at integer not null);
create index if not exists rate_events_key on rate_events(key, at);
create table if not exists outbox (
  id integer primary key autoincrement, created_at integer not null, to_addr text not null,
  subject text not null, text_body text, html_body text, status text not null, error text);
create table if not exists audit (
  id integer primary key autoincrement, at integer not null, user_id text, email text,
  action text not null, detail text);
`;

export function openDb(path: string): DB {
  const db = new DatabaseSync(path);
  db.exec('pragma journal_mode = wal; pragma busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('begin immediate');
  try {
    const out = fn();
    db.exec('commit');
    return out;
  } catch (e) {
    db.exec('rollback');
    throw e;
  }
}

type Row = Record<string, unknown>;
const all = (db: DB, sql: string, ...p: Array<string | number | null>) =>
  db.prepare(sql).all(...p) as Row[];
const s = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const b = (v: unknown) => v === 1 || v === true;
const n = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
const nb = (v: unknown) => (v === null || v === undefined ? undefined : b(v));

/* ---------------- read ---------------- */

export function loadDataset(db: DB): Dataset {
  const meta = Object.fromEntries(all(db, 'select key, value from meta').map((r) => [r.key, r.value]));
  return {
    label: String(meta.label ?? 'Live data'),
    isSample: meta.is_sample === '1',
    cohorts: all(db, 'select * from cohorts').map(
      (r): Cohort => ({
        id: String(r.id),
        name: String(r.name),
        programmeName: String(r.programme_name),
        startDate: String(r.start_date ?? ''),
        endDate: String(r.end_date ?? ''),
      }),
    ),
    firms: all(db, 'select * from firms order by rowid').map(
      (r): Firm => ({
        id: String(r.id),
        reportToken: String(r.report_token),
        name: String(r.name),
        logoUrl: s(r.logo_url),
        cohortId: String(r.cohort_id),
        reportEnabled: b(r.report_enabled),
        isSample: b(r.is_sample),
      }),
    ),
    fellows: all(db, 'select * from fellows order by rowid').map(
      (r): Fellow => ({
        id: String(r.id),
        reportToken: String(r.report_token),
        firmId: String(r.firm_id),
        cohortId: String(r.cohort_id),
        firstName: String(r.first_name),
        lastName: String(r.last_name),
        role: s(r.role),
        isSample: b(r.is_sample),
      }),
    ),
    sessions: all(db, 'select * from sessions order by number').map(
      (r): Session => ({
        id: String(r.id),
        cohortId: String(r.cohort_id),
        number: Number(r.number),
        title: String(r.title),
        date: String(r.date),
        facilitator: s(r.facilitator),
        status: String(r.status) as Session['status'],
      }),
    ),
    sessionRecords: all(db, 'select * from session_records order by rowid').map(
      (r): SessionRecord => ({
        fellowId: String(r.fellow_id),
        sessionId: String(r.session_id),
        attended: b(r.attended),
        feedbackSubmitted: b(r.feedback_submitted),
        whatILearned: s(r.what_i_learned),
        whatIllApply: s(r.what_ill_apply),
        feedbackSubmittedAt: s(r.feedback_submitted_at),
      }),
    ),
    capstones: all(db, 'select * from capstones order by seq').map(
      (r): CapstoneRecord => ({
        fellowId: String(r.fellow_id),
        recordedAt: String(r.recorded_at),
        submitted: b(r.submitted),
        submissionDate: s(r.submission_date),
        submissionDeadline: String(r.submission_deadline),
        submittedOnTime: nb(r.submitted_on_time),
        assessmentStatus: String(r.assessment_status) as CapstoneRecord['assessmentStatus'],
        assessmentScore: n(r.assessment_score),
        assessmentMaxScore: n(r.assessment_max_score),
        detailedFeedback: s(r.detailed_feedback),
      }),
    ),
    checkpoints: all(db, 'select * from checkpoints order by reporting_date').map(
      (r): Checkpoint => ({
        id: String(r.id),
        cohortId: String(r.cohort_id),
        title: String(r.title),
        reportingDate: String(r.reporting_date),
        sessionIds: JSON.parse(String(r.session_ids)),
        status: String(r.status) as Checkpoint['status'],
      }),
    ),
    users: all(db, 'select * from users order by rowid').map(
      (r): AuthorisedUser => ({
        id: String(r.id),
        email: String(r.email),
        name: s(r.name),
        firmId: r.firm_id ? String(r.firm_id) : null,
        role: String(r.role) as AuthorisedUser['role'],
        accessStatus: String(r.access_status) as AuthorisedUser['accessStatus'],
      }),
    ),
  };
}

/* ---------------- write ---------------- */

type Key = keyof Omit<Dataset, 'label' | 'isSample'>;
const v = (x: unknown) => (x === undefined ? null : typeof x === 'boolean' ? (x ? 1 : 0) : (x as string | number | null));

const writers: { [K in Key]: (db: DB, items: Dataset[K]) => void } = {
  cohorts(db, items) {
    const st = db.prepare('insert into cohorts values (?,?,?,?,?)');
    for (const c of items) st.run(c.id, c.name, c.programmeName, v(c.startDate), v(c.endDate));
  },
  firms(db, items) {
    const st = db.prepare('insert into firms values (?,?,?,?,?,?,?)');
    for (const f of items)
      st.run(f.id, f.reportToken, f.name, v(f.logoUrl), f.cohortId, f.reportEnabled === false ? 0 : 1, f.isSample ? 1 : 0);
  },
  fellows(db, items) {
    const st = db.prepare('insert into fellows values (?,?,?,?,?,?,?,?)');
    for (const f of items)
      st.run(f.id, f.reportToken, f.firmId, f.cohortId, f.firstName, f.lastName, v(f.role), f.isSample ? 1 : 0);
  },
  sessions(db, items) {
    const st = db.prepare('insert into sessions values (?,?,?,?,?,?,?)');
    for (const x of items) st.run(x.id, x.cohortId, x.number, x.title, x.date, v(x.facilitator), x.status);
  },
  sessionRecords(db, items) {
    const st = db.prepare('insert into session_records values (?,?,?,?,?,?,?)');
    for (const r of items)
      st.run(r.fellowId, r.sessionId, v(r.attended), v(r.feedbackSubmitted), v(r.whatILearned), v(r.whatIllApply), v(r.feedbackSubmittedAt));
  },
  capstones(db, items) {
    const st = db.prepare(
      'insert into capstones (fellow_id, recorded_at, submitted, submission_date, submission_deadline, submitted_on_time, assessment_status, assessment_score, assessment_max_score, detailed_feedback) values (?,?,?,?,?,?,?,?,?,?)',
    );
    for (const c of items)
      st.run(
        c.fellowId,
        c.recordedAt,
        v(c.submitted),
        v(c.submissionDate),
        c.submissionDeadline,
        v(c.submittedOnTime),
        c.assessmentStatus,
        v(c.assessmentScore),
        v(c.assessmentMaxScore),
        v(c.detailedFeedback),
      );
  },
  checkpoints(db, items) {
    const st = db.prepare('insert into checkpoints values (?,?,?,?,?,?)');
    for (const c of items) st.run(c.id, c.cohortId, c.title, c.reportingDate, JSON.stringify(c.sessionIds), c.status);
  },
  users(db, items) {
    const st = db.prepare('insert into users values (?,?,?,?,?,?)');
    for (const u of items) st.run(u.id, u.email.trim().toLowerCase(), v(u.name), v(u.firmId), u.role, u.accessStatus);
  },
};

const tableName: Record<Key, string> = {
  cohorts: 'cohorts',
  firms: 'firms',
  fellows: 'fellows',
  sessions: 'sessions',
  sessionRecords: 'session_records',
  capstones: 'capstones',
  checkpoints: 'checkpoints',
  users: 'users',
};

/** Replaces one whole table. Call inside tx(). */
export function replaceTable<K extends Key>(db: DB, key: K, items: Dataset[K]) {
  db.exec(`delete from ${tableName[key]}`);
  writers[key](db, items);
}

export function setMeta(db: DB, key: string, value: string) {
  db.prepare('insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value').run(key, value);
}

export function seedDataset(db: DB, data: Dataset) {
  tx(db, () => {
    for (const key of Object.keys(tableName) as Key[]) replaceTable(db, key, data[key] as never);
    setMeta(db, 'label', data.label);
    setMeta(db, 'is_sample', data.isSample ? '1' : '0');
  });
}

export function isEmpty(db: DB) {
  return (db.prepare('select count(*) as n from cohorts').get() as { n: number }).n === 0;
}

/** Makes sure each bootstrap admin email exists and is active. */
export function ensureAdmins(db: DB, emails: string[]) {
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    const existing = db.prepare('select id from users where email = ?').get(email) as { id: string } | undefined;
    if (existing) db.prepare("update users set role = 'admin', firm_id = null, access_status = 'active' where id = ?").run(existing.id);
    else
      db.prepare("insert into users values (?, ?, ?, null, 'admin', 'active')").run(
        `admin-${email}`,
        email,
        'Included VC admin',
      );
  }
}

export function audit(db: DB, action: string, user: { id: string; email: string } | null, detail = '') {
  db.prepare('insert into audit (at, user_id, email, action, detail) values (?,?,?,?,?)').run(
    Date.now(),
    user?.id ?? null,
    user?.email ?? null,
    action,
    detail,
  );
}
