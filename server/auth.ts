/**
 * Sign-in.
 *
 *  - Partners (firm leaders): open their firm's private link and enter their
 *    email. Access needs BOTH the link and an email on that firm's recipient
 *    list. No code, no password.
 *  - Admins: email + the ADMIN_PASSWORD set on the server, because an admin
 *    sees every firm's data.
 *
 * Session tokens are stored only as keyed hashes. Attempts are rate-limited
 * and logged (reasons go to the server log, never passwords).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DB } from './db';
import { audit } from './db';

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  firmId: string | null;
  role: 'firm_leader' | 'admin';
}

type UserRow = { id: string; email: string; name: string | null; firm_id: string | null; role: SessionUser['role'] };

export type SignInResult =
  | { ok: true; token: string; user: SessionUser }
  | { ok: false; reason: 'rate_limited' | 'not_authorised' | 'admin_not_configured' };

export class Auth {
  constructor(
    private db: DB,
    private secret: string,
    private adminPassword: string | undefined,
  ) {}

  private hash(value: string) {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }

  private limited(key: string, max: number) {
    const now = Date.now();
    this.db.prepare('delete from rate_events where at < ?').run(now - RATE_WINDOW_MS);
    const { c } = this.db.prepare('select count(*) as c from rate_events where key = ?').get(key) as { c: number };
    if (c >= max) return true;
    this.db.prepare('insert into rate_events (key, at) values (?, ?)').run(key, now);
    return false;
  }

  private startSession(user: UserRow): SignInResult {
    this.db.prepare("update users set access_status = 'active' where id = ? and access_status = 'invited'").run(user.id);
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    this.db
      .prepare('insert into auth_sessions (token_hash, user_id, created_at, expires_at) values (?,?,?,?)')
      .run(this.hash(token), user.email, now, now + SESSION_TTL_MS); // keyed by email: see db.ts
    audit(this.db, 'signed_in', user);
    console.log(`[sign-in] ${user.email} signed in (${user.role})`);
    return {
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, firmId: user.firm_id, role: user.role },
    };
  }

  /** Partner sign-in: their firm's link + an email on that firm's list. */
  signInWithEmail(rawEmail: string, firmToken: string, ip: string): SignInResult {
    const email = rawEmail.trim().toLowerCase();
    if (this.limited(`ip:${ip}`, 30) || this.limited(`firm:${firmToken}`, 60)) {
      console.log(`[sign-in] rate limited (${email})`);
      return { ok: false, reason: 'rate_limited' };
    }
    const user = this.db
      .prepare(
        `select u.id, u.email, u.name, u.firm_id, u.role from users u
         join firms f on f.id = u.firm_id
         where u.email = ? and f.report_token = ? and f.report_enabled = 1
           and u.role = 'firm_leader' and u.access_status in ('active','invited')`,
      )
      .get(email, firmToken) as UserRow | undefined;
    if (!user) {
      audit(this.db, 'sign_in_refused', null, email);
      console.log(`[sign-in] refused ${email}: not on the recipient list for this report link`);
      return { ok: false, reason: 'not_authorised' };
    }
    return this.startSession(user);
  }

  /** Admin sign-in: an admin email + ADMIN_PASSWORD. */
  signInAdmin(rawEmail: string, password: string, ip: string): SignInResult {
    const email = rawEmail.trim().toLowerCase();
    if (!this.adminPassword) {
      console.log('[sign-in] admin sign-in refused: ADMIN_PASSWORD is not set on the server');
      return { ok: false, reason: 'admin_not_configured' };
    }
    if (this.limited(`admin-ip:${ip}`, 10) || this.limited(`admin:${email}`, 10)) {
      console.log(`[sign-in] admin rate limited (${email})`);
      return { ok: false, reason: 'rate_limited' };
    }
    const user = this.db
      .prepare("select id, email, name, firm_id, role from users where email = ? and role = 'admin' and access_status = 'active'")
      .get(email) as UserRow | undefined;
    const ok = timingSafeEqual(Buffer.from(this.hash(`pw:${password}`), 'hex'), Buffer.from(this.hash(`pw:${this.adminPassword}`), 'hex'));
    if (!user || !ok) {
      audit(this.db, 'sign_in_failed', null, email);
      console.log(`[sign-in] admin refused ${email}: ${!user ? 'not an admin email' : 'wrong password'}`);
      return { ok: false, reason: 'not_authorised' };
    }
    return this.startSession(user);
  }

  /** Resolves a session cookie. Revoked users are signed out immediately. */
  userForToken(token: string | undefined): SessionUser | null {
    if (!token) return null;
    const row = this.db
      .prepare(
        `select u.id, u.email, u.name, u.firm_id, u.role from auth_sessions s
         join users u on u.email = s.user_id
         where s.token_hash = ? and s.expires_at > ? and u.access_status = 'active'`,
      )
      .get(this.hash(token), Date.now()) as UserRow | undefined;
    return row ? { id: row.id, email: row.email, name: row.name, firmId: row.firm_id, role: row.role } : null;
  }

  signOut(token: string | undefined) {
    if (token) this.db.prepare('delete from auth_sessions where token_hash = ?').run(this.hash(token));
  }
}
