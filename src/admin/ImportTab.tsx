import { useState } from 'react';
import { importCsv, tableSpecs, templateCsv, type ImportIssue, type TableSpec } from '../data/importSpec';
import { datasetStore } from '../data/store';
import type { Dataset } from '../data/types';
import { validateDataset } from '../data/validate';

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
  items: unknown[];
  issues: ImportIssue[];
  fatal: boolean;
}

/**
 * Prototype import: parse and validate a CSV in the browser, then swap it
 * into this browser session so every report updates immediately.
 * Nothing is saved — Phase 2 writes to the real database instead.
 */
export function ImportTab({ data }: { data: Dataset }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const onFile = async (spec: TableSpec, file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setApplied(null);
    setPending({ spec, fileName: file.name, ...importCsv(spec, text) });
  };

  const apply = () => {
    if (!pending) return;
    const next: Dataset = {
      ...data,
      label: 'Imported data (this browser session only)',
      [pending.spec.key]: pending.items,
    };
    datasetStore.replace(next);
    const problems = validateDataset(next).filter((i) => i.level === 'error').length;
    setApplied(
      `${pending.items.length} ${pending.spec.title.toLowerCase()} rows applied.` +
        (problems ? ` ${problems} data error(s) now flagged on the Data & checks tab.` : ''),
    );
    setPending(null);
  };

  return (
    <div className="a-page">
      <h2>Import data</h2>
      <p>
        One CSV per table, exported from Google Sheets, Airtable or a database. Download the current file to use as a
        template, edit it, and upload it back. Reflections are kept exactly as written. In this prototype imports live
        only in this browser tab; reload to return to the demonstration data.
      </p>

      <div className="a-row" style={{ marginBottom: 20 }}>
        <button className="a-btn" onClick={() => tableSpecs.forEach((s) => download(s.file, templateCsv(s, data)))}>
          Download all CSVs
        </button>
        <button className="a-btn" onClick={() => (datasetStore.reset(), setApplied('Demonstration data restored.'))}>
          Reset to demonstration data
        </button>
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
              : `${pending.items.length} rows ready. Applying replaces the current ${pending.spec.title.toLowerCase()} table.`}
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
              <button className="a-btn a-btn--primary" onClick={apply}>
                Apply to this session
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
