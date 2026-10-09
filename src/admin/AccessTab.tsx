import { useEffect, useState } from 'react';
import { DEMO } from '../config';
import type { AuditEntry, OutboxMessage } from '../data/api';
import { useRepository } from '../data/DataProvider';
import type { Dataset } from '../data/types';
import { absoluteLink } from './AdminApp';

const when = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const actionLabel: Record<string, string> = {
  sign_in_code_sent: 'Sign-in code sent',
  sign_in_code_refused: 'Code requested by an unknown email',
  sign_in_failed: 'Wrong code entered',
  signed_in: 'Signed in',
  report_viewed: 'Viewed report',
  report_denied: 'Blocked: tried another firm’s link',
  invitations_sent: 'Report links emailed',
  data_imported: 'Data imported',
  checkpoint_published: 'Checkpoint published',
  checkpoint_draft: 'Checkpoint unpublished',
};

/**
 * How partners get in: publish a checkpoint, email each firm its link,
 * watch sign-ins and views. Hosted mode only.
 */
export function AccessTab({ data }: { data: Dataset }) {
  const { admin, refresh } = useRepository();
  const [outbox, setOutbox] = useState<{ live: boolean; messages: OutboxMessage[] } | null>(null);
  const [auditLog, setAudit] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    admin.outbox?.().then(setOutbox);
    admin.audit?.().then(setAudit);
  }, [admin, tick]);

  if (DEMO || !admin.invite) {
    return (
      <div className="a-page">
        <h2>Send & access</h2>
        <p>
          On the hosted version this is where you publish a checkpoint, email each firm its private link, and see who has
          signed in. This self-contained prototype has no server, so links open without sign-in.
        </p>
      </div>
    );
  }

  const firms = data.firms.filter((f) => f.reportEnabled !== false);
  const checkpoints = [...data.checkpoints].sort((a, b) => (a.reportingDate < b.reportingDate ? 1 : -1));

  const invite = async (firmId: string, name: string) => {
    setNotice(null);
    try {
      const r = await admin.invite!(firmId);
      setNotice(
        r.sent
          ? `Emailed ${r.sent} ${r.sent === 1 ? 'person' : 'people'} at ${name}.${r.failed.length ? ` Failed: ${r.failed.join(', ')}.` : ''}`
          : `${name} has no active recipients. Add them on the Import tab (authorised_users.csv).`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
    setTick((t) => t + 1);
  };

  const toggle = async (id: string, status: 'draft' | 'published') => {
    await admin.setCheckpointStatus!(id, status);
    refresh();
    setTick((t) => t + 1);
  };

  return (
    <div className="a-page">
      <h2>Send & access</h2>
      <p>
        Partners get in with their email address: the link opens a sign-in page, they receive a one-time code, and they see
        only their own firm’s report. Anyone not on a firm’s recipient list gets nothing, even with the link.
      </p>

      {notice && (
        <div className="a-box" style={{ borderColor: 'var(--kelly)' }}>
          {notice}
        </div>
      )}

      <div className="a-box">
        <h3>1 · Publish a checkpoint</h3>
        <p>Firms only see published checkpoints. Drafts are visible in the admin preview only.</p>
        <div className="a-scroll">
          <table className="a-table">
            <tbody>
              {checkpoints.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.title}</b>
                  </td>
                  <td className="r-mono">Data as at {c.reportingDate}</td>
                  <td className="r-mono">{c.sessionIds.length} sessions</td>
                  <td>
                    <span className={`a-tag ${c.status === 'published' ? 'a-tag--ok' : 'a-tag--warning'}`}>{c.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="a-btn" onClick={() => toggle(c.id, c.status === 'published' ? 'draft' : 'published')}>
                      {c.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="a-box">
        <h3>2 · Email each firm its link</h3>
        <p>Sends every active or invited recipient of the firm an email with the private link to the latest published report.</p>
        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Firm</th>
                <th>Recipients</th>
                <th>Private link</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {firms.map((f) => {
                const people = data.users.filter((u) => u.firmId === f.id);
                return (
                  <tr key={f.id}>
                    <td>
                      <b>{f.name}</b>
                    </td>
                    <td>
                      {people.length === 0 && <span className="a-tag a-tag--warning">none</span>}
                      {people.map((u) => (
                        <div key={u.id} className="a-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <span className="a-link">{u.email}</span>
                          <span
                            className={`a-tag ${u.accessStatus === 'active' ? 'a-tag--ok' : u.accessStatus === 'revoked' ? 'a-tag--error' : 'a-tag--warning'}`}
                          >
                            {u.accessStatus}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="a-link">{absoluteLink({ firmToken: f.reportToken })}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="a-btn a-btn--primary" onClick={() => invite(f.id, f.name)}>
                        Email link
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 14, marginBottom: 0 }}>
          To test the partner experience yourself, add your own email as a <code>firm_leader</code> for a firm in{' '}
          <code>authorised_users.csv</code>, import it, then press “Email link”.
        </p>
      </div>

      <div className="a-box">
        <div className="a-row" style={{ justifyContent: 'space-between' }}>
          <h3>Email outbox</h3>
          <button className="a-btn" onClick={() => setTick((t) => t + 1)}>
            Refresh
          </button>
        </div>
        <p>
          {outbox?.live
            ? 'Email is connected. Messages are delivered for real; only the recipient and subject are kept here.'
            : 'Test mode: email is not connected yet, so messages are kept here instead of being sent. Open one to see exactly what a partner would receive.'}
        </p>
        {outbox?.messages.length === 0 && <p className="r-mono">No emails yet.</p>}
        {outbox?.messages.map((m) => (
          <div key={m.id} className="a-issue" style={{ display: 'block' }}>
            <div className="a-row" style={{ justifyContent: 'space-between' }}>
              <span>
                <span className="r-mono">{when(m.created_at)}</span> · <b>{m.to_addr}</b> · {m.subject}
              </span>
              <span className="a-row">
                <span className={`a-tag ${m.status === 'failed' ? 'a-tag--error' : 'a-tag--ok'}`}>
                  {m.status === 'test_outbox' ? 'held (test)' : m.status}
                </span>
                {m.html_body && (
                  <button className="a-btn" onClick={() => setOpen(open === m.id ? null : m.id)}>
                    {open === m.id ? 'Close' : 'Open'}
                  </button>
                )}
              </span>
            </div>
            {open === m.id && m.html_body && (
              <iframe
                title={m.subject}
                sandbox=""
                srcDoc={m.html_body}
                style={{ width: '100%', height: 520, border: '1px solid var(--ink-200)', borderRadius: 8, marginTop: 12, background: '#fff' }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="a-box">
        <h3>Activity</h3>
        <p>Sign-ins, report views, blocked attempts, imports and emails — newest first.</p>
        <div className="a-scroll">
          <table className="a-table">
            <tbody>
              {auditLog.map((a) => (
                <tr key={a.id}>
                  <td className="r-mono" style={{ whiteSpace: 'nowrap' }}>
                    {when(a.at)}
                  </td>
                  <td>
                    <span className={`a-tag ${a.action === 'report_denied' || a.action === 'sign_in_failed' ? 'a-tag--error' : 'a-tag--ok'}`}>
                      {actionLabel[a.action] ?? a.action}
                    </span>
                  </td>
                  <td className="a-link">{a.email ?? (a.action === 'sign_in_code_refused' ? a.detail : '')}</td>
                  <td>{a.action === 'sign_in_code_refused' ? '' : a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
