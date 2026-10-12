/**
 * Reads the filled-in data template (.xlsx) so the whole dataset can be
 * uploaded in one go. Each tab is named after its table (firms, fellows, ...)
 * and is validated with exactly the same rules as a CSV upload.
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { importRecords, tableSpecs, type ImportIssue, type TableSpec } from '../src/data/importSpec';

export interface WorkbookTable {
  spec: TableSpec;
  items: unknown[];
  issues: ImportIssue[];
  fatal: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellText((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ('error' in v) return '';
  }
  return String(v);
}

/**
 * Cell notes are not data, and some tools save them in a layout the reader
 * can't follow. Removing the links to them first makes any .xlsx readable.
 */
async function withoutNotes(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const rels = Object.keys(zip.files).filter((f) => /^xl\/worksheets\/_rels\/.+\.rels$/.test(f));
  for (const f of rels) {
    const xml = await zip.file(f)!.async('string');
    const cleaned = xml.replace(/<Relationship\b[^>]*relationships\/(comments|vmlDrawing)"[^>]*\/>/g, '');
    if (cleaned !== xml) zip.file(f, cleaned);
  }
  for (const f of Object.keys(zip.files).filter((f) => /^xl\/worksheets\/[^/]+\.xml$/.test(f))) {
    const xml = await zip.file(f)!.async('string');
    const cleaned = xml.replace(/<legacyDrawing\b[^>]*\/>/g, '');
    if (cleaned !== xml) zip.file(f, cleaned);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function readWorkbook(
  buffer: Buffer,
  existingTokens: Map<string, string> = new Map(),
  existingLogos: Map<string, string> = new Map(),
): Promise<{ tables: WorkbookTable[]; missingTabs: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await withoutNotes(buffer)) as unknown as ArrayBuffer);
  const tables: WorkbookTable[] = [];
  const missingTabs: string[] = [];
  for (const spec of tableSpecs) {
    const tab = spec.file.replace(/\.csv$/, '');
    const ws = wb.getWorksheet(tab);
    if (!ws) {
      missingTabs.push(tab);
      continue;
    }
    const header = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((h) => cellText(h).trim().toLowerCase());
    const records: Array<Record<string, string>> = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const values = (row.values as ExcelJS.CellValue[]).slice(1);
      const rec: Record<string, string> = {};
      header.forEach((h, i) => {
        if (h) rec[h] = cellText(values[i]);
      });
      if (Object.values(rec).some((x) => x.trim() !== '')) records.push(rec);
    });
    tables.push({ spec, ...importRecords(spec, header, records, existingTokens, existingLogos) });
  }
  return { tables, missingTabs };
}
