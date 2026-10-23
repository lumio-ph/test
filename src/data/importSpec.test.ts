import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { importCsv, tableSpecs, templateCsv } from './importSpec';
import { sampleDataset } from './sample/sampleDataset';
import { validateDataset } from './validate';

const spec = (key: string) => tableSpecs.find((s) => s.key === key)!;

describe('CSV import', () => {
  it('round-trips attendance and reflections verbatim', () => {
    const s = spec('sessionRecords');
    const { items, issues, fatal } = importCsv(s, templateCsv(s, sampleDataset));
    expect(fatal).toBe(false);
    expect(issues).toEqual([]);
    expect(items).toEqual(
      sampleDataset.sessionRecords.map((r) => ({
        ...r,
        whatILearned: r.whatILearned || undefined,
        whatIllApply: r.whatIllApply || undefined,
      })),
    );
  });

  it('keeps quotes, commas, line breaks and surrounding spaces in reflections', () => {
    const text =
      'fellow_id,session_id,attended,feedback_submitted,what_i_learned,what_ill_apply\n' +
      'f1,s1,Yes,yes,"  He said ""no"", then\nyes.  ",plain\n';
    const { items } = importCsv(spec('sessionRecords'), text);
    expect((items[0] as { whatILearned: string }).whatILearned).toBe('  He said "no", then\nyes.  ');
  });

  it('rejects files missing required columns', () => {
    const r = importCsv(spec('fellows'), 'fellow_id,first_name\nx,y\n');
    expect(r.fatal).toBe(true);
  });

  it('flags bad values row by row', () => {
    const r = importCsv(
      spec('sessions'),
      'session_id,cohort_id,session_number,session_title,session_date\ns1,c,one,Title,17/08/2026\n',
    );
    expect(r.issues.map((i) => i.row)).toEqual([1, 1]);
  });

  it('imports checkpoint self updates and rejects impossible figures', () => {
    const s = spec('selfUpdates');
    const ok = importCsv(s, templateCsv(s, sampleDataset));
    expect(ok.issues).toEqual([]);
    expect(ok.items).toEqual(sampleDataset.selfUpdates);
    const bad = importCsv(
      s,
      'fellow_id,checkpoint_id,activities_completed,tracker_filled_in,total_activities\n' +
        'f1,cp,40,30,34\nf2,cp,,30,34\nf3,cp,21,23,34\n',
    );
    expect(bad.items).toHaveLength(1);
    expect(bad.issues.map((i) => i.row)).toEqual([1, 2]);
  });

  it('parses CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('sample data', () => {
  it('passes every data check', () => {
    expect(validateDataset(sampleDataset).filter((i) => i.level === 'error')).toEqual([]);
  });
});
