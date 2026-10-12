import { useState } from 'react';
import { useRepository } from '../data/DataProvider';
import type { Dataset } from '../data/types';
import { FirmMark } from '../report/primitives';

/** Every firm with its logo, fellows and recipients. Logos upload here. */
export function FirmsTab({ data }: { data: Dataset }) {
  const { admin, refresh } = useRepository();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const firms = data.firms.filter((f) => f.reportEnabled !== false);

  const upload = async (firmId: string, name: string, file: File | undefined) => {
    if (!file || !admin.uploadLogo) return;
    if (file.size > 2_000_000) {
      setNotice({ tone: 'error', text: 'That image is over 2 MB. Please use a smaller file (a few hundred KB is plenty).' });
      return;
    }
    setBusy(firmId);
    setNotice(null);
    try {
      await admin.uploadLogo(firmId, file);
      setNotice({ tone: 'ok', text: `Logo updated for ${name}.` });
      refresh();
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (firmId: string, name: string) => {
    if (!admin.removeLogo) return;
    setBusy(firmId);
    await admin.removeLogo(firmId);
    setBusy(null);
    setNotice({ tone: 'ok', text: `Logo removed for ${name}. Its name is shown instead.` });
    refresh();
  };

  return (
    <div className="a-page">
      <h2>Firms & logos</h2>
      <p>
        The {firms.length} firms in your data. Each firm’s logo appears at the top of its reports; firms without one show
        their name instead. Upload a PNG, JPG, SVG or WebP. A wide logo on a transparent or white background looks best.
      </p>
      {notice && (
        <div className="a-box" style={{ borderColor: notice.tone === 'ok' ? 'var(--kelly)' : '#c8321f' }}>
          {notice.text}
        </div>
      )}
      <div className="a-box a-scroll">
        <table className="a-table">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Firm</th>
              <th style={{ textAlign: 'right' }}>Fellows</th>
              <th style={{ textAlign: 'right' }}>Recipients</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {firms.map((f) => {
              const fellows = data.fellows.filter((x) => x.firmId === f.id).length;
              const recipients = data.users.filter((u) => u.firmId === f.id && u.accessStatus !== 'revoked').length;
              return (
                <tr key={f.id}>
                  <td style={{ width: 200 }}>
                    <div className="a-logo">
                      {f.logoUrl ? <FirmMark firm={f} /> : <span className="r-mono">No logo</span>}
                    </div>
                  </td>
                  <td>
                    <b>{f.name}</b>
                    <div className="r-mono" style={{ fontSize: 11 }}>
                      {f.id}
                    </div>
                  </td>
                  <td className="num">{fellows}</td>
                  <td className="num">
                    {recipients === 0 ? <span className="a-tag a-tag--warning">none</span> : recipients}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {admin.uploadLogo ? (
                      <div className="a-row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <label className="a-btn" style={{ cursor: 'pointer' }}>
                          {busy === f.id ? 'Saving…' : f.logoUrl ? 'Replace logo' : 'Upload logo'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            hidden
                            onChange={(e) => {
                              upload(f.id, f.name, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {f.logoUrl && (
                          <button className="a-btn" onClick={() => remove(f.id, f.name)} disabled={busy === f.id}>
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="r-mono">Hosted version only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
