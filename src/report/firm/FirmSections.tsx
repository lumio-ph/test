import type { FirmReportModel } from '../../data/repository';
import { ComparisonBar } from '../CohortComparison';
import { fullName, pad2 } from '../format';
import { Monogram, Reveal, SectionHead } from '../primitives';

const cardTones = ['', 'r-applycard--lime', 'r-applycard--gold'];

/**
 * "What your fellows say they will apply" — the fellows' own words, most
 * recent first. Responses are shown exactly as submitted.
 */
export function FirmVoices({ model, limit = 3 }: { model: FirmReportModel; limit?: number }) {
  const withWords = model.fellows.filter((m) => m.lines.some((l) => l.whatIllApply));
  if (!withWords.length) return null;
  const single = model.fellows.length === 1;

  return (
    <section id="voices" className="r-section">
      <div className="r-wrap">
        <SectionHead
          eyebrow="02 · From learning to action"
          title={single ? 'What your fellow says they will now do differently.' : 'What your fellows say they will now do differently.'}
        >
          <p className="r-body">
            After every masterclass, fellows are asked what they will apply at work. These are their most recent
            answers, <strong>unedited and in their own words</strong>.
          </p>
        </SectionHead>

        <div className="r-voices">
          {withWords.map((m) => {
            const recent = m.lines
              .filter((l) => l.whatIllApply)
              .slice(-limit)
              .reverse();
            return (
              <div key={m.fellow.id} className="r-voice">
                <Reveal className="r-voice__who">
                  <Monogram person={m.fellow} />
                  <div>
                    <div className="r-h3">{fullName(m.fellow)}</div>
                    <div className="r-mono" style={{ marginTop: 6 }}>
                      {m.lines.filter((l) => l.whatIllApply).length} of {m.sessionsAttended} sessions with an
                      application shared
                    </div>
                  </div>
                </Reveal>
                <div className="r-voice__list">
                  {recent.map((l, i) => (
                    <Reveal key={l.session.id} className={`r-applycard ${cardTones[i % cardTones.length]}`} delay={i * 70}>
                      <span className="r-applycard__mark" aria-hidden="true">
                        “
                      </span>
                      <p className="r-applycard__text">{l.whatIllApply}</p>
                      <div className="r-applycard__src">
                        Session {pad2(l.session.number)} · {l.session.title}
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FirmCohortPanel({ model }: { model: FirmReportModel }) {
  const { benchmarks, fellows, summary } = model;
  return (
    <section id="cohort" className="r-section r-section--paper">
      <div className="r-wrap">
        <Reveal className="r-dark">
          <div className="r-dark__intro">
            <div className="r-rule" />
            <div className="r-eyebrow" style={{ color: 'var(--lime)', marginBottom: 16 }}>
              03 · In context
            </div>
            <h2 className="r-h2">How your {fellows.length === 1 ? 'fellow compares' : 'fellows compare'} with the cohort.</h2>
            <p className="r-body">
              Attendance shows who is in the room. Feedback completion shows who engages afterwards, measured only
              against the sessions each fellow attended.
            </p>
            <div className="r-dark__big">
              <div>
                <div className="r-num">{benchmarks.attendancePercent ?? '—'}%</div>
                <p>cohort average attendance</p>
              </div>
              <div>
                <div className="r-num r-num--gold">{benchmarks.feedbackPercent ?? '—'}%</div>
                <p>cohort average feedback completion</p>
              </div>
            </div>
            <p className="r-mono" style={{ marginTop: 32 }}>
              Across {benchmarks.fellowsCounted} fellows and {benchmarks.sessionsHeld} sessions.
            </p>
          </div>

          <div className="r-dark__body">
            {fellows.map((m) => (
              <div key={m.fellow.id}>
                <div className="r-dark__row-title">
                  <h4>{fullName(m.fellow)}</h4>
                </div>
                <div className="r-dark__pairs">
                  <div>
                    <div className="r-dark__pair-label">
                      <span>Attendance</span>
                      <b>{m.attendance.percent ?? '—'}%</b>
                    </div>
                    <ComparisonBar
                      value={m.attendance.percent}
                      cohort={benchmarks.attendancePercent}
                      slim
                      showLegend={false}
                      valueLabel={m.fellow.firstName}
                    />
                  </div>
                  <div>
                    <div className="r-dark__pair-label">
                      <span>Feedback completion</span>
                      <b>{m.feedback.percent === null ? '—' : `${m.feedback.percent}%`}</b>
                    </div>
                    <ComparisonBar
                      value={m.feedback.percent}
                      cohort={benchmarks.feedbackPercent}
                      tone="lime"
                      slim
                      showLegend={false}
                      valueLabel={m.fellow.firstName}
                    />
                  </div>
                </div>
              </div>
            ))}
            {fellows.length > 1 && (
              <div>
                <div className="r-dark__row-title">
                  <h4 style={{ color: 'var(--gold)' }}>{model.firm.name} combined</h4>
                </div>
                <div className="r-dark__pair-label">
                  <span>Attendance</span>
                  <b>{summary.attendance.percent ?? '—'}%</b>
                </div>
                <ComparisonBar
                  value={summary.attendance.percent}
                  cohort={benchmarks.attendancePercent}
                  slim
                  showLegend={false}
                />
              </div>
            )}
            <div className="r-compare__legend" style={{ marginTop: 0 }}>
              <span className="r-key">
                <span className="r-key__swatch" /> Your {fellows.length === 1 ? 'fellow' : 'fellows'}
              </span>
              <span className="r-key">
                <span className="r-key__marker" /> Cohort average
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
