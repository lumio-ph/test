import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/included-vc-logo.png';
import { useQuery } from '../data/DataProvider';
import { fellowMetrics } from '../data/metrics';
import { FellowReportView } from '../report/FellowReportView';
import { FirmReportView } from '../report/FirmReportView';
import { fullName } from '../report/format';
import { ReportNavProvider, reportPath, type ReportTarget } from '../report/ReportNav';
import type { Dataset } from '../data/types';
import type { FellowReportModel, FirmReportModel } from '../data/repository';
import { ImportTab } from './ImportTab';
import { validateDataset } from '../data/validate';

type Tab = 'preview' | 'links' | 'data' | 'import' | 'recipients';
const tabs: Array<[Tab, string]> = [
  ['preview', 'Preview reports'],
  ['links', 'Report links'],
  ['data', 'Data & checks'],
  ['import', 'Import data'],
  ['recipients', 'Recipients'],
];

/**
 * Internal admin. In the prototype anyone with the URL can open it; Phase 3
 * puts it behind admin sign-in (role = 'admin').
 */
export function AdminApp() {
  const [tab, setTab] = useState<Tab>('preview');
  const { data } = useQuery((r) => r.getDataset(), []);
  if (!data) return null;

  return (
    <div className="a-root">
      <header className="a-top">
        <div className="a-top__bar">
          <Link to="/">
            <img src={logo} alt="Included VC Africa" />
          </Link>
          <span className="a-top__title">Progress reports · Admin</span>
          <span className="a-warn">Internal prototype · no sign-in yet · {data.label}</span>
        </div>
        <nav className="a-tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="a-stripe" />
      </header>
      {tab === 'preview' && <PreviewTab data={data} />}
      {tab === 'links' && <LinksTab data={data} />}
      {tab === 'data' && <DataTab data={data} />}
      {tab === 'import' && <ImportTab data={data} />}
      {tab === 'recipients' && <RecipientsTab data={data} />}
    </div>
  );
}

const reportFirms = (d: Dataset) => d.firms.filter((f) => f.reportEnabled !== false);
const firmFellows = (d: Dataset, firmId: string) =>
  d.fellows.filter((f) => f.firmId === firmId);

export const absoluteLink = (t: ReportTarget) =>
  `${window.location.origin}${window.location.pathname}#${reportPath(t)}`;

/* ------------------------------------------------------------------ */

