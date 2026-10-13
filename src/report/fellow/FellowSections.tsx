import mark from '../../assets/africa-mark.png';
import type { FellowReportModel } from '../../data/repository';
import { ComparisonBar } from '../CohortComparison';
import { formatDate, pad2 } from '../format';
import { Percent, Reveal, SectionHead } from '../primitives';
import { SessionLegend, SessionStrip } from '../SessionStrip';

/* ------------------------------------------------------------------ */
/* Hero: one person, their headline numbers                            */
/* ------------------------------------------------------------------ */

export function FellowHero({ model }: { model: FellowReportModel }) {
  const { metrics: m, cohort } = model;
  const name = m.fellow.firstName;

  return (
    <section className="r-hero r-hero--short" aria-labelledby="report-title">
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

  return (
    <section id="participation" className="r-section r-section--paper">
      <div className="r-wrap">
        <SectionHead eyebrow="01 · Attendance" title={`${name}’s attendance, session by session.`} />

        <div className="r-split">
          <Reveal>
            <div className="r-big r-attend__big">
              <Percent value={m.attendance.percent} />
            </div>
            <p className="r-attend__caption">
              <strong>attendance</strong> · {m.sessionsAttended} of {m.sessionsHeld} sessions
            </p>
          </Reveal>
          <Reveal delay={100}>
            <p className="r-verdict">
              {m.sessionsHeld === 0
                ? 'No sessions have been held yet.'
                : `${name} has attended ${m.sessionsAttended} of ${m.sessionsHeld} sessions${
                    benchmarks.attendancePercent !== null ? `, compared with a cohort average of ${benchmarks.attendancePercent}%` : ''
                  }.`}
            </p>
            <ComparisonBar value={m.attendance.percent} cohort={benchmarks.attendancePercent} valueLabel={name} />
          </Reveal>
        </div>

        <Reveal className="r-card r-panel r-panel--spaced">
          <SessionStrip lines={held} size="lg" />
          <SessionLegend hasUnrecorded={held.some((l) => l.outcome === 'unrecorded')} />
        </Reveal>

        <div className="r-attend-extra">
          <Reveal className="r-card r-stat">
            <div className="r-num">
              {m.feedback.numerator}
              <span className="r-of">/ {m.feedback.denominator}</span>
            </div>
            <div className="r-stat__label">
              <strong>Feedback forms</strong>
              {m.feedback.denominator === 0 ? 'No sessions attended yet' : 'Submitted after the sessions attended'}
            </div>
          </Reveal>
          {benchmarks.highRatingPercent !== null && (
            <Reveal className="r-card r-stat r-stat--gold" delay={80}>
              <div className="r-num">
                <Percent value={benchmarks.highRatingPercent} />
              </div>
              <div className="r-stat__label">
                <strong>of session ratings were 4 or 5 out of 5</strong>
                Across the cohort, compared with the training fellows normally get at work
              </div>
            </Reveal>
          )}
        </div>
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
