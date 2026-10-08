/**
 * Deterministic calculations for every number shown in a report.
 *
 * Rules (also documented in docs/DATA_IMPORT.md):
 *  - Sessions held      = sessions listed on the checkpoint, status 'held',
 *                         dated on or before the checkpoint reporting date.
 *                         Cancelled and not-yet-held sessions are excluded.
 *  - Attendance %       = sessions attended / sessions held × 100.
 *                         A missing attendance row counts as not attended
 *                         and is flagged as a data issue.
 *  - Feedback %         = feedback submissions / sessions attended × 100.
 *                         Feedback on a session the fellow did not attend
 *                         is ignored and flagged. 0 attended → no rate (null).
 *  - Cohort averages    = equal-weighted mean of each cohort fellow's rate
 *                         (fellows without a rate are excluded).
 *  - Differences vs cohort are taken between the *displayed* (rounded)
 *    percentages, so the words always agree with the numbers on screen.
 *
 * No AI is involved in any of these calculations.
 */
import type {
  CapstoneRecord,
  Checkpoint,
  Dataset,
  Fellow,
  ISODate,
  Session,
  SessionRecord,
} from './types';

export type SessionOutcome = 'attended' | 'missed' | 'unrecorded' | 'upcoming';
export type FeedbackOutcome = 'submitted' | 'not_submitted' | 'not_applicable';

export interface SessionLine {
  session: Session;
  outcome: SessionOutcome;
  feedback: FeedbackOutcome;
  whatILearned: string | null;
  whatIllApply: string | null;
}

export interface Rate {
  numerator: number;
  denominator: number;
  /** 0–1, or null when the denominator is zero. */
  value: number | null;
  /** Rounded whole percentage for display, or null. */
  percent: number | null;
}

export interface CapstoneView {
  state: 'no_record' | 'not_yet_submitted' | 'not_submitted' | 'submitted';
  submittedOnTime: boolean | null;
  submissionDate: ISODate | null;
  submissionDeadline: ISODate | null;
  assessment: 'not_started' | 'pending' | 'complete';
  score: number | null;
  maxScore: number | null;
  detailedFeedback: string | null;
  recordedAt: ISODate | null;
}

export interface FellowMetrics {
  fellow: Fellow;
  sessionsHeld: number;
  sessionsAttended: number;
  sessionsMissed: number;
  attendance: Rate;
  feedback: Rate; // submissions / attended
  lines: SessionLine[];
  capstone: CapstoneView;
}

export interface CohortBenchmarks {
  fellowsCounted: number;
  attendance: number | null; // 0–1
  attendancePercent: number | null;
  feedback: number | null;
  feedbackPercent: number | null;
  sessionsHeld: number;
}

/* ------------------------------------------------------------------ */

export const toPercent = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100);

export function rate(numerator: number, denominator: number): Rate {
  const value = denominator > 0 ? numerator / denominator : null;
  return { numerator, denominator, value, percent: toPercent(value) };
}

/** Sessions on the checkpoint, ordered by number, with held/upcoming split. */
export function checkpointSessions(checkpoint: Checkpoint, sessions: Session[]) {
  const listed = checkpoint.sessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is Session => Boolean(s))
    .sort((a, b) => a.number - b.number);
  const held = listed.filter(
    (s) => s.status === 'held' && s.date <= checkpoint.reportingDate,
  );
  const upcoming = listed.filter(
    (s) => s.status !== 'cancelled' && !held.includes(s),
  );
  return { listed, held, upcoming };
}

function recordFor(records: SessionRecord[], fellowId: string, sessionId: string) {
  return records.find((r) => r.fellowId === fellowId && r.sessionId === sessionId);
}

const clean = (text: string | undefined): string | null =>
  text && text.trim().length > 0 ? text : null;

export function capstoneAt(
  records: CapstoneRecord[],
  fellowId: string,
  asOf: ISODate,
): CapstoneView {
  const latest = records
    .filter((r) => r.fellowId === fellowId && r.recordedAt <= asOf)
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];

  if (!latest) {
    return {
      state: 'no_record',
      submittedOnTime: null,
      submissionDate: null,
      submissionDeadline: null,
      assessment: 'not_started',
      score: null,
      maxScore: null,
      detailedFeedback: null,
      recordedAt: null,
    };
  }

  const submitted = latest.submitted;
  const state: CapstoneView['state'] = submitted
    ? 'submitted'
    : asOf > latest.submissionDeadline
      ? 'not_submitted'
      : 'not_yet_submitted';

  let submittedOnTime: boolean | null = null;
  if (submitted) {
    submittedOnTime =
      latest.submittedOnTime ??
      (latest.submissionDate ? latest.submissionDate <= latest.submissionDeadline : null);
  } else if (state === 'not_submitted') {
    submittedOnTime = false;
  }

  const complete = latest.assessmentStatus === 'complete';
  return {
    state,
    submittedOnTime,
    submissionDate: latest.submissionDate ?? null,
    submissionDeadline: latest.submissionDeadline,
    assessment: submitted ? latest.assessmentStatus : 'not_started',
    // Never show a score or feedback unless the assessment is marked complete.
    score: complete && typeof latest.assessmentScore === 'number' ? latest.assessmentScore : null,
    maxScore: complete ? latest.assessmentMaxScore ?? 100 : null,
    detailedFeedback: complete ? clean(latest.detailedFeedback) : null,
    recordedAt: latest.recordedAt,
  };
}

