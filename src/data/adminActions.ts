import type { ImportIssue, TableSpec } from './importSpec';
import type { DataIssue } from './validate';
import type { AuditEntry, OutboxMessage } from './api';

export interface ImportResult {
  applied: boolean;
  fatal?: boolean;
  count: number;
  issues: ImportIssue[];
  checks?: DataIssue[];
}

export interface WorkbookImportResult {
  applied: boolean;
  fatal: boolean;
  tables: Array<{ table: string; title: string; count: number; fatal: boolean; issues: ImportIssue[]; issueCount: number }>;
  missingTabs: string[];
  checks?: DataIssue[];
}

/** Admin operations. Demo mode works in memory; hosted mode calls the server. */
export interface AdminActions {
  importTable(spec: TableSpec, csv: string, dryRun: boolean): Promise<ImportResult>;
  /** Hosted only: the whole data template workbook in one upload. */
  importWorkbook?(file: File, dryRun: boolean): Promise<WorkbookImportResult>;
  /** Demo only: restore the sample data. */
  reset?(): void;
  uploadLogo?(firmId: string, file: File): Promise<void>;
  removeLogo?(firmId: string): Promise<void>;
  invite?(firmId: string): Promise<{ sent: number; failed: string[]; link: string }>;
  setCheckpointStatus?(id: string, status: 'draft' | 'published'): Promise<void>;
  outbox?(): Promise<{ live: boolean; messages: OutboxMessage[] }>;
  audit?(): Promise<AuditEntry[]>;
}
