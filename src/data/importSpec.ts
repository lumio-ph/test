/**
 * CSV import format — one file per table. This is the contract for getting
 * real data in (exported from Google Sheets, Airtable or a database).
 * See docs/DATA_IMPORT.md for the human-readable version.
 */
import { csvObjects, toCsv } from './csv';
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
} from './types';

export interface ColumnSpec {
  name: string;
  required?: boolean;
  help: string;
}

export interface ImportIssue {
  row: number; // 1-based data row (header excluded)
  message: string;
}

export interface TableSpec<T = unknown> {
  key: keyof Omit<Dataset, 'label' | 'isSample'>;
  file: string;
  title: string;
  description: string;
  columns: ColumnSpec[];
  toRows(ds: Dataset): unknown[][];
  parse(rec: Record<string, string>, row: number, issues: ImportIssue[]): T | null;
}

/* ---------- field parsers ---------- */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRUE = new Set(['yes', 'y', 'true', '1', 'x']);
const FALSE = new Set(['no', 'n', 'false', '0', '']);

type Ctx = { rec: Record<string, string>; row: number; issues: ImportIssue[] };

const str = ({ rec }: Ctx, col: string) => (rec[col] ?? '').trim();

function req({ rec, row, issues }: Ctx, col: string): string | null {
  const v = (rec[col] ?? '').trim();
  if (!v) {
    issues.push({ row, message: `Missing required "${col}"` });
    return null;
  }
  return v;
}

function bool(c: Ctx, col: string, fallback = false): boolean {
  const v = str(c, col).toLowerCase();
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return v === '' ? fallback : false;
  c.issues.push({ row: c.row, message: `"${col}" should be yes/no, got "${c.rec[col]}"` });
  return fallback;
}

function date(c: Ctx, col: string, required = false): string | undefined {
  const v = str(c, col);
  if (!v) {
    if (required) c.issues.push({ row: c.row, message: `Missing required date "${col}"` });
    return undefined;
  }
  if (!DATE.test(v)) {
    c.issues.push({ row: c.row, message: `"${col}" must be YYYY-MM-DD, got "${v}"` });
    return undefined;
  }
  return v;
}

function num(c: Ctx, col: string): number | undefined {
  const v = str(c, col);
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    c.issues.push({ row: c.row, message: `"${col}" must be a number, got "${v}"` });
    return undefined;
  }
  return n;
}

function oneOf<T extends string>(c: Ctx, col: string, allowed: readonly T[], fallback: T): T {
  const v = str(c, col).toLowerCase() as T;
  if (!v) return fallback;
  if (allowed.includes(v)) return v;
  c.issues.push({ row: c.row, message: `"${col}" must be one of ${allowed.join(', ')}, got "${v}"` });
  return fallback;
}

/** Text the fellow wrote: kept byte-for-byte (no trimming or rewriting). */
const verbatim = ({ rec }: Ctx, col: string) => (rec[col] && rec[col].trim() !== '' ? rec[col] : undefined);

export function newToken() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const yn = (b: boolean | undefined) => (b === undefined ? '' : b ? 'yes' : 'no');

/* ---------- tables ---------- */

const cohorts: TableSpec<Cohort> = {
  key: 'cohorts',
  file: 'cohorts.csv',
  title: 'Cohorts',
  description: 'One row per programme cohort.',
  columns: [
    { name: 'cohort_id', required: true, help: 'Stable ID, e.g. cohort-2026' },
    { name: 'cohort_name', required: true, help: 'e.g. Investment Cohort 2026' },
    { name: 'programme_name', required: true, help: 'Used in report copy, e.g. Investment Cohort' },
    { name: 'start_date', required: true, help: 'YYYY-MM-DD' },
    { name: 'end_date', required: true, help: 'YYYY-MM-DD' },
  ],
  toRows: (d) => d.cohorts.map((c) => [c.id, c.name, c.programmeName, c.startDate, c.endDate]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const id = req(c, 'cohort_id');
    const name = req(c, 'cohort_name');
    if (!id || !name) return null;
    return {
      id,
      name,
      programmeName: str(c, 'programme_name') || name,
      startDate: date(c, 'start_date', true) ?? '',
      endDate: date(c, 'end_date', true) ?? '',
    };
  },
};

