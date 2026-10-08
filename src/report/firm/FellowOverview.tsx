import { compare, latestReflection, pointsDifference, type FellowMetrics } from '../../data/metrics';
import type { FirmReportModel } from '../../data/repository';
import { ComparisonBar, comparisonPhrase } from '../CohortComparison';
import { CapstonePill } from '../fellow/CapstoneLab';
import { fullName, pad2, possessive } from '../format';
import { Icon, Monogram, Percent, Reveal, SectionHead } from '../primitives';
import { useReportNav } from '../ReportNav';
import { SessionStrip } from '../SessionStrip';

export function SponsoredFellows({ model }: { model: FirmReportModel }) {
  const single = model.fellows.length === 1;
  return (
    <section id="fellows" className="r-section r-section--paper">
      <div className="r-wrap">
        <SectionHead
          eyebrow="01 · Your sponsored fellows"
          title={single ? 'The person you sponsored, at a glance.' : 'The people you sponsored, at a glance.'}
        >
          <p className="r-body">
            Attendance and feedback are shown against the cohort average. Open a full report for the
            session-by-session learning journey and Capstone Lab.
          </p>
        </SectionHead>
        <div className="r-fellows">
          {model.fellows.map((m, i) => (
            <FellowOverview key={m.fellow.id} model={model} metrics={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

const quoteTones = ['r-quote--kelly', 'r-quote--lime', 'r-quote--gold'];

export function FellowOverview({
  model,
  metrics: m,
  index,
}: {
  model: FirmReportModel;
  metrics: FellowMetrics;
  index: number;
}) {
  const go = useReportNav();
  const { benchmarks } = model;
  const attDiff = pointsDifference(m.attendance.percent, benchmarks.attendancePercent);
  const attPhrase = comparisonPhrase(attDiff, compare(m.attendance.percent, benchmarks.attendancePercent));
  const fbDiff = pointsDifference(m.feedback.percent, benchmarks.feedbackPercent);
  const fbPhrase = comparisonPhrase(fbDiff, compare(m.feedback.percent, benchmarks.feedbackPercent));
  const quote = latestReflection(m);
  const open = () =>
    go({ firmToken: model.firm.reportToken, fellowToken: m.fellow.reportToken, checkpointId: model.checkpoint.id });

  return (
    <Reveal as="article" className="r-card r-fellow" delay={index * 80}>
      <div className="r-fellow__id">
        <Monogram person={m.fellow} size="lg" />
        <div>
          <h3 className="r-fellow__name">{fullName(m.fellow)}</h3>
          {m.fellow.role && <div className="r-fellow__role">{m.fellow.role}</div>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <CapstonePill capstone={m.capstone} />
        </div>
        <div className="r-fellow__cta">
          <button type="button" className="r-button" onClick={open}>
            Read {possessive(m.fellow.firstName)} report <Icon.Arrow />
          </button>
        </div>
      </div>

      <div className="r-fellow__metrics">
        <div>
          <div className="r-metric__top">
            <span className="r-metric__label">Attendance</span>
            <span className="r-metric__value">
              <Percent value={m.attendance.percent} />
            </span>
          </div>
          <ComparisonBar
            value={m.attendance.percent}
            cohort={benchmarks.attendancePercent}
            valueLabel={m.fellow.firstName}
            slim
            showLegend={false}
          />
          <div className="r-metric__sub">
            {m.sessionsAttended} of {m.sessionsHeld} sessions{attPhrase ? ` · ${attPhrase}` : ''}
          </div>
        </div>
        <div>
          <div className="r-metric__top">
            <span className="r-metric__label">Feedback completion</span>
            <span className="r-metric__value">
              <Percent value={m.feedback.percent} />
            </span>
          </div>
          <ComparisonBar
            value={m.feedback.percent}
            cohort={benchmarks.feedbackPercent}
            valueLabel={m.fellow.firstName}
            tone="lime"
            slim
            showLegend={false}
          />
          <div className="r-metric__sub">
            {m.feedback.denominator === 0
              ? 'No feedback opportunities yet'
              : `${m.feedback.numerator} of ${m.feedback.denominator} after sessions attended${fbPhrase ? ` · ${fbPhrase}` : ''}`}
          </div>
        </div>
        <div>
          <div className="r-metric__label" style={{ marginBottom: 12 }}>
            Session by session
          </div>
          <SessionStrip lines={m.lines} size="sm" programmeTotal={model.programmeSessions} />
        </div>
      </div>

      <div className="r-fellow__quote">
        {quote?.whatIllApply || quote?.whatILearned ? (
          <div className={`r-quote ${quoteTones[index % quoteTones.length]}`}>
            <div className="r-quote__kicker">{quote.whatIllApply ? "What I'll apply" : 'What I learned'}</div>
            <div className="r-quote__mark">“</div>
            <p className="r-quote__text">{quote.whatIllApply ?? quote.whatILearned}</p>
            <div className="r-quote__source">
              {m.fellow.firstName}, after Session {pad2(quote.session.number)} · {quote.session.title}
            </div>
          </div>
        ) : (
          <div className="r-empty">No written reflections have been submitted yet.</div>
        )}
      </div>
    </Reveal>
  );
}
