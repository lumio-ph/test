/** Minimal RFC 4180 CSV reader/writer (quoted fields, embedded commas/newlines). */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const needsQuotes = /[",\r\n]/;
export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return needsQuotes.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Rows as objects keyed by (lower-cased, trimmed) header names. */
export function csvObjects(text: string): { header: string[]; records: Array<Record<string, string>> } {
  const [head = [], ...body] = parseCsv(text);
  const header = head.map((h) => h.trim().toLowerCase());
  return {
    header,
    records: body.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim() === '' ? '' : r[i]]))),
  };
}