const firms: TableSpec<Firm> = {
  key: 'firms',
  file: 'firms.csv',
  title: 'Firms',
  description: 'Participating investment firms. One private report per firm.',
  columns: [
    { name: 'firm_id', required: true, help: 'Stable internal ID' },
    { name: 'firm_name', required: true, help: 'As it should appear in the report' },
    { name: 'cohort_id', required: true, help: 'Must match cohorts.csv' },
    { name: 'logo_url', help: 'HTTPS URL of the firm logo (SVG or PNG). Optional.' },
    { name: 'report_token', help: 'Opaque link token. Leave blank to generate; keep it to preserve links.' },
    { name: 'report_enabled', help: 'yes / no (default yes). "no" = counted in cohort averages only.' },
  ],
  toRows: (d) =>
    d.firms.map((f) => [
      f.id,
      f.name,
      f.cohortId,
      f.logoUrl?.startsWith('data:') ? '' : f.logoUrl,
      f.reportToken,
      yn(f.reportEnabled ?? true),
    ]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const id = req(c, 'firm_id');
    const name = req(c, 'firm_name');
    const cohortId = req(c, 'cohort_id');
    if (!id || !name || !cohortId) return null;
    let token = str(c, 'report_token');
    if (!token) {
      token = newToken();
      issues.push({ row, message: `No report_token for ${name}; generated ${token}. Save it back to the sheet.` });
    }
    return {
      id,
      name,
      cohortId,
      logoUrl: str(c, 'logo_url') || undefined,
      reportToken: token,
      reportEnabled: bool(c, 'report_enabled', true),
    };
  },
};

const fellows: TableSpec<Fellow> = {
  key: 'fellows',
  file: 'fellows.csv',
  title: 'Fellows',
  description: 'Sponsored employees, each assigned to one firm.',
  columns: [
    { name: 'fellow_id', required: true, help: 'Stable internal ID' },
    { name: 'first_name', required: true, help: '' },
    { name: 'last_name', required: true, help: '' },
    { name: 'role', help: 'Job title. Optional.' },
    { name: 'firm_id', required: true, help: 'Must match firms.csv' },
    { name: 'cohort_id', required: true, help: 'Must match cohorts.csv' },
    { name: 'report_token', help: 'Opaque link token. Leave blank to generate.' },
  ],
  toRows: (d) => d.fellows.map((f) => [f.id, f.firstName, f.lastName, f.role, f.firmId, f.cohortId, f.reportToken]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const id = req(c, 'fellow_id');
    const firstName = req(c, 'first_name');
    const lastName = req(c, 'last_name');
    const firmId = req(c, 'firm_id');
    const cohortId = req(c, 'cohort_id');
    if (!id || !firstName || !lastName || !firmId || !cohortId) return null;
    let token = str(c, 'report_token');
    if (!token) {
      token = newToken();
      issues.push({ row, message: `No report_token for ${firstName} ${lastName}; generated ${token}.` });
    }
    return { id, firstName, lastName, role: str(c, 'role') || undefined, firmId, cohortId, reportToken: token };
  },
};

const sessions: TableSpec<Session> = {
  key: 'sessions',
  file: 'sessions.csv',
  title: 'Sessions',
  description: 'Every programme session, including ones not yet held.',
  columns: [
    { name: 'session_id', required: true, help: 'Stable ID, referenced by attendance' },
    { name: 'cohort_id', required: true, help: '' },
    { name: 'session_number', required: true, help: '1, 2, 3…' },
    { name: 'session_title', required: true, help: '' },
    { name: 'session_date', required: true, help: 'YYYY-MM-DD' },
    { name: 'status', help: 'held, scheduled or cancelled (default held)' },
    { name: 'facilitator', help: 'Optional' },
  ],
  toRows: (d) => d.sessions.map((s) => [s.id, s.cohortId, s.number, s.title, s.date, s.status, s.facilitator]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const id = req(c, 'session_id');
    const cohortId = req(c, 'cohort_id');
    const title = req(c, 'session_title');
    const number = num(c, 'session_number');
    const d = date(c, 'session_date', true);
    if (!id || !cohortId || !title || number === undefined || !d) return null;
    return {
      id,
      cohortId,
      number,
      title,
      date: d,
      status: oneOf(c, 'status', ['held', 'scheduled', 'cancelled'] as const, 'held'),
      facilitator: str(c, 'facilitator') || undefined,
    };
  },
};

