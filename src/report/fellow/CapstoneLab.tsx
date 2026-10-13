import type { CapstoneView, FellowMetrics } from '../../data/metrics';
import { formatDate } from '../format';
import { Icon, Reveal } from '../primitives';

export function CapstonePill({ capstone: c }: { capstone: CapstoneView }) {
  if (c.state === 'submitted' && c.assessment === 'complete')
    return (
      <span className="r-pill r-pill--ok">
        <Icon.Check size={13} /> Capstone assessed
      </span>
    );
  if (c.state === 'submitted')
    return (
      <span className="r-pill r-pill--wait">
        <Icon.Clock size={13} /> Capstone submitted · assessment pending
      </span>
    );
  if (c.state === 'not_submitted') return <span className="r-pill">Capstone not submitted</span>;
  if (c.state === 'not_yet_submitted')
    return <span className="r-pill r-pill--muted">Capstone due {formatDate(c.submissionDeadline!)}</span>;
  return <span className="r-pill r-pill--muted">Capstone Lab not yet open</span>;
}

/** Capstone in one place: submitted or not, then the assessment once it exists. */
export function CapstoneLab({ metrics: m, eyebrow }: { metrics: FellowMetrics; eyebrow: string }) {
  const c = m.capstone;
  const submitted = c.state === 'submitted';
  const word = submitted ? 'Submitted' : c.state === 'no_record' ? 'Not yet open' : 'Not submitted';
  const detail = submitted
    ? [c.submissionDate && `Received ${formatDate(c.submissionDate)}`, c.submittedOnTime === true && 'on time']
        .filter(Boolean)
        .join(', ')
    : c.submissionDeadline
      ? `Deadline ${formatDate(c.submissionDeadline)}`
      : c.state === 'no_record'
        ? 'The Capstone Lab takes place later in the programme.'
        : '';

  return (
    <section id="capstone" className="r-section r-section--paper">
      <div className="r-wrap">
        <Reveal>
          <div className="r-rule" />
          <div className="r-eyebrow" style={{ marginBottom: 28 }}>
            {eyebrow}
          </div>
        </Reveal>
        <Reveal className="r-capstone r-capstone--simple">
          <div className="r-capstone__status">
            <div className={`r-capstone__state r-capstone__state--${submitted ? 'ok' : 'none'}`}>{word}</div>
            {detail && <p>{detail}</p>}
          </div>
          {c.assessment === 'complete' && c.score !== null && (
            <div className="r-capstone__rows">
              <div className="r-crow">
                <div>
                  <div className="r-crow__label">Assessment</div>
                  <div className="r-crow__sub">Scored by the Included VC programme team</div>
                </div>
                <div className="r-score">
                  <span className="r-num">{c.score}</span>
                  <span className="r-mono">/ {c.maxScore}</span>
                </div>
              </div>
              {c.detailedFeedback && <div className="r-capstone__feedback">{c.detailedFeedback}</div>}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
