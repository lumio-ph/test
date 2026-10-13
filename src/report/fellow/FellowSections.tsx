import mark from '../../assets/africa-mark.png';
import type { CapstoneView } from '../../data/metrics';
import type { FellowReportModel } from '../../data/repository';
import { ComparisonBar } from '../CohortComparison';
import { formatDate, pad2 } from '../format';
import { Percent, Reveal, SectionHead } from '../primitives';
import { SessionLegend, SessionStrip } from '../SessionStrip';

const capstoneWord = (c: CapstoneView) =>
  c.state === 'submitted' ? 'Submitted' : c.state === 'not_submitted' || c.state === 'not_yet_submitted' ? 'Not submitted' : 'Not yet open';

const capstoneDetail = (c: CapstoneView) =>
  c.state === 'submitted'
    ? c.submissionDate
      ? `Received ${formatDate(c.submissionDate)}`
      : 'Received'
    : c.submissionDeadline
      ? `Deadline ${formatDate(c.submissionDeadline)}`
      : 'Later in the programme';

/* ------------------------------------------------------------------ */
/* Hero: one person, their headline numbers                            */
/* ------------------------------------------------------------------ */

export function FellowHero({ model }: { model: FellowReportModel }) {
  const { metrics: m, cohort, benchmarks } = model;
  const name = m.fellow.firstName;

  return (
    <section className="r-hero" aria-labelledby="report-title">
      <img className="r-hero__mark" src={mark} alt="" aria-hidden="true" />
      <div className="r-wrap">
        <Reveal>
          <div className="r-rule" />
          <div className="r-eyebrow" style={{ marginBottom: 32 }}>
            {cohort.name}
          </div>
          <h1 id="report-title" className="r-h1 r-hero__title" style={{ maxWidth: '14ch' }}>
            <span className="hl-lime">{m.fellow.firstName}</span> {m.fellow.lastName}
          </h1>
          <p className="r-lede r-hero__lede">
            A closer look at how {name} is showing up, engaging, and putting their learning into practice throughout
            the {cohort.programmeName}.
          </p>
        </Reveal>

        <div className="r-stats">
          <Reveal className="r-stats__lead">
            <div className="r-eyebrow r-eyebrow--gold">Attendance so far</div>
            <div className="r-big">
              <Percent value={m.attendance.percent} />
            </div>
            <div>
              <div className="r-stats__lead-rule" />
              <p>
                of sessions attended by <strong>{name}</strong>
                {benchmarks.attendancePercent !== null && (
                  <>
                    , against a cohort average of <strong>{benchmarks.attendancePercent}%</strong>
                  </>
                )}
                .
              </p>
            </div>
          </Reveal>

          <Reveal className="r-card r-stat" delay={60}>
            <div className="r-num">
              {m.sessionsAttended}
              <span className="r-of">/ {m.sessionsHeld}</span>
            </div>
            <div className="r-stat__label">
              <strong>Sessions attended</strong>
              Of the masterclasses held so far
            </div>
          </Reveal>

          <Reveal className="r-card r-stat" delay={120}>
            <div className="r-num">
              {m.feedback.numerator}
              <span className="r-of">/ {m.feedback.denominator}</span>
            </div>
            <div className="r-stat__label">
              <strong>Feedback forms</strong>
              {m.feedback.denominator === 0 ? 'No sessions attended yet' : 'Submitted after the sessions attended'}
            </div>
          </Reveal>

          {benchmarks.highRatingPercent !== null ? (
            <Reveal className="r-card r-stat r-stat--gold" delay={60}>
              <div className="r-num">
                <Percent value={benchmarks.highRatingPercent} />
              </div>
              <div className="r-stat__label">
                <strong>of session ratings were 4 or 5 out of 5</strong>
                Across the cohort, compared with the training fellows normally get at work
              </div>
            </Reveal>
          ) : (
            <Reveal className="r-card r-stat r-stat--gold" delay={60}>
              <div className="r-num">{m.lines.filter((l) => l.whatILearned || l.whatIllApply).length}</div>
              <div className="r-stat__label">
                <strong>Written reflections</strong>
                On what {name} learned and will apply
              </div>
            </Reveal>
          )}

          <Reveal className="r-card r-stat" delay={120}>
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
/* 01 Attendance: session by session                                   */
/* ------------------------------------------------------------------ */

export function AttendanceSection({ model }: { model: FellowReportModel }) {
  const { metrics: m, benchmarks } = model;
  const name = m.fellow.firstName;
  const held = m.lines.filter((l) => l.outcome !== 'upcoming');
  const missed = held.filter((l) => l.outcome === 'missed' || l.outcome === 'unrecorded');

  return (
    <section id="participation" className="r-section r-section--paper">
      <div className="r-wrap">
        <SectionHead eyebrow="01 · Attendance" title={`${name}’s attendance, session by session.`}>
          <p className="r-lede" style={{ marginTop: 18 }}>
            {m.sessionsHeld === 0
              ? 'No sessions have been held yet.'
              : `${name} has attended ${m.sessionsAttended} of ${m.sessionsHeld} sessions (${m.attendance.percent}%)${
                  benchmarks.attendancePercent !== null ? `, compared with a cohort average of ${benchmarks.attendancePercent}%` : ''
                }.`}
          </p>
        </SectionHead>

        <Reveal className="r-card r-panel">
          <SessionStrip lines={held} size="lg" />
          <SessionLegend hasUnrecorded={held.some((l) => l.outcome === 'unrecorded')} />
          <div style={{ marginTop: 32 }}>
            <ComparisonBar value={m.attendance.percent} cohort={benchmarks.attendancePercent} valueLabel={name} />
          </div>
          <div className="r-missed">
            {missed.length === 0 ? (
              <span>
                <b>Every session attended</b> so far.
              </span>
            ) : (
              missed.map((l) => (
                <span key={l.session.id}>
                  <b>
                    Session {pad2(l.session.number)} {l.outcome === 'missed' ? 'missed' : 'not yet recorded'}
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
/* 02 Learning journey: the fellow's own words only                    */
/* ------------------------------------------------------------------ */

export function LearningJourney({ model }: { model: FellowReportModel }) {
  const { metrics: m } = model;
  const name = m.fellow.firstName;
  // Only sessions with written reflections. Attendance is covered above.
  const withWords = m.lines.filter((l) => l.outcome === 'attended' && (l.whatILearned || l.whatIllApply));
  if (!withWords.length) return null;

  return (
    <section id="learning" className="r-section">
      <div className="r-wrap">
        <SectionHead eyebrow="02 · The learning journey" title={`What ${name} is taking away, session by session.`}>
          <p className="r-body">
            In {name}’s own words, from the feedback form after each masterclass. Every reflection is shown{' '}
            <strong>exactly as submitted</strong>: nothing has been rewritten, summarised or generated.
          </p>
        </SectionHead>

        <ol className="r-journey" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {withWords.map((l) => (
            <Reveal as="div" key={l.session.id} className="r-step r-step--done">
              <div className="r-step__node" aria-hidden="true">
                {pad2(l.session.number)}
              </div>
              <div>
                <div className="r-step__head">
                  <div className="r-step__meta">
                    Session {pad2(l.session.number)} · {formatDate(l.session.date)}
                  </div>
                  <h3 className="r-step__title">{l.session.title}</h3>
                </div>
                <div className={`r-step__words ${l.whatILearned && l.whatIllApply ? '' : 'r-step__words--one'}`}>
                  {l.whatILearned && (
                    <div className="r-word">
                      <div className="r-word__label">What I learned</div>
                      <p className="r-word__text">{l.whatILearned}</p>
                    </div>
                  )}
                  {l.whatIllApply && (
                    <div className="r-word r-word--apply">
                      <div className="r-word__label">What I'll apply</div>
                      <p className="r-word__text">{l.whatIllApply}</p>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