const sessionRecords: TableSpec<SessionRecord> = {
  key: 'sessionRecords',
  file: 'attendance_feedback.csv',
  title: 'Attendance & feedback',
  description:
    'One row per fellow per session held. Reflections are imported and displayed exactly as written — paste the original form responses.',
  columns: [
    { name: 'fellow_id', required: true, help: '' },
    { name: 'session_id', required: true, help: '' },
    { name: 'attended', required: true, help: 'yes / no' },
    { name: 'feedback_submitted', required: true, help: 'yes / no' },
    { name: 'what_i_learned', help: 'Original response, verbatim' },
    { name: 'what_ill_apply', help: 'Original response, verbatim' },
    { name: 'feedback_submitted_at', help: 'YYYY-MM-DD. Optional.' },
  ],
  toRows: (d) =>
    d.sessionRecords.map((r) => [
      r.fellowId,
      r.sessionId,
      yn(r.attended),
      yn(r.feedbackSubmitted),
      r.whatILearned,
      r.whatIllApply,
      r.feedbackSubmittedAt,
    ]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const fellowId = req(c, 'fellow_id');
    const sessionId = req(c, 'session_id');
    if (!fellowId || !sessionId) return null;
    const attended = bool(c, 'attended');
    const feedbackSubmitted = bool(c, 'feedback_submitted');
    if (feedbackSubmitted && !attended)
      issues.push({ row, message: 'Feedback marked submitted for a session not attended — it will be ignored.' });
    return {
      fellowId,
      sessionId,
      attended,
      feedbackSubmitted,
      whatILearned: verbatim(c, 'what_i_learned'),
      whatIllApply: verbatim(c, 'what_ill_apply'),
      feedbackSubmittedAt: date(c, 'feedback_submitted_at'),
    };
  },
};

const capstones: TableSpec<CapstoneRecord> = {
  key: 'capstones',
  file: 'capstone.csv',
  title: 'Capstone Lab',
  description:
    'Append a new row whenever the status changes (do not overwrite), so earlier checkpoint reports stay as issued.',
  columns: [
    { name: 'fellow_id', required: true, help: '' },
    { name: 'recorded_at', required: true, help: 'YYYY-MM-DD the row became true' },
    { name: 'submitted', required: true, help: 'yes / no' },
    { name: 'submission_date', help: 'YYYY-MM-DD' },
    { name: 'submission_deadline', required: true, help: 'YYYY-MM-DD' },
    { name: 'submitted_on_time', help: 'yes / no. Leave blank to derive from the dates.' },
    { name: 'assessment_status', required: true, help: 'not_started, pending or complete' },
    { name: 'assessment_score', help: 'Only shown when status is complete' },
    { name: 'assessment_max_score', help: 'Default 100' },
    { name: 'detailed_feedback', help: 'Only shown when status is complete' },
  ],
  toRows: (d) =>
    d.capstones.map((r) => [
      r.fellowId,
      r.recordedAt,
      yn(r.submitted),
      r.submissionDate,
      r.submissionDeadline,
      yn(r.submittedOnTime),
      r.assessmentStatus,
      r.assessmentScore,
      r.assessmentMaxScore,
      r.detailedFeedback,
    ]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const fellowId = req(c, 'fellow_id');
    const recordedAt = date(c, 'recorded_at', true);
    const deadline = date(c, 'submission_deadline', true);
    if (!fellowId || !recordedAt || !deadline) return null;
    const onTime = str(c, 'submitted_on_time');
    const status = oneOf(c, 'assessment_status', ['not_started', 'pending', 'complete'] as const, 'pending');
    const score = num(c, 'assessment_score');
    if (status === 'complete' && score === undefined)
      issues.push({ row, message: 'Assessment marked complete but no score given.' });
    return {
      fellowId,
      recordedAt,
      submitted: bool(c, 'submitted'),
      submissionDate: date(c, 'submission_date'),
      submissionDeadline: deadline,
      submittedOnTime: onTime ? bool(c, 'submitted_on_time') : undefined,
      assessmentStatus: status,
      assessmentScore: score,
      assessmentMaxScore: num(c, 'assessment_max_score'),
      detailedFeedback: verbatim(c, 'detailed_feedback'),
    };
  },
};

