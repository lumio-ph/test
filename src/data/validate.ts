/**
 * Data-quality checks run in the admin before reports are shared.
 * Errors would produce a wrong report; warnings deserve a look.
 */
import { checkpointSessions } from './metrics';
import type { Dataset } from './types';

export interface DataIssue {
  level: 'error' | 'warning';
  area: string;
  message: string;
}

export function validateDataset(d: Dataset): DataIssue[] {
  const out: DataIssue[] = [];
  const err = (area: string, message: string) => out.push({ level: 'error', area, message });
  const warn = (area: string, message: string) => out.push({ level: 'warning', area, message });

  const ids = <T,>(xs: T[], key: (x: T) => string, area: string) => {
    const seen = new Set<string>();
    for (const x of xs) {
      const k = key(x);
      if (seen.has(k)) err(area, `Duplicate ${area.toLowerCase()} "${k}"`);
      seen.add(k);
    }
    return seen;
  };

  const cohortIds = ids(d.cohorts, (c) => c.id, 'Cohort');
  const firmIds = ids(d.firms, (f) => f.id, 'Firm');
  const fellowIds = ids(d.fellows, (f) => f.id, 'Fellow');
  const sessionIds = ids(d.sessions, (s) => s.id, 'Session');
  ids(d.firms, (f) => f.reportToken, 'Firm link token');
  ids(d.fellows, (f) => f.reportToken, 'Fellow link token');

  for (const f of d.firms) {
    if (!cohortIds.has(f.cohortId)) err('Firms', `${f.name} refers to unknown cohort "${f.cohortId}"`);
    if (f.reportToken.length < 10) warn('Firms', `${f.name} has a short, guessable link token`);
  }
  for (const f of d.fellows) {
    if (!firmIds.has(f.firmId)) err('Fellows', `${f.firstName} ${f.lastName} refers to unknown firm "${f.firmId}"`);
    if (!cohortIds.has(f.cohortId)) err('Fellows', `${f.firstName} ${f.lastName} refers to unknown cohort "${f.cohortId}"`);
  }

  const seenRec = new Set<string>();
  for (const r of d.sessionRecords) {
    const k = `${r.fellowId}|${r.sessionId}`;
    if (seenRec.has(k)) err('Attendance', `Two rows for fellow "${r.fellowId}" in session "${r.sessionId}"`);
    seenRec.add(k);
    if (!fellowIds.has(r.fellowId)) err('Attendance', `Row for unknown fellow "${r.fellowId}"`);
    if (!sessionIds.has(r.sessionId)) err('Attendance', `Row for unknown session "${r.sessionId}"`);
    if (r.feedbackSubmitted && !r.attended)
      warn('Feedback', `Feedback marked submitted for "${r.fellowId}" in "${r.sessionId}" without attendance (ignored)`);
    if (!r.feedbackSubmitted && (r.whatILearned || r.whatIllApply))
      warn('Feedback', `Reflection text present but feedback not marked submitted: "${r.fellowId}" / "${r.sessionId}" (hidden)`);
  }

  for (const cp of d.checkpoints) {
    const { held } = checkpointSessions(cp, d.sessions);
    for (const sid of cp.sessionIds) if (!sessionIds.has(sid)) err('Checkpoints', `${cp.title} lists unknown session "${sid}"`);
    const fellows = d.fellows.filter((f) => f.cohortId === cp.cohortId);
    let missing = 0;
    for (const f of fellows) for (const s of held) if (!seenRec.has(`${f.id}|${s.id}`)) missing++;
    if (missing)
      warn('Checkpoints', `${cp.title}: ${missing} attendance ${missing === 1 ? 'row is' : 'rows are'} missing (counted as not attended)`);
  }

  for (const c of d.capstones) {
    if (!fellowIds.has(c.fellowId)) err('Capstone', `Capstone row for unknown fellow "${c.fellowId}"`);
    if (c.assessmentStatus === 'complete' && typeof c.assessmentScore !== 'number')
      warn('Capstone', `Assessment complete without a score for "${c.fellowId}"`);
    if (c.submitted && !c.submissionDate && c.submittedOnTime === undefined)
      warn('Capstone', `Submitted without a submission date for "${c.fellowId}" — on-time status unknown`);
  }

  for (const u of d.users) {
    if (u.role === 'firm_leader' && (!u.firmId || !firmIds.has(u.firmId)))
      err('Recipients', `${u.email} is a firm leader without a valid firm`);
  }
  for (const f of d.firms) {
    const hasFellows = d.fellows.some((x) => x.firmId === f.id);
    const hasRecipients = d.users.some((u) => u.firmId === f.id && u.accessStatus !== 'revoked');
    if (hasFellows && !hasRecipients && f.reportEnabled !== false)
      warn('Recipients', `${f.name} has no authorised recipients`);
  }

  return out;
}
