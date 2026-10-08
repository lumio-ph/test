import mark from '../../assets/africa-mark.png';
import type { FirmReportModel } from '../../data/repository';
import { formatDate, formatMonthYear, fullName, joinNames, numberWord, plural } from '../format';
import { FirmMark, Percent, Reveal } from '../primitives';

export function CompanyIntro({ model }: { model: FirmReportModel }) {
  const { cohort, firm, checkpoint, fellows, summary, benchmarks, programmeSessions } = model;
  const single = fellows.length === 1;
  const only = fellows[0];
  const firstHeld = fellows[0]?.lines.find((l) => l.outcome !== 'upcoming')?.session.date;

  return (
    <section className="r-hero" aria-labelledby="report-title">
      <img className="r-hero__mark" src={mark} alt="" aria-hidden="true" />
      <div className="r-wrap">
        <Reveal>
          <div className="r-rule" />
          <div className="r-hero__meta">
            <span className="r-eyebrow">
              {cohort.name} · Progress report for {firm.name} · {checkpoint.title} · {formatMonthYear(checkpoint.reportingDate)}
            </span>
          </div>

          <div className="r-prepared">
            <div className="r-prepared__logo">
              <FirmMark firm={firm} />
            </div>
            <span className="r-mono">
              Private report for the leadership of {firm.name}
              <br />
              Data as at {formatDate(checkpoint.reportingDate)}
            </span>
          </div>

          <h1 id="report-title" className="r-h1 r-hero__title">
            Your <span className="hl-lime">{single ? "Fellow's" : "Fellows'"}</span>{' '}
            <span className="hl-gold">Progress</span>
          </h1>
          <p className="r-lede r-hero__lede">
            A closer look at how your {single ? 'team member is' : 'team members are'} showing up, engaging, and
            putting their learning into practice throughout the {cohort.programmeName}.
          </p>
        </Reveal>

        <div className="r-stats">
          <Reveal className="r-stats__lead">
            <div className="r-eyebrow r-eyebrow--gold">Attendance so far</div>
            <div className="r-big">
              <Percent value={summary.attendance.percent} />
            </div>
            <div>
              <div className="r-stats__lead-rule" />
              <p>
                {single ? (
                  <>
                    of sessions attended by <strong>{only.fellow.firstName}</strong>
                  </>
                ) : (
                  <>
                    of sessions attended by <strong>your {numberWord(fellows.length)} fellows</strong> combined
                  </>
                )}
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
            <div className="r-num">{fellows.length}</div>
            <div className="r-stat__label">
              <strong>{fellows.length === 1 ? 'Fellow sponsored' : 'Fellows sponsored'}</strong>
              {joinNames(fellows.map((m) => fullName(m.fellow)))}
            </div>
          </Reveal>

          <Reveal className="r-card r-stat" delay={120}>
            <div className="r-num">
              {benchmarks.sessionsHeld}
              {programmeSessions > 0 && <span className="r-of">/ {programmeSessions}</span>}
            </div>
            <div className="r-stat__label">
              <strong>Masterclasses held</strong>
              {firstHeld ? `Weekly since ${formatDate(firstHeld).replace(/ \d{4}$/, '')}` : 'Programme sessions to date'}
            </div>
          </Reveal>

          <Reveal className="r-card r-stat r-stat--gold" delay={60}>
            <div className="r-num">
              <Percent value={summary.feedback.percent} />
            </div>
            <div className="r-stat__label">
              <strong>Feedback completion</strong>
              {summary.feedback.numerator} of {summary.feedback.denominator} feedback{' '}
              {plural(summary.feedback.denominator, 'form')} after sessions attended
            </div>
          </Reveal>

          <Reveal className="r-card r-stat" delay={120}>
            <div className="r-num">
              {summary.capstonesSubmitted}
              <span className="r-of">/ {fellows.length}</span>
            </div>
            <div className="r-stat__label">
              <strong>Capstone Labs submitted</strong>
              {capstoneLine(model)}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function capstoneLine({ summary, fellows }: FirmReportModel) {
  const parts: string[] = [];
  if (summary.capstonesAssessed) parts.push(`${summary.capstonesAssessed} assessed`);
  if (summary.capstonesPending) parts.push(`${summary.capstonesPending} assessment pending`);
  const notYet = fellows.length - summary.capstonesSubmitted;
  if (notYet) parts.push(`${notYet} not yet submitted`);
  return parts.join(' · ') || 'Not yet open';
}