const checkpoints: TableSpec<Checkpoint> = {
  key: 'checkpoints',
  file: 'checkpoints.csv',
  title: 'Reporting checkpoints',
  description: 'Each checkpoint fixes which sessions a report covers. Publish to make it visible to firms.',
  columns: [
    { name: 'checkpoint_id', required: true, help: '' },
    { name: 'cohort_id', required: true, help: '' },
    { name: 'checkpoint_title', required: true, help: 'e.g. Checkpoint 2' },
    { name: 'reporting_date', required: true, help: 'YYYY-MM-DD — data as at this date' },
    { name: 'session_ids', required: true, help: 'Semicolon-separated, e.g. s01;s02;s03' },
    { name: 'status', help: 'draft or published (default draft)' },
  ],
  toRows: (d) =>
    d.checkpoints.map((c) => [c.id, c.cohortId, c.title, c.reportingDate, c.sessionIds.join(';'), c.status]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const id = req(c, 'checkpoint_id');
    const cohortId = req(c, 'cohort_id');
    const title = req(c, 'checkpoint_title');
    const reportingDate = date(c, 'reporting_date', true);
    const ids = req(c, 'session_ids');
    if (!id || !cohortId || !title || !reportingDate || !ids) return null;
    return {
      id,
      cohortId,
      title,
      reportingDate,
      sessionIds: ids.split(/[;|]/).map((s) => s.trim()).filter(Boolean),
      status: oneOf(c, 'status', ['draft', 'published'] as const, 'draft'),
    };
  },
};

const users: TableSpec<AuthorisedUser> = {
  key: 'users',
  file: 'authorised_users.csv',
  title: 'Authorised recipients',
  description: 'Who may open each firm’s report. Enforced in Phase 3 (authentication).',
  columns: [
    { name: 'user_id', required: true, help: '' },
    { name: 'email', required: true, help: '' },
    { name: 'name', help: '' },
    { name: 'firm_id', help: 'Blank for Included VC admins' },
    { name: 'role', required: true, help: 'firm_leader or admin' },
    { name: 'access_status', help: 'active, invited or revoked (default invited)' },
  ],
  toRows: (d) => d.users.map((u) => [u.id, u.email, u.name, u.firmId ?? '', u.role, u.accessStatus]),
  parse(rec, row, issues) {
    const c = { rec, row, issues };
    const id = req(c, 'user_id');
    const email = req(c, 'email');
    if (!id || !email) return null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) issues.push({ row, message: `"${email}" is not a valid email` });
    return {
      id,
      email,
      name: str(c, 'name') || undefined,
      firmId: str(c, 'firm_id') || null,
      role: oneOf(c, 'role', ['firm_leader', 'admin'] as const, 'firm_leader'),
      accessStatus: oneOf(c, 'access_status', ['active', 'invited', 'revoked'] as const, 'invited'),
    };
  },
};

export const tableSpecs: TableSpec[] = [
  cohorts,
  firms,
  fellows,
  sessions,
  sessionRecords,
  capstones,
  checkpoints,
  users,
] as TableSpec[];

export function templateCsv(spec: TableSpec, ds: Dataset) {
  return toCsv(
    spec.columns.map((c) => c.name),
    spec.toRows(ds) as Array<Array<string | number | boolean | undefined>>,
  );
}

export function importCsv(spec: TableSpec, text: string) {
  const { header, records } = csvObjects(text);
  const issues: ImportIssue[] = [];
  const missingCols = spec.columns.filter((c) => c.required && !header.includes(c.name)).map((c) => c.name);
  if (missingCols.length) {
    return {
      items: [] as unknown[],
      issues: [{ row: 0, message: `Missing column(s): ${missingCols.join(', ')}` }],
      fatal: true,
    };
  }
  const items = records
    .map((rec, i) => spec.parse(rec, i + 1, issues))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { items, issues, fatal: false };
}
