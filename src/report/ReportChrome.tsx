import logo from '../assets/included-vc-logo.png';
import logoInverse from '../assets/included-vc-logo-inverse.png';
import type { ReportContext } from '../data/repository';
import { formatDate, formatMonthYear } from './format';
import { FirmMark, Icon } from './primitives';
import { scrollToSection, useReportNav } from './ReportNav';
import { SignOutLink } from './SignOut';

export function DemoRibbon({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="r-demo" role="note">
      <b>DEMONSTRATION DATA</b> · Every name, reflection and result in this report is sample data for design review.
    </div>
  );
}

export function ReportHeader({
  ctx,
  sections,
  fellowToken,
}: {
  ctx: ReportContext;
  sections: Array<{ id: string; label: string }>;
  fellowToken?: string;
}) {
  const go = useReportNav();
  return (
    <header className="r-header">
      <div className="r-header__bar">
        <img className="r-header__logo" src={logo} alt="Included VC Africa" />
        <div className="r-header__for">
          <span className="r-mono" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)' }}>
            Prepared for
          </span>
          <FirmMark firm={ctx.firm} />
        </div>
        <nav className="r-header__nav" aria-label="Report sections">
          {sections.map((s, i) => (
            <button key={s.id} type="button" onClick={() => scrollToSection(s.id)}>
              {String(i + 1).padStart(2, '0')} {s.label}
            </button>
          ))}
        </nav>
        <div className="r-header__tools">
          <SignOutLink className="r-mono r-signout" />
          {ctx.checkpoints.length > 1 && (
            <label className="r-checkpoint">
              <span className="sr-only">Reporting checkpoint</span>
              <select
                value={ctx.checkpoint.id}
                onChange={(e) =>
                  go({ firmToken: ctx.firm.reportToken, fellowToken, checkpointId: e.target.value })
                }
              >
                {[...ctx.checkpoints].reverse().map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {formatMonthYear(c.reportingDate)}
                    {c.status === 'draft' ? ' (draft)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div className="r-header__stripe" />
    </header>
  );
}

export function ReportFooter({ ctx }: { ctx: ReportContext }) {
  return (
    <footer className="r-footer">
      <div className="r-footer__stripe" />
      <div className="r-footer__inner">
        <img src={logoInverse} alt="Included VC Africa" />
        <div className="r-footer__meta">
          {ctx.cohort.name} · {ctx.checkpoint.title} · Data as at {formatDate(ctx.checkpoint.reportingDate)}
          <br />
          Confidential. Prepared for the leadership of {ctx.firm.name} only.
          {ctx.isSample && (
            <>
              <br />
              <span style={{ color: 'var(--gold)' }}>Demonstration data — not a real report.</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}

export function BackToFirm({ ctx }: { ctx: ReportContext }) {
  const go = useReportNav();
  return (
    <button
      type="button"
      className="r-back"
      onClick={() => go({ firmToken: ctx.firm.reportToken, checkpointId: ctx.checkpoint.id })}
    >
      <Icon.Back /> {ctx.firm.name} · all fellows
    </button>
  );
}
