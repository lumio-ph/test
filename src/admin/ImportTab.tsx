import { useState } from 'react';
import { DEMO } from '../config';
import { useRepository } from '../data/DataProvider';
import { tableSpecs, templateCsv, type ImportIssue, type TableSpec } from '../data/importSpec';
import type { Dataset } from '../data/types';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Pending {
  spec: TableSpec;
  fileName: string;
  csv: string;
  count: number;
  issues: ImportIssue[];
  fatal: boolean;
}

/**
 * Import: the CSV is checked first (nothing changes), then applied on
 * confirmation. Hosted mode saves to the database; demo mode keeps the
 * change in this browser tab only.
 */
export function ImportTab({ data }: { data: Dataset }) {
  const { admin, refresh } = useRepository();
  const [pending, setPending] = useState<Pending | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (spec: TableSpec, file: File | undefined) => {
    if (!file) return;
    const csv = await file.text();
    setApplied(null);
    const r = await admin.importTable(spec, csv, true);
    setPending({ spec, fileName: file.name, csv, count: r.count, issues: r.issues, fatal: Boolean(r.fatal) });
  };

  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await admin.importTable(pending.spec, pending.csv, false);
      const problems = (r.checks ?? []).filter((i) => i.level === 'error').length;
      setApplied(
        `${r.count} ${pending.spec.title.toLowerCase()} rows saved.` +
          (problems ? ` ${problems} data error(s) now flagged on the Data & checks tab.` : ''),
      );
      setPending(null);
      refresh();
    } catch (e) {
      setApplied(`Import failed: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="a-page">
      <h2>Import data</h2>
      <p>
        One CSV per table: save each tab of the data template as CSV and upload it here. Each upload is checked
        before anything changes, and replaces that whole table. Reflections are kept exactly as written.
        {DEMO
          ? ' In this prototype imports live only in this browser tab; reload to return to the demonstration data.'
          : ' Changes are saved and appear in every report straight away.'}
      </p>

      <div className="a-row" style={{ marginBottom: 20 }}>
        <button className="a-btn" onClick={() => tableSpecs.forEach((s) => download(s.file, templateCsv(s, data)))}>
          Download all CSVs
        </button>
        {admin.reset && (
          <button className="a-btn" onClick={() => (admin.reset!(), refresh(), setApplied('Demonstration data restored.'))}>
            Reset to demonstration data
          </button>
        )}
        {applied && <span className="a-tag a-tag--ok">{applied}</span>}
      </div>

      {pending && (
        <div className="a-box" style={{ borderColor: pending.fatal ? '#c8321f' : 'var(--kelly)' }}>
          <h3>
            {pending.fileName} → {pending.spec.title}
          </h3>
          <p>
            {pending.fatal
              ? 'This file cannot be imported.'
              : `${pending.count} rows ready. Applying replaces the current ${pending.spec.title.toLowerCase()} table.`}
          </p>
          {pending.issues.slice(0, 50).map((i, n) => (
            <div key={n} className="a-issue">
              <span className={`a-tag ${pending.fatal ? 'a-tag--error' : 'a-tag--warning'}`}>
                {i.row ? `row ${i.row}` : 'file'}
              </span>
              <span>{i.message}</span>
            </div>
          ))}
          {pending.issues.length > 50 && <p>…and {pending.issues.length - 50} more.</p>}
          <div className="a-row" style={{ marginTop: 14 }}>
            {!pending.fatal && (
              <button className="a-btn a-btn--primary" onClick={apply} disabled={busy}>
                {busy ? 'Saving…' : DEMO ? 'Apply to this session' : 'Save to database'}
              </button>
            )}
            <button className="a-btn" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {tableSpecs.map((spec) => (
        <div key={spec.key} className="a-box">
          <div className="a-row" style={{ justifyContent: 'space-between' }}>
            <h3>
              {spec.title} <span className="r-mono">· {spec.file}</span>
            </h3>
            <span className="r-mono">{(data[spec.key] as unknown[]).length} rows</span>
          </div>
          <p>{spec.description}</p>
          <div className="a-cols">
            {spec.columns.map((c) => (
              <code key={c.name} className={c.required ? 'req' : ''} title={c.help}>
                {c.name}
                {c.required ? '*' : ''}
              </code>
            ))}
          </div>
          <div className="a-row">
            <button className="a-btn" onClick={() => download(spec.file, templateCsv(spec, data))}>
              Download current CSV
            </button>
            <label className="a-btn a-btn--primary" style={{ cursor: 'pointer' }}>
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  onFile(spec, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
