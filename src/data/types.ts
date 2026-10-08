/**
 * Source entities — one interface per table/sheet in the data model.
 *
 * These mirror the import format documented in docs/DATA_IMPORT.md and the
 * draft database schema in docs/ARCHITECTURE.md. Nothing in this file is
 * calculated: every derived number lives in src/data/metrics.ts.
 */

export type ISODate = string; // 'YYYY-MM-DD'

export interface Cohort {
  id: string;
  name: string; // e.g. 'Investment Cohort 2026'
  programmeName: string; // e.g. 'Africa Investor Fellowship'
  startDate: ISODate;
  endDate: ISODate;
}

export interface Firm {
  id: string;
  /** Opaque, unguessable identifier used in report URLs. Never the firm name. */
  reportToken: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  cohortId: string;
  /**
   * false = this firm's fellows count towards cohort averages but no report
   * is issued for the firm (e.g. it has not opted in). Defaults to true.
   */
  reportEnabled?: boolean;
  /** Demo/sample records are labelled throughout the UI. */
  isSample?: boolean;
}

export interface Fellow {
  id: string;
  /** Opaque identifier used in the individual report URL. */
  reportToken: string;
  firmId: string;
  cohortId: string;
  firstName: string;
  lastName: string;
  role?: string;
  isSample?: boolean;
}

export type SessionStatus = 'held' | 'scheduled' | 'cancelled';

export interface Session {
  id: string;
  cohortId: string;
  number: number;
  title: string;
  date: ISODate;
  facilitator?: string;
  status: SessionStatus;
}

/** One row per fellow per session. */
export interface SessionRecord {
  fellowId: string;
  sessionId: string;
  attended: boolean;
  feedbackSubmitted: boolean;
  /** Stored exactly as submitted. Never rewritten. */
  whatILearned?: string;
  whatIllApply?: string;
  feedbackSubmittedAt?: ISODate;
}

export type AssessmentStatus = 'not_started' | 'pending' | 'complete';

/**
 * Capstone results are append-only snapshots so that earlier checkpoint
 * reports keep showing what was true at the time they were issued.
 */
export interface CapstoneRecord {
  fellowId: string;
  recordedAt: ISODate;
  submitted: boolean;
  submissionDate?: ISODate;
  submissionDeadline: ISODate;
  /** Explicit override from the source data; otherwise derived from dates. */
  submittedOnTime?: boolean;
  assessmentStatus: AssessmentStatus;
  assessmentScore?: number;
  assessmentMaxScore?: number;
  detailedFeedback?: string;
}

export interface Checkpoint {
  id: string;
  cohortId: string;
  title: string; // e.g. 'Checkpoint 2'
  reportingDate: ISODate;
  /** Explicit list of sessions this report covers. Frozen once published. */
  sessionIds: string[];
  status: 'draft' | 'published';
}

export type UserRole = 'firm_leader' | 'admin';

export interface AuthorisedUser {
  id: string;
  email: string;
  name?: string;
  firmId: string | null; // null for Included VC admins
  role: UserRole;
  accessStatus: 'active' | 'invited' | 'revoked';
}

export interface Dataset {
  label: string;
  isSample: boolean;
  cohorts: Cohort[];
  firms: Firm[];
  fellows: Fellow[];
  sessions: Session[];
  sessionRecords: SessionRecord[];
  capstones: CapstoneRecord[];
  checkpoints: Checkpoint[];
  users: AuthorisedUser[];
}
