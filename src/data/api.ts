/**
 * Browser client for the reports server. Report data is fetched per request
 * for the signed-in user; nothing is bundled into the page.
 */
import type { TableSpec } from './importSpec';
import type { FellowReportModel, FirmReportModel, ReportQuery, ReportRepository } from './repository';
import type { Dataset } from './types';
import type { AdminActions, ImportResult, WorkbookImportResult } from './adminActions';

export class AuthRequired extends Error {}
export class Forbidden extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { ...(init.method && init.method !== 'GET' ? { 'x-ivc': '1' } : {}), ...(init.headers ?? {}) },
  });
  if (res.status === 401) throw new AuthRequired();
  if (res.status === 403) throw new Forbidden();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

const qs = (q: ReportQuery = {}) => {
  const p = new URLSearchParams();
  if (q.checkpointId) p.set('cp', q.checkpointId);
  if (q.includeDrafts) p.set('drafts', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
};

export class ApiRepository implements ReportRepository {
  getFirmReport(firmToken: string, q?: ReportQuery) {
    return call<FirmReportModel>(`/api/reports/${encodeURIComponent(firmToken)}${qs(q)}`);
  }
  getFellowReport(firmToken: string, fellowToken: string, q?: ReportQuery) {
    return call<FellowReportModel>(
      `/api/reports/${encodeURIComponent(firmToken)}/${encodeURIComponent(fellowToken)}${qs(q)}`,
    );
  }
  async getDataset() {
    const d = await call<Dataset>('/api/admin/dataset');
    if (!d) throw new Error('No data');
    return d;
  }
}

export interface Me {
  user: { email: string; name: string | null; role: 'firm_leader' | 'admin'; firmName: string | null } | null;
  home?: string;
  mailLive?: boolean;
}

export type SignInError = 'not_authorised' | 'rate_limited' | 'admin_not_configured' | 'invalid_email' | 'failed';

async function signIn(path: string, body: unknown): Promise<{ home: string } | { error: SignInError }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ivc': '1' },
    body: JSON.stringify(body),
  });
  if (res.ok) return (await res.json()) as { home: string };
  const err = ((await res.json().catch(() => ({}))) as { error?: string }).error;
  return { error: (['not_authorised', 'rate_limited', 'admin_not_configured', 'invalid_email'].includes(err ?? '') ? err : 'failed') as SignInError };
}

export const authApi = {
  me: () => call<Me>('/api/me') as Promise<Me>,
  /** Partner: email on the firm link they arrived with. */
  signInEmail: (email: string, firmToken: string) => signIn('/api/auth/email', { email, firmToken }),
  /** Admin: email + admin password. */
  signInAdmin: (email: string, password: string) => signIn('/api/auth/admin', { email, password }),
  signOut: () => fetch('/api/auth/sign-out', { method: 'POST', headers: { 'x-ivc': '1' } }),
};

export interface OutboxMessage {
  id: number;
  created_at: number;
  to_addr: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  status: string;
  error: string | null;
}

export interface AuditEntry {
  id: number;
  at: number;
  email: string | null;
  action: string;
  detail: string | null;
}

export const apiAdminActions: AdminActions = {
  async importTable(spec: TableSpec, csv: string, dryRun: boolean) {
    const r = await call<ImportResult>(`/api/admin/import/${spec.key}${dryRun ? '?dryRun=1' : ''}`, {
      method: 'POST',
      headers: { 'content-type': 'text/csv' },
      body: csv,
    });
    if (!r) throw new Error('Import failed');
    return r;
  },
  async importWorkbook(file: File, dryRun: boolean) {
    const res = await fetch(`/api/admin/import-workbook${dryRun ? '?dryRun=1' : ''}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-ivc': '1' },
      body: file,
    });
    if (res.status === 401) throw new AuthRequired();
    if (!res.ok) throw new Error(res.status === 400 ? 'That file is not a readable .xlsx workbook.' : `Upload failed (${res.status})`);
    return (await res.json()) as WorkbookImportResult;
  },
  async invite(firmId: string) {
    const r = await call<{ sent: number; failed: string[]; link: string }>(`/api/admin/invite/${encodeURIComponent(firmId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!r) throw new Error('This firm has no published report yet.');
    return r;
  },
  async setCheckpointStatus(id: string, status: 'draft' | 'published') {
    await call(`/api/admin/checkpoints/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },
  outbox: () => call<{ live: boolean; messages: OutboxMessage[] }>('/api/admin/outbox') as Promise<{ live: boolean; messages: OutboxMessage[] }>,
  audit: () => call<AuditEntry[]>('/api/admin/audit') as Promise<AuditEntry[]>,
};