export function fellowMetrics(
  data: Dataset,
  fellow: Fellow,
  checkpoint: Checkpoint,
): FellowMetrics {
  const { listed, held } = checkpointSessions(checkpoint, data.sessions);
  const heldIds = new Set(held.map((s) => s.id));

  const lines: SessionLine[] = listed
    .filter((s) => s.status !== 'cancelled')
    .map((session) => {
      if (!heldIds.has(session.id)) {
        return { session, outcome: 'upcoming', feedback: 'not_applicable', whatILearned: null, whatIllApply: null };
      }
      const rec = recordFor(data.sessionRecords, fellow.id, session.id);
      if (!rec) {
        return { session, outcome: 'unrecorded', feedback: 'not_applicable', whatILearned: null, whatIllApply: null };
      }
      if (!rec.attended) {
        return { session, outcome: 'missed', feedback: 'not_applicable', whatILearned: null, whatIllApply: null };
      }
      return {
        session,
        outcome: 'attended',
        feedback: rec.feedbackSubmitted ? 'submitted' : 'not_submitted',
        whatILearned: rec.feedbackSubmitted ? clean(rec.whatILearned) : null,
        whatIllApply: rec.feedbackSubmitted ? clean(rec.whatIllApply) : null,
      };
    });

  const heldLines = lines.filter((l) => l.outcome !== 'upcoming');
  const attended = heldLines.filter((l) => l.outcome === 'attended').length;
  const submissions = heldLines.filter((l) => l.feedback === 'submitted').length;

  return {
    fellow,
    sessionsHeld: held.length,
    sessionsAttended: attended,
    sessionsMissed: held.length - attended,
    attendance: rate(attended, held.length),
    feedback: rate(submissions, attended),
    lines,
    capstone: capstoneAt(data.capstones, fellow.id, checkpoint.reportingDate),
  };
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function cohortBenchmarks(data: Dataset, checkpoint: Checkpoint): CohortBenchmarks {
  const fellows = data.fellows.filter((f) => f.cohortId === checkpoint.cohortId);
  const all = fellows.map((f) => fellowMetrics(data, f, checkpoint));
  const att = all.map((m) => m.attendance.value).filter((v): v is number => v !== null);
  const fb = all.map((m) => m.feedback.value).filter((v): v is number => v !== null);
  const attendance = mean(att);
  const feedback = mean(fb);
  return {
    fellowsCounted: fellows.length,
    attendance,
    attendancePercent: toPercent(attendance),
    feedback,
    feedbackPercent: toPercent(feedback),
    sessionsHeld: checkpointSessions(checkpoint, data.sessions).held.length,
  };
}

/** Difference in displayed percentage points (a − b), or null. */
export function pointsDifference(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a - b;
}

export type Comparison = 'above' | 'level' | 'below' | 'unknown';
export function compare(a: number | null, b: number | null): Comparison {
  const d = pointsDifference(a, b);
  if (d === null) return 'unknown';
  if (d > 0) return 'above';
  if (d < 0) return 'below';
  return 'level';
}

/** The most recent reflection (by session number) a fellow has submitted. */
export function latestReflection(m: FellowMetrics): SessionLine | null {
  const withWords = m.lines.filter((l) => l.whatIllApply || l.whatILearned);
  return withWords.length ? withWords[withWords.length - 1] : null;
}

export interface FirmSummary {
  fellows: number;
  attendance: Rate; // pooled across the firm's fellows
  feedback: Rate; // pooled submissions / pooled sessions attended
  capstonesSubmitted: number;
  capstonesOnTime: number;
  capstonesAssessed: number;
  capstonesPending: number;
  reflectionsShared: number;
}

/** Firm-level totals: pooled counts across the firm's own fellows. */
export function firmSummary(fellows: FellowMetrics[]): FirmSummary {
  const sum = (f: (m: FellowMetrics) => number) => fellows.reduce((a, m) => a + f(m), 0);
  return {
    fellows: fellows.length,
    attendance: rate(sum((m) => m.sessionsAttended), sum((m) => m.sessionsHeld)),
    feedback: rate(sum((m) => m.feedback.numerator), sum((m) => m.feedback.denominator)),
    capstonesSubmitted: fellows.filter((m) => m.capstone.state === 'submitted').length,
    capstonesOnTime: fellows.filter((m) => m.capstone.submittedOnTime === true).length,
    capstonesAssessed: fellows.filter((m) => m.capstone.assessment === 'complete').length,
    capstonesPending: fellows.filter(
      (m) => m.capstone.state === 'submitted' && m.capstone.assessment !== 'complete',
    ).length,
    reflectionsShared: sum((m) => m.lines.filter((l) => l.whatILearned || l.whatIllApply).length),
  };
}
