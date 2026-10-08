import { describe, expect, it } from 'vitest';
import { capstoneAt, cohortBenchmarks, compare, fellowMetrics, rate } from './metrics';
import { sampleDataset as data } from './sample/sampleDataset';
import type { Checkpoint, Dataset } from './types';

const cp = (id: string) => data.checkpoints.find((c) => c.id === id)!;
const fellow = (id: string) => data.fellows.find((f) => f.id === id)!;

describe('rate', () => {
  it('returns null (not 0, not NaN) when there is no denominator', () => {
    expect(rate(0, 0)).toEqual({ numerator: 0, denominator: 0, value: null, percent: null });
  });
  it('rounds to whole percentages', () => {
    expect(rate(7, 8).percent).toBe(88);
    expect(rate(6, 7).percent).toBe(86);
  });
});

describe('fellowMetrics — Alexandra Smith, checkpoint 2', () => {
  const m = fellowMetrics(data, fellow('fellow-alexandra-smith'), cp('cp-2026-2'));
  it('counts attendance over sessions held', () => {
    expect(m.sessionsHeld).toBe(8);
    expect(m.sessionsAttended).toBe(7);
    expect(m.attendance.percent).toBe(88);
  });
  it('uses sessions attended as the feedback denominator', () => {
    expect(m.feedback.denominator).toBe(7);
    expect(m.feedback.numerator).toBe(6);
    expect(m.feedback.percent).toBe(86);
  });
  it('marks missed sessions without feedback opportunity', () => {
    const s5 = m.lines.find((l) => l.session.number === 5)!;
    expect(s5.outcome).toBe('missed');
    expect(s5.feedback).toBe('not_applicable');
  });
  it('preserves reflections exactly as stored', () => {
    const s2 = m.lines.find((l) => l.session.number === 2)!;
    const raw = data.sessionRecords.find(
      (r) => r.fellowId === 'fellow-alexandra-smith' && r.sessionId === 's02',
    )!;
    expect(s2.whatILearned).toBe(raw.whatILearned);
    expect(s2.whatIllApply).toBe(raw.whatIllApply);
  });
});

describe('historical checkpoints', () => {
  it('checkpoint 1 only counts the sessions it covers', () => {
    const m = fellowMetrics(data, fellow('fellow-alexandra-smith'), cp('cp-2026-1'));
    expect(m.sessionsHeld).toBe(4);
    expect(m.attendance.percent).toBe(100);
    expect(m.capstone.state).toBe('no_record');
  });
  it('capstone snapshots are read as of the reporting date', () => {
    const before = capstoneAt(data.capstones, 'fellow-daniel-mensah', '2026-09-30');
    const after = capstoneAt(data.capstones, 'fellow-daniel-mensah', '2026-10-06');
    expect(before.assessment).toBe('pending');
    expect(before.score).toBeNull();
    expect(after.assessment).toBe('complete');
    expect(after.score).toBe(78);
  });
});

describe('edge cases', () => {
  it('zero attendance gives no feedback rate rather than 0%', () => {
    const m = fellowMetrics(data, fellow('fellow-cohort-17'), cp('cp-2026-2'));
    expect(m.attendance.percent).toBe(0);
    expect(m.feedback.percent).toBeNull();
  });

  it('missing attendance rows count as not attended and are marked unrecorded', () => {
    const d: Dataset = {
      ...data,
      sessionRecords: data.sessionRecords.filter(
        (r) => !(r.fellowId === 'fellow-amara-okafor' && r.sessionId === 's01'),
      ),
    };
    const m = fellowMetrics(d, fellow('fellow-amara-okafor'), cp('cp-2026-2'));
    expect(m.sessionsAttended).toBe(7);
    expect(m.lines[0].outcome).toBe('unrecorded');
  });

  it('feedback on an unattended session is ignored', () => {
    const d: Dataset = {
      ...data,
      sessionRecords: data.sessionRecords.map((r) =>
        r.fellowId === 'fellow-alexandra-smith' && r.sessionId === 's05'
          ? { ...r, feedbackSubmitted: true, whatILearned: 'should not show' }
          : r,
      ),
    };
    const m = fellowMetrics(d, fellow('fellow-alexandra-smith'), cp('cp-2026-2'));
    expect(m.feedback.numerator).toBe(6);
    expect(m.lines[4].whatILearned).toBeNull();
  });

  it('cancelled and future sessions are excluded from sessions held', () => {
    const c: Checkpoint = { ...cp('cp-2026-2'), sessionIds: [...cp('cp-2026-2').sessionIds, 's09'] };
    const d: Dataset = {
      ...data,
      sessions: data.sessions.map((s) => (s.id === 's08' ? { ...s, status: 'cancelled' } : s)),
    };
    const m = fellowMetrics(d, fellow('fellow-amara-okafor'), c);
    expect(m.sessionsHeld).toBe(7);
    expect(m.lines.find((l) => l.session.id === 's09')!.outcome).toBe('upcoming');
  });

  it('never exposes a score while an assessment is pending', () => {
    const v = capstoneAt(
      [{ fellowId: 'x', recordedAt: '2026-01-01', submitted: true, submissionDate: '2026-01-01', submissionDeadline: '2026-01-02', assessmentStatus: 'pending', assessmentScore: 90, detailedFeedback: 'draft' }],
      'x',
      '2026-02-01',
    );
    expect(v.score).toBeNull();
    expect(v.detailedFeedback).toBeNull();
    expect(v.submittedOnTime).toBe(true);
  });

  it('a missed deadline is reported as not submitted / late', () => {
    const v = capstoneAt(
      [{ fellowId: 'x', recordedAt: '2026-01-01', submitted: false, submissionDeadline: '2026-01-10', assessmentStatus: 'not_started' }],
      'x',
      '2026-02-01',
    );
    expect(v.state).toBe('not_submitted');
    expect(v.submittedOnTime).toBe(false);
  });
});

describe('cohort benchmarks', () => {
  it('is an equal-weighted mean of fellow rates, excluding fellows with no rate', () => {
    const b = cohortBenchmarks(data, cp('cp-2026-2'));
    const all = data.fellows.map((f) => fellowMetrics(data, f, cp('cp-2026-2')));
    const att = all.map((m) => m.attendance.value!);
    const fb = all.map((m) => m.feedback.value).filter((v): v is number => v !== null);
    expect(b.attendance).toBeCloseTo(att.reduce((a, x) => a + x, 0) / att.length, 10);
    expect(b.feedback).toBeCloseTo(fb.reduce((a, x) => a + x, 0) / fb.length, 10);
    expect(b.fellowsCounted).toBe(20);
  });
  it('compares displayed percentages', () => {
    expect(compare(88, 81)).toBe('above');
    expect(compare(81, 81)).toBe('level');
    expect(compare(null, 81)).toBe('unknown');
  });
});
