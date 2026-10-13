import { useEffect } from 'react';
import mark from '../assets/africa-mark.png';
import type { FirmReportModel } from '../data/repository';
import { fullName, possessive } from './format';
import { Icon, Monogram, Reveal } from './primitives';
import { DemoRibbon, ReportFooter, ReportHeader } from './ReportChrome';
import { useReportNav } from './ReportNav';

/**
 * What a firm's link opens. Each fellow has their own report: with one
 * fellow the link goes straight to it; with several, leadership picks one.
 */
export function FirmChooser({ model }: { model: FirmReportModel }) {
  const go = useReportNav();
  const only = model.fellows.length === 1 ? model.fellows[0] : null;
  const open = (fellowToken: string, replace = false) =>
    go({ firmToken: model.firm.reportToken, fellowToken, checkpointId: model.checkpoint.id }, { replace });

  // One fellow: go straight to their report. Replacing the history entry
  // keeps the browser's Back button working.
  useEffect(() => {
    if (only) open(only.fellow.reportToken, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only?.fellow.reportToken]);

  if (only) return null;

  return (
    <div className="r-root">
      <DemoRibbon show={model.isSample} />
      <ReportHeader ctx={model} />
      <main>
        <section className="r-hero" aria-labelledby="report-title">
          <img className="r-hero__mark" src={mark} alt="" aria-hidden="true" />
          <div className="r-wrap">
            <Reveal>
              <div className="r-rule" />
              <div className="r-eyebrow" style={{ marginBottom: 32 }}>
                {model.cohort.name}
              </div>
              <h1 id="report-title" className="r-h1 r-hero__title">
                Your <span className="hl-lime">fellows’</span> <span className="hl-gold">reports</span>
              </h1>
              <p className="r-lede r-hero__lede">
                {model.firm.name} sponsors {model.fellows.length} fellows on the {model.cohort.programmeName}. Each has
                their own progress report.
              </p>
            </Reveal>
            <div className="r-choose">
              {model.fellows.length === 0 && <p className="r-body">No fellows are listed for this firm yet.</p>}
              {model.fellows.map((m, i) => (
                <Reveal key={m.fellow.id} className="r-card r-choose__item" delay={i * 70}>
                  <Monogram person={m.fellow} size="lg" />
                  <div className="r-choose__who">
                    <h2 className="r-fellow__name">{fullName(m.fellow)}</h2>
                    {m.fellow.role && <div className="r-fellow__role">{m.fellow.role}</div>}
                    <div className="r-mono" style={{ marginTop: 10 }}>
                      {m.sessionsAttended} of {m.sessionsHeld} sessions attended
                    </div>
                  </div>
                  <button type="button" className="r-button" onClick={() => open(m.fellow.reportToken)}>
                    Open {possessive(m.fellow.firstName)} report <Icon.Arrow />
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <ReportFooter ctx={model} />
    </div>
  );
}
