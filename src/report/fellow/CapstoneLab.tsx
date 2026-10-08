import type { CapstoneView, FellowMetrics } from '../../data/metrics';
import { formatDate } from '../format';
import { Icon, Reveal, SectionHead } from '../primitives';

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

function Tick({ yes }: { yes: boolean | null }) {
  return (
    <span className={`r-tick ${yes ? 'r-tick--yes' : 'r-tick--no'}`} aria-label={yes ? 'Yes' : yes === false ? 'No' : 'Not yet'}>
      {yes ? <Icon.Check size={18} /> : <Icon.Dash size={18} />}
    </span>
  );
}

export function CapstoneLab({ metrics: m, eyebrow }: { metrics: FellowMetrics; eyebrow: string }) {
  const c = m.capstone;
  const name = m.fellow.firstName;

  const headline =
    c.state === 'submitted'
      ? c.assessment === 'complete'
        ? { text: 'Submitted and assessed', tone: 'ok' }
        : { text: 'Submitted', tone: 'ok' }
      : c.state === 'not_yet_submitted'
        ? { text: 'Not yet submitted', tone: 'wait' }
        : c.state === 'not_submitted'
          ? { text: 'Not submitted', tone: 'none' }
          : { text: 'Not yet open', tone: 'none' };

  const intro =
    c.state === 'submitted'
      ? c.assessment === 'complete'
        ? `${name}'s Capstone Lab has been assessed by the programme team. The score and written feedback are below.`
        : `${name}'s Capstone Lab is with the programme team for assessment. The score and detailed feedback will appear here once complete.`
      : c.state === 'not_yet_submitted'
        ? `The Capstone Lab deadline is ${formatDate(c.submissionDeadline!)}. Its status will update here once ${name} submits.`
        : c.state === 'not_submitted'
          ? `No Capstone Lab submission was recorded by the deadline of ${formatDate(c.submissionDeadline!)}.`
          : 'The Capstone Lab takes place later in the programme. Its status will appear in a future checkpoint.';

  return (
    <section id="capstone" className="r-section r-section--paper">
      <div className="r-wrap">
        <SectionHead eyebrow={eyebrow} title="Capstone Lab.">
          <p className="r-body">
            The Capstone Lab is where fellows bring the programme together into a single, assessed piece of investment
            work.
          </p>
        </SectionHead>

        <Reveal className="r-capstone">
          <div className="r-capstone__status">
            <div className="r-eyebrow r-eyebrow--gold">Status</div>
            <div className={`r-capstone__state r-capstone__state--${headline.tone}`}>{headline.text}</div>
            <p>{intro}</p>
          </div>

          <div className="r-capstone__rows">
            <div className="r-crow">
              <div>
                <div className="r-crow__label">Submitted</div>
                <div className="r-crow__sub">
                  {c.submissionDate ? `Received ${formatDate(c.submissionDate)}` : 'No submission recorded yet'}
                </div>
              </div>
              <Tick yes={c.state === 'submitted'} />
            </div>

            <div className="r-crow">
              <div>
                <div className="r-crow__label">Submitted on time</div>
                <div className="r-crow__sub">
                  {c.submissionDeadline ? `Deadline ${formatDate(c.submissionDeadline)}` : 'Deadline to be confirmed'}
                </div>
              </div>
              {c.submittedOnTime === null ? (
                <span className="r-pill r-pill--muted">Not yet due</span>
              ) : (
                <Tick yes={c.submittedOnTime} />
              )}
            </div>

            <div className="r-crow">
              <div>
                <div className="r-crow__label">Assessment</div>
                <div className="r-crow__sub">Scored by the Included VC programme team</div>
              </div>
              {c.assessment === 'complete' && c.score !== null ? (
                <div className="r-score">
                  <span className="r-num">{c.score}</span>
                  <span className="r-mono">/ {c.maxScore}</span>
                </div>
              ) : c.state === 'submitted' ? (
                <span className="r-pill r-pill--wait">
                  <Icon.Clock size={13} /> Assessment Pending
                </span>
              ) : (
                <span className="r-pill r-pill--muted">Not yet assessed</span>
              )}
            </div>

            <div className="r-crow" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div className="r-crow__label">Detailed feedback</div>
                {!c.detailedFeedback &&
                  (c.state === 'submitted' ? (
                    <span className="r-pill r-pill--wait">
                      <Icon.Clock size={13} /> Pending
                    </span>
                  ) : (
                    <span className="r-pill r-pill--muted">Not yet available</span>
                  ))}
              </div>
              {c.detailedFeedback && <div className="r-capstone__feedback" style={{ marginTop: 16 }}>{c.detailedFeedback}</div>}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
