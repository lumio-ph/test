import type { FellowReportModel } from '../data/repository';
import { CapstoneLab } from './fellow/CapstoneLab';
import { AttendanceSection, FeedbackSection, FellowHero, LearningJourney } from './fellow/FellowSections';
import { fullName, possessive } from './format';
import { Icon } from './primitives';
import { DemoRibbon, ReportFooter, ReportHeader } from './ReportChrome';
import { ReportClosing } from './ReportClosing';
import { useReportNav } from './ReportNav';

/** The individual fellow report. One component for every fellow. */
export function FellowReportView({ model }: { model: FellowReportModel }) {
  const go = useReportNav();
  const m = model.metrics;
  const name = m.fellow.firstName;
  const applied = m.lines.filter((l) => l.whatIllApply).length;

  return (
    <div className="r-root">
      <DemoRibbon show={model.isSample} />
      <ReportHeader
        ctx={model}
        fellowToken={m.fellow.reportToken}
        sections={[
          { id: 'participation', label: 'Participation' },
          { id: 'engagement', label: 'Engagement' },
          { id: 'learning', label: 'Learning' },
          { id: 'capstone', label: 'Capstone' },
        ]}
      />
      <main>
        <FellowHero model={model} />
        <AttendanceSection model={model} />
        <FeedbackSection model={model} />
        <LearningJourney model={model} />
        <CapstoneLab metrics={m} eyebrow="04 · Capstone Lab" />
        <ReportClosing
          title={<>From the room to the work.</>}
          pillars={[
            {
              title: `${m.sessionsAttended} of ${m.sessionsHeld} sessions attended`,
              detail: 'Participation in the weekly masterclasses.',
            },
            {
              title: `${m.feedback.numerator} feedback ${m.feedback.numerator === 1 ? 'form' : 'forms'} submitted`,
              detail: 'Engagement after each session attended.',
            },
            {
              title: `${applied} ${applied === 1 ? 'commitment' : 'commitments'} to apply`,
              detail: `Changes ${name} has committed to making at work.`,
            },
          ]}
          actions={
            <>
              <button
                type="button"
                className="r-button r-button--ghost"
                onClick={() => go({ firmToken: model.firm.reportToken, checkpointId: model.checkpoint.id })}
              >
                {possessive(model.firm.name)} report <Icon.Arrow />
              </button>
              {model.colleagues.map((c) => (
                <button
                  key={c.fellow.id}
                  type="button"
                  className="r-button r-button--ghost"
                  onClick={() =>
                    go({ firmToken: model.firm.reportToken, fellowToken: c.fellow.reportToken, checkpointId: model.checkpoint.id })
                  }
                >
                  {possessive(fullName(c.fellow))} report <Icon.Arrow />
                </button>
              ))}
            </>
          }
        >
          <p>
            The value of the {model.cohort.programmeName} shows up in what happens after each session: in sharper
            questions at investment committee, better-structured deals and clearer memos. {possessive(name)} reflections
            are the best early signal of that change.
          </p>
        </ReportClosing>
      </main>
      <ReportFooter ctx={model} />
    </div>
  );
}
