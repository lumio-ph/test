import type { ReactNode } from 'react';
import type { FellowReportModel } from '../../data/repository';
import type { SelfUpdateMeasure } from '../../data/metrics';
import { Reveal } from '../primitives';

/**
 * "Checkpoint · Self updates": activity completion and tracker reporting from
 * the fellow's own checkpoint tracker, each against the cohort average.
 */
export function SelfUpdatesCard({ model }: { model: FellowReportModel }) {
  const su = model.selfUpdate;
  if (!su) return null;
  const name = model.metrics.fellow.firstName;
  const { activities: a, tracker: t } = su;
  const pending = t.total - t.count;

  return (
    <section className="r-section r-selfup-section" aria-labelledby="self-updates">
      <div className="r-wrap">
        <Reveal className="r-card r-selfup">
          <div className="r-eyebrow" id="self-updates">
            Checkpoint · Self updates
          </div>
          <Row
            label="Activity completion"
            help={`Fellowship activities ${name} has completed, out of ${a.total} in total. These include Masterclasses, decision journals, vlogs, feedback and speaker notes, the Lab project, peer review feedback and onboarding.`}
            m={a}
            averageOf="Activity completion across all fellows"
          >
            {name} has completed{' '}
            <b>
              {a.count} of {a.total}
            </b>{' '}
            activities.
          </Row>
          <Row
            label="Tracker reporting"
            help={`How much of the progress tracker ${name} has filled in, whether the answer is yes or no. Items still marked “Update pending” count as not reported.`}
            m={t}
            averageOf="Tracker reporting across all fellows"
          >
            {name} has filled in{' '}
            <b>
              {t.count} of {t.total}
            </b>{' '}
            items on the tracker.{' '}
            <span>{pending > 0 ? `${pending} ${pending === 1 ? 'is' : 'are'} still awaiting an update.` : 'Every item is up to date.'}</span>
          </Row>
        </Reveal>
      </div>
    </section>
  );
}

function Row({
  label,
  help,
  m,
  averageOf,
  children,
}: {
  label: string;
  help: string;
  m: SelfUpdateMeasure;
  averageOf: string;
  children: ReactNode;
}) {
  const pct = Math.round(m.percent);
  const avg = Math.round(m.cohortAverage);
  return (
    <div className={`r-selfup__row r-selfup--${m.level}`}>
      <div className="r-selfup__label">
        <h3>{label}</h3>
        <p>{help}</p>
      </div>
      <div className="r-selfup__battery" role="img" aria-label={`${pct}%, cohort average ${avg}%`}>
        <div className="r-selfup__shell">
          <div className="r-selfup__fill" style={{ width: `${Math.min(100, m.percent)}%` }} />
          <div className="r-selfup__avg" style={{ left: `${Math.min(100, m.cohortAverage)}%` }}>
            <em>Cohort avg</em>
          </div>
        </div>
        <span className="r-selfup__nub" />
      </div>
      <div className="r-selfup__nums">
        <span className="r-num">
          {pct}
          <small>%</small>
        </span>
        <span className="r-selfup__avgtext">
          <b>Cohort average {avg}%</b>
          {averageOf}
        </span>
      </div>
      <p className="r-selfup__sentence">{children}</p>
    </div>
  );
}
