import mark from '../../assets/africa-mark.png';
import { compare, pointsDifference } from '../../data/metrics';
import type { FellowReportModel } from '../../data/repository';
import { ComparisonBar, comparisonPhrase } from '../CohortComparison';
import { formatDate, formatMonthYear, pad2, plural } from '../format';
import { Icon, Monogram, Percent, Reveal, SectionHead, useInView } from '../primitives';
import { BackToFirm } from '../ReportChrome';
import { SessionLegend, SessionStrip } from '../SessionStrip';
import type { CapstoneView } from '../../data/metrics';

const capstoneWord = (c: CapstoneView) =>
  c.state === 'submitted' ? (c.assessment === 'complete' ? 'Assessed' : 'Submitted') : c.state === 'not_submitted' ? 'Missed' : c.state === 'not_yet_submitted' ? 'Due' : 'Later';

const capstoneDetail = (c: CapstoneView) =>
  c.state === 'submitted'
    ? [c.submittedOnTime ? 'On time' : c.submittedOnTime === false ? 'After the deadline' : null, c.assessment === 'complete' ? `Score ${c.score} / ${c.maxScore}` : 'Assessment pending']
        .filter(Boolean)
        .join(' · ')
    : c.submissionDeadline
      ? `Deadline ${formatDate(c.submissionDeadline)}`
      : 'Opens later in the programme';

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export function FellowHero({ model }: { model: FellowReportModel }) {
  const { metrics: m, cohort, firm, checkpoint } = model;
  const reflections = m.lines.filter((l) => l.whatILearned || l.whatIllApply).length;

  return (
    <section className="r-hero" aria-labelledby="report-title">
      <img className="r-hero__mark" src={mark} alt="" aria-hidden="true" />
      <div className="r-wrap">
        <Reveal>
          <BackToFirm ctx={model} />
          <div className="r-rule" />
          <div className="r-hero__meta">
            <span className="r-eyebrow">
              {cohort.name} · Individual progress report · {checkpoint.title} · {formatMonthYear(checkpoint.reportingDate)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
            <Monogram person={m.fellow} size="lg" />
            <div className="r-mono" style={{ fontSize: 13 }}>
              {m.fellow.role ? `${m.fellow.role} · ` : ''}Sponsored by {firm.name}
              <br />
              Data as at {formatDate(checkpoint.reportingDate)}
            </div>
          </div>
          <h1 id="report-title" className="r-h1 r-hero__title" style={{ maxWidth: '14ch' }}>
            <span className="hl-lime">{m.fellow.firstName}</span> {m.fellow.lastName}
          </h1>
          <p className="r-lede r-hero__lede">
            How {m.fellow.firstName} is showing up, engaging and putting the {cohort.programmeName} into practice, with
            every reflection shown exactly as written.
          </p>
        </Reveal>

        <div className="r-stats r-stats--four">
          <Reveal className="r-card r-stat">
            <div className="r-num">
              <Percent value={m.attendance.percent} />
            </div>
            <div className="r-stat__label">
              <strong>Attendance</strong>
              {m.sessionsAttended} of {m.sessionsHeld} sessions attended
            </div>
          </Reveal>
          <Reveal className="r-card r-stat" delay={60}>
            <div className="r-num">
              <Percent value={m.feedback.percent} />
            </div>
            <div className="r-stat__label">
              <strong>Feedback completion</strong>
              {m.feedback.denominator === 0
                ? 'No feedback opportunities yet'
                : `${m.feedback.numerator} of ${m.feedback.denominator} after sessions attended`}
            </div>
          </Reveal>
          <Reveal className="r-card r-stat r-stat--gold" delay={120}>
            <div className="r-num">{reflections}</div>
            <div className="r-stat__label">
              <strong>Written {plural(reflections, 'reflection')}</strong>
              On what {m.fellow.firstName} learned and will apply
            </div>
          </Reveal>
          <Reveal className="r-card r-stat" delay={180}>
            <div className="r-stat__word">{capstoneWord(m.capstone)}</div>
            <div className="r-stat__label">
              <strong>Capstone Lab</strong>
              {capstoneDetail(m.capstone)}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 01 Participation & attendance                                       */
/* ------------------------------------------------------------------ */

export function AttendanceSection({ model }: { model: FellowReportModel }) {
  const { metrics: m, benchmarks } = model;
  const name = m.fellow.firstName;
  const diff = pointsDifference(m.attendance.percent, benchmarks.attendancePercent);
  const cmp = compare(m.attendance.percent, benchmarks.attendancePercent);
  const phrase = comparisonPhrase(diff, cmp);
  const missed = m.lines.filter((l) => l.outcome === 'missed' || l.outcome === 'unrecorded');
  const held = m.lines.filter((l) => l.outcome !== 'upcoming');

  const verdict =
    m.sessionsHeld === 0
      ? 'No sessions have been held yet for this checkpoint.'
      : m.sessionsAttended === m.sessionsHeld
        ? `${name} has attended every session so far${phrase ? `, ${phrase}` : ''}.`
        : `${name} has attended ${m.sessionsAttended} of ${m.sessionsHeld} sessions${phrase ? `, ${phrase}` : ''}.`;

  return (
    <section id="participation" className="r-section">
      <div className="r-wrap">
        <SectionHead eyebrow="01 · Participation & attendance" title={`Is ${name} showing up?`} />

        <div className="r-split">
          <Reveal>
            <div className="r-big r-attend__big">
              <Percent value={m.attendance.percent} />
            </div>
            <p className="r-attend__caption">
              <strong>attendance</strong> · {m.sessionsAttended} of {m.sessionsHeld} sessions held
            </p>
          </Reveal>
          <Reveal delay={100}>
            <p className="r-verdict">{verdict}</p>
            <ComparisonBar
              value={m.attendance.percent}
              cohort={benchmarks.attendancePercent}
              valueLabel={name}
            />
          </Reveal>
        </div>

        <Reveal className="r-card r-panel r-panel--spaced" delay={60}>
          <div className="r-sessions-head">
            <h3 className="r-h3">Session by session</h3>
            <span className="r-mono">
              {m.sessionsHeld} of {model.programmeSessions} programme sessions held
            </span>
          </div>
          <SessionStrip lines={m.lines} programmeTotal={model.programmeSessions} />
          <SessionLegend
            hasUpcoming={model.programmeSessions > held.length}
            hasUnrecorded={m.lines.some((l) => l.outcome === 'unrecorded')}
          />
          <div className="r-missed">
            {missed.length === 0 ? (
              <span>
                <b>No sessions missed</b> in this reporting period.
              </span>
            ) : (
              missed.map((l) => (
                <span key={l.session.id}>
                  <b>
                    Session {pad2(l.session.number)} {l.outcome === 'missed' ? 'missed' : 'attendance not recorded'}
                  </b>{' '}
                  · {l.session.title} · {formatDate(l.session.date)}
                </span>
              ))
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 02 Feedback & engagement                                            */
/* ------------------------------------------------------------------ */

export function FeedbackSection({ model }: { model: FellowReportModel }) {
  const { metrics: m, benchmarks } = model;
  const name = m.fellow.firstName;
  const [ref, inView] = useInView<HTMLDivElement>();
  const diff = pointsDifference(m.feedback.percent, benchmarks.feedbackPercent);
  const phrase = comparisonPhrase(diff, compare(m.feedback.percent, benchmarks.feedbackPercent));
  const max = Math.max(m.sessionsHeld, 1);

  const steps = [
    { n: m.sessionsHeld, label: 'Sessions held', sub: 'In this reporting period', color: 'var(--ink-300)' },
    { n: m.sessionsAttended, label: 'Feedback opportunities', sub: `Sessions ${name} attended`, color: 'var(--kelly)' },
    { n: m.feedback.numerator, label: 'Feedback submitted', sub: 'Forms completed after attending', color: 'var(--gold)' },
  ];

  return (
    <section id="engagement" className="r-section r-section--paper">
      <div className="r-wrap">
        <SectionHead eyebrow="02 · Feedback & engagement" title={`Is ${name} actively engaging?`}>
          <p className="r-body">
            <strong>Attendance</strong> shows {name} was in the room. <strong>Feedback</strong> shows what happened
            next: after every session, fellows are asked what they learned and what they will apply.
          </p>
        </SectionHead>

        <Reveal>
          <div className="r-funnel" ref={ref}>
            {steps.map((s, i) => (
              <div key={s.label} className="r-funnel__step">
                <div className="r-num">{s.n}</div>
                <div className="r-funnel__bar">
                  <span
                    style={{
                      width: `${(s.n / max) * 100}%`,
                      background: s.color,
                      transform: `scaleX(${inView ? 1 : 0})`,
                      transitionDelay: `${i * 160}ms`,
                    }}
                  />
                </div>
                <div className="r-funnel__label">
                  <strong>{s.label}</strong>
                  {s.sub}
                </div>
                {i < steps.length - 1 && (
                  <span className="r-funnel__arrow" aria-hidden="true">
                    <Icon.Arrow size={14} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="r-card r-engage" delay={60}>
          <div>
            <div className="r-metric__label" style={{ marginBottom: 14 }}>
              Feedback completion
            </div>
            <div className="r-big r-engage__value">
              <Percent value={m.feedback.percent} />
            </div>
          </div>
          <div>
            <p className="r-verdict" style={{ marginBottom: 28 }}>
              {m.feedback.denominator === 0
                ? `${name} has not yet had a feedback opportunity in this period.`
                : `${name} submitted feedback after ${m.feedback.numerator} of ${m.feedback.denominator} sessions attended${phrase ? `, ${phrase}` : ''}.`}
            </p>
            <ComparisonBar
              value={m.feedback.percent}
              cohort={benchmarks.feedbackPercent}
              valueLabel={name}
              label="Cohort feedback average"
              tone="lime"
            />
          </div>
        </Reveal>
        <p className="r-note">
          Feedback completion = feedback submissions ÷ sessions attended. A feedback opportunity only exists for a
          session {name} attended, so missed sessions never count against engagement.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Learning journey                                                 */
/* ------------------------------------------------------------------ */

export function LearningJourney({ model }: { model: FellowReportModel }) {
  const { metrics: m } = model;
  const name = m.fellow.firstName;
  const held = m.lines.filter((l) => l.outcome !== 'upcoming');

  return (
    <section id="learning" className="r-section">
      <div className="r-wrap">
        <SectionHead eyebrow="03 · The learning journey" title={`What ${name} is taking away, session by session.`}>
          <p className="r-body">
            Not just whether {name} attended, but what {name} took away and intends to change. Every reflection is
            shown <strong>exactly as submitted</strong>: nothing has been rewritten, summarised or generated.
          </p>
        </SectionHead>

        <ol className="r-journey" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {held.map((l) => {
            const state =
              l.outcome !== 'attended' ? l.outcome : l.feedback === 'submitted' ? 'done' : 'nofeedback';
            return (
              <Reveal as="div" key={l.session.id} className={`r-step r-step--${state}`}>
                <div className="r-step__node" aria-hidden="true">
                  {pad2(l.session.number)}
                </div>
                <div>
                  <div className="r-step__head">
                    <div className="r-step__meta">
                      Session {pad2(l.session.number)} · {formatDate(l.session.date)}
                    </div>
                    <h3 className="r-step__title">{l.session.title}</h3>
                    <div className="r-step__chips">
                      {l.outcome === 'attended' ? (
                        <span className="r-pill r-pill--ok">
                          <Icon.Check size={13} /> Attended
                        </span>
                      ) : l.outcome === 'missed' ? (
                        <span className="r-pill r-pill--muted">Did not attend</span>
                      ) : (
                        <span className="r-pill r-pill--muted">Attendance not recorded</span>
                      )}
                      {l.feedback === 'submitted' && (
                        <span className="r-pill r-pill--ok">
                          <Icon.Check size={13} /> Feedback submitted
                        </span>
                      )}
                      {l.feedback === 'not_submitted' && <span className="r-pill">No feedback submitted</span>}
                    </div>
                  </div>

                  {l.feedback === 'submitted' ? (
                    <div className="r-step__words">
                      <div className="r-word">
                        <div className="r-word__label">What I learned</div>
                        {l.whatILearned ? (
                          <p className="r-word__text">{l.whatILearned}</p>
                        ) : (
                          <p className="r-word__none">No response given to this question.</p>
                        )}
                      </div>
                      <div className="r-word r-word--apply">
                        <div className="r-word__label">What I'll apply</div>
                        {l.whatIllApply ? (
                          <p className="r-word__text">{l.whatIllApply}</p>
                        ) : (
                          <p className="r-word__none">No response given to this question.</p>
                        )}
                      </div>
                    </div>
                  ) : l.feedback === 'not_submitted' ? (
                    <p className="r-step__quiet">{name} attended this session. No written feedback was submitted.</p>
                  ) : (
                    <p className="r-step__quiet">
                      {l.outcome === 'missed'
                        ? 'No feedback opportunity, as this session was not attended.'
                        : 'No attendance record has been received for this session yet.'}
                    </p>
                  )}
                </div>
              </Reveal>
            );
          })}
        </ol>
        <div className="r-journey-note">
          <Icon.Check size={14} /> Reflections are reproduced verbatim from {name}'s feedback forms.
        </div>
      </div>
    </section>
  );
}
