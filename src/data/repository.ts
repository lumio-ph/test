/**
 * Data access layer.
 *
 * Presentation components never touch raw tables: they receive the report
 * view-models built here. To connect real data, implement `ReportRepository`
 * against the real source (Supabase, Google Sheets export, etc.) and pass it
 * to <DataProvider>. The sample implementation below reads an in-memory
 * `Dataset`.
 */
import {
  cohortBenchmarks,
  fellowMetrics,
  firmSummary,
  type CohortBenchmarks,
  type FirmSummary,
  type FellowMetrics,
} from './metrics';
import type { Checkpoint, Cohort, Dataset, Firm } from './types';

export interface ReportContext {
  cohort: Cohort;
  firm: Firm;
  checkpoint: Checkpoint;
  /** Checkpoints this viewer may switch between, oldest first. */
  checkpoints: Checkpoint[];
  benchmarks: CohortBenchmarks;
  /** Non-cancelled sessions in the whole programme (for "8 of 12" context). */
  programmeSessions: number;
  isSample: boolean;
}

export interface FirmReportModel extends ReportContext {
  fellows: FellowMetrics[];
  summary: FirmSummary;
}

export interface FellowReportModel extends ReportContext {
  metrics: FellowMetrics;
  /** Other fellows from the same firm (for "also sponsored" navigation). */
  colleagues: FellowMetrics[];
}

export interface ReportQuery {
  checkpointId?: string;
  /** Admin preview may see draft checkpoints; leadership links may not. */
  includeDrafts?: boolean;
}

export interface ReportRepository {
  getFirmReport(firmToken: string, q?: ReportQuery): Promise<FirmReportModel | null>;
  getFellowReport(
    firmToken: string,
    fellowToken: string,
    q?: ReportQuery,
  ): Promise<FellowReportModel | null>;
  /** Admin only. */
  getDataset(): Promise<Dataset>;
}

/* ------------------------------------------------------------------ */

export class InMemoryRepository implements ReportRepository {
  constructor(private readonly read: () => Dataset) {}

  private context(firmToken: string, q: ReportQuery = {}): ReportContext | null {
    const data = this.read();
    // Look-up is by opaque token only — never by name or sequential id.
    const firm = data.firms.find((f) => f.reportToken === firmToken);
    if (!firm || firm.reportEnabled === false) return null;
    const cohort = data.cohorts.find((c) => c.id === firm.cohortId);
    if (!cohort) return null;

    const checkpoints = data.checkpoints
      .filter((c) => c.cohortId === cohort.id && (q.includeDrafts || c.status === 'published'))
      .sort((a, b) => (a.reportingDate < b.reportingDate ? -1 : 1));
    if (!checkpoints.length) return null;

    const checkpoint =
      checkpoints.find((c) => c.id === q.checkpointId) ?? checkpoints[checkpoints.length - 1];

    return {
      cohort,
      firm,
      checkpoint,
      checkpoints,
      benchmarks: cohortBenchmarks(data, checkpoint),
      programmeSessions: data.sessions.filter(
        (s) => s.cohortId === cohort.id && s.status !== 'cancelled',
      ).length,
      isSample: data.isSample || Boolean(firm.isSample),
    };
  }

  private firmFellows(ctx: ReportContext): FellowMetrics[] {
    const data = this.read();
    return data.fellows
      .filter((f) => f.firmId === ctx.firm.id && f.cohortId === ctx.cohort.id)
      .map((f) => fellowMetrics(data, f, ctx.checkpoint));
  }

  async getFirmReport(firmToken: string, q?: ReportQuery) {
    const ctx = this.context(firmToken, q);
    if (!ctx) return null;
    const fellows = this.firmFellows(ctx);
    return { ...ctx, fellows, summary: firmSummary(fellows) };
  }

  async getFellowReport(firmToken: string, fellowToken: string, q?: ReportQuery) {
    const ctx = this.context(firmToken, q);
    if (!ctx) return null;
    const fellows = this.firmFellows(ctx);
    // A fellow is only reachable through their own firm's token. Swapping in
    // another firm's fellow token returns "not found", same as a bad token.
    const metrics = fellows.find((m) => m.fellow.reportToken === fellowToken);
    if (!metrics) return null;
    return {
      ...ctx,
      metrics,
      colleagues: fellows.filter((m) => m !== metrics),
    };
  }

  async getDataset() {
    return this.read();
  }
}
