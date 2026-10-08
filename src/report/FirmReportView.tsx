import type { FirmReportModel } from '../data/repository';
import { CompanyIntro } from './firm/CompanyIntro';
import { SponsoredFellows } from './firm/FellowOverview';
import { FirmCohortPanel, FirmVoices } from './firm/FirmSections';
import { fullName, possessive } from './format';
import { Icon } from './primitives';
import { DemoRibbon, ReportFooter, ReportHeader } from './ReportChrome';
import { ReportClosing } from './ReportClosing';
import { useReportNav } from './ReportNav';

/** The company-level report. One component for every firm. */
export function FirmReportView({ model }: { model: FirmReportModel }) {
  const go = useReportNav();
  const single = model.fellows.length === 1;
  return (
    <div className="r-root">
      <DemoRibbon show={model.isSample} />
      <ReportHeader
        ctx={model}
        sections={[
          { id: 'fellows', label: 'Fellows' },
          { id: 'voices', label: 'Action' },
          { id: 'cohort', label: 'Cohort' },
        ]}
      />
      <main>
        <CompanyIntro model={model} />
        <SponsoredFellows model={model} />
        <FirmVoices model={model} />
        <FirmCohortPanel model={model} />
        <ReportClosing
          title={
            <>
              Thank you for investing in {single ? 'your fellow' : 'your fellows'}.
            </>
          }
          pillars={[
            { title: 'Participation', detail: 'Showing up, week after week, alongside the cohort.' },
            { title: 'Learning', detail: 'Reflections written after every masterclass.' },
            { title: 'Application', detail: 'Commitments to change how the work gets done.' },
          ]}
          actions={model.fellows.map((m) => (
            <button
              key={m.fellow.id}
              type="button"
              className="r-button r-button--ghost"
              onClick={() =>
                go({ firmToken: model.firm.reportToken, fellowToken: m.fellow.reportToken, checkpointId: model.checkpoint.id })
              }
            >
              {possessive(fullName(m.fellow))} report <Icon.Arrow />
            </button>
          ))}
        >
          <p>
            Sponsoring a place in the {model.cohort.programmeName} is an investment in how your firm makes decisions.
            The next progress report follows the next programme checkpoint, with updated attendance, new reflections
            and Capstone Lab results as they are assessed.
          </p>
        </ReportClosing>
      </main>
      <ReportFooter ctx={model} />
    </div>
  );
}