function PreviewTab({ data }: { data: Dataset }) {
  const firms = reportFirms(data);
  const [target, setTarget] = useState<ReportTarget>({ firmToken: firms[0]?.reportToken ?? '' });
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const firm = data.firms.find((f) => f.reportToken === target.firmToken);
  const checkpoints = data.checkpoints
    .filter((c) => c.cohortId === firm?.cohortId && (includeDrafts || c.status === 'published'))
    .sort((a, b) => (a.reportingDate < b.reportingDate ? 1 : -1));

  const go = (t: ReportTarget) => {
    setTarget(t);
    document.getElementById('preview-frame')?.scrollTo({ top: 0 });
  };

  return (
    <div className="a-preview">
      <aside className="a-side">
        <div>
          <span className="a-label">Checkpoint</span>
          <select
            className="a-select"
            value={target.checkpointId ?? ''}
            onChange={(e) => go({ ...target, checkpointId: e.target.value || undefined })}
          >
            <option value="">Latest published</option>
            {checkpoints.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {c.reportingDate}
                {c.status === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8, color: 'var(--ink-600)' }}>
            <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} />
            Allow draft checkpoints in preview
          </label>
        </div>

        <div>
          <span className="a-label">Device</span>
          <div className="a-seg">
            {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
              <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>
                {d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="a-label">Reports</span>
          {firms.map((f) => (
            <div key={f.id} className="a-firm">
              <div className="a-firm__head">{f.name}</div>
              <button
                className="a-pick"
                aria-current={target.firmToken === f.reportToken && !target.fellowToken}
                onClick={() => go({ firmToken: f.reportToken, checkpointId: target.checkpointId })}
              >
                Company report <small>firm</small>
              </button>
              {firmFellows(data, f.id).map((fl) => (
                <button
                  key={fl.id}
                  className="a-pick"
                  aria-current={target.fellowToken === fl.reportToken}
                  onClick={() =>
                    go({ firmToken: f.reportToken, fellowToken: fl.reportToken, checkpointId: target.checkpointId })
                  }
                >
                  {fullName(fl)} <small>fellow</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="a-stage">
        <div className="a-stage__bar">
          <span>Shareable link</span>
          <code>{absoluteLink(target)}</code>
          <a className="a-btn" href={`#${reportPath(target)}`} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
        <div id="preview-frame" className={`a-frame a-frame--${device}`}>
          <ReportNavProvider go={go}>
            <PreviewReport target={target} includeDrafts={includeDrafts} />
          </ReportNavProvider>
        </div>
      </div>
    </div>
  );
}

function PreviewReport({ target, includeDrafts }: { target: ReportTarget; includeDrafts: boolean }) {
  const q = { checkpointId: target.checkpointId, includeDrafts };
  const { data } = useQuery<FirmReportModel | FellowReportModel | null>(
    (r) =>
      target.fellowToken
        ? r.getFellowReport(target.firmToken, target.fellowToken, q)
        : r.getFirmReport(target.firmToken, q),
    [target.firmToken, target.fellowToken, target.checkpointId, includeDrafts],
  );
  if (!data) return <p style={{ padding: 40 }}>Select a report.</p>;
  return 'metrics' in data ? (
    <FellowReportView key={`${target.fellowToken}-${data.checkpoint.id}`} model={data} />
  ) : (
    <FirmReportView key={`${target.firmToken}-${data.checkpoint.id}`} model={data} />
  );
}

/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="a-btn"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        })
      }
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function LinksTab({ data }: { data: Dataset }) {
  return (
    <div className="a-page">
      <h2>Report links</h2>
      <p>
        Each firm has one private company report, and each fellow an individual report reachable only through their
        own firm’s link. Links always open the latest published checkpoint; add <code>?cp=checkpoint-id</code> to pin an
        earlier one. In the prototype a link alone opens the report — Phase 3 adds sign-in for authorised recipients.
      </p>
      {reportFirms(data).map((f) => {
        const rows: Array<[string, string, ReportTarget]> = [
          ['Company report', f.name, { firmToken: f.reportToken }],
          ...firmFellows(data, f.id).map(
            (fl): [string, string, ReportTarget] => ['Fellow report', fullName(fl), { firmToken: f.reportToken, fellowToken: fl.reportToken }],
          ),
        ];
        return (
          <div key={f.id} className="a-box">
            <h3>{f.name}</h3>
            <p>
              {data.users.filter((u) => u.firmId === f.id && u.accessStatus !== 'revoked').length} authorised
              recipient(s)
            </p>
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>For</th>
                    <th>Link</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([kind, who, t]) => (
                    <tr key={who + kind}>
                      <td>{kind}</td>
                      <td>{who}</td>
                      <td className="a-link">{absoluteLink(t)}</td>
                      <td>
                        <div className="a-row" style={{ flexWrap: 'nowrap' }}>
                          <CopyButton text={absoluteLink(t)} />
                          <a className="a-btn" href={`#${reportPath(t)}`} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DataTab({ data }: { data: Dataset }) {
  const issues = useMemo(() => validateDataset(data), [data]);
  const checkpoints = [...data.checkpoints].sort((a, b) => (a.reportingDate < b.reportingDate ? 1 : -1));
  const [cpId, setCpId] = useState(checkpoints[0]?.id);
  const cp = data.checkpoints.find((c) => c.id === cpId);

  return (
    <div className="a-page">
      <h2>Data & checks</h2>
      <p>
        Every figure in the reports is calculated by fixed rules in the data layer (src/data/metrics.ts) — never by
        AI. Review the checks below before sharing a checkpoint.
      </p>
      <div className="a-counts">
        {(
          [
            ['Firms', data.firms.length],
            ['Fellows', data.fellows.length],
            ['Sessions', data.sessions.length],
            ['Attendance rows', data.sessionRecords.length],
            ['Capstone rows', data.capstones.length],
            ['Checkpoints', data.checkpoints.length],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="a-count">
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>

      <div className="a-box">
        <h3>Data checks</h3>
        <p>
          {issues.filter((i) => i.level === 'error').length} errors · {issues.filter((i) => i.level === 'warning').length}{' '}
          warnings
        </p>
        {issues.length === 0 && (
          <div className="a-issue">
            <span className="a-tag a-tag--ok">ok</span> No issues found.
          </div>
        )}
        {issues.map((i, n) => (
          <div key={n} className="a-issue">
            <span className={`a-tag a-tag--${i.level}`}>{i.level}</span>
            <span className="r-mono">{i.area}</span>
            <span>{i.message}</span>
          </div>
        ))}
      </div>

      {cp && (
        <div className="a-box">
          <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3>Calculated metrics</h3>
            <select className="a-select" style={{ width: 'auto' }} value={cpId} onChange={(e) => setCpId(e.target.value)}>
              {checkpoints.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.reportingDate} ({c.status})
                </option>
              ))}
            </select>
          </div>
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Fellow</th>
                  <th>Firm</th>
                  <th style={{ textAlign: 'right' }}>Held</th>
                  <th style={{ textAlign: 'right' }}>Attended</th>
                  <th style={{ textAlign: 'right' }}>Attendance</th>
                  <th style={{ textAlign: 'right' }}>Feedback</th>
                  <th style={{ textAlign: 'right' }}>Feedback %</th>
                  <th>Capstone</th>
                </tr>
              </thead>
              <tbody>
                {data.fellows
                  .filter((f) => f.cohortId === cp.cohortId)
                  .map((f) => {
                    const m = fellowMetrics(data, f, cp);
                    return (
                      <tr key={f.id}>
                        <td>{fullName(f)}</td>
                        <td>{data.firms.find((x) => x.id === f.firmId)?.name}</td>
                        <td className="num">{m.sessionsHeld}</td>
                        <td className="num">{m.sessionsAttended}</td>
                        <td className="num">{m.attendance.percent ?? '—'}%</td>
                        <td className="num">
                          {m.feedback.numerator}/{m.feedback.denominator}
                        </td>
                        <td className="num">{m.feedback.percent === null ? '—' : `${m.feedback.percent}%`}</td>
                        <td>
                          {m.capstone.state.replace(/_/g, ' ')}
                          {m.capstone.state === 'submitted' ? ` · ${m.capstone.assessment.replace(/_/g, ' ')}` : ''}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RecipientsTab({ data }: { data: Dataset }) {
  return (
    <div className="a-page">
      <h2>Authorised recipients</h2>
      <p>
        The people allowed to open each firm’s report. In Phase 3 these become sign-in accounts, and database row
        security limits each person to their own firm’s rows. Update via <code>authorised_users.csv</code> on the
        Import tab.
      </p>
      <div className="a-box a-scroll">
        <table className="a-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Firm</th>
              <th>Role</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id}>
                <td>{u.name ?? '—'}</td>
                <td className="a-link">{u.email}</td>
                <td>{u.firmId ? data.firms.find((f) => f.id === u.firmId)?.name ?? u.firmId : 'All firms (Included VC)'}</td>
                <td>{u.role === 'admin' ? 'Admin' : 'Firm leadership'}</td>
                <td>
                  <span
                    className={`a-tag ${u.accessStatus === 'active' ? 'a-tag--ok' : u.accessStatus === 'revoked' ? 'a-tag--error' : 'a-tag--warning'}`}
                  >
                    {u.accessStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
