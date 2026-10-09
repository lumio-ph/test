/**
 * Passwordless sign-in: a 6-digit one-time code emailed to an authorised
 * address. Codes and session tokens are stored only as keyed hashes.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { DB } from './db';
import { audit } from './db';
import type { Mailer } from './mail';
import { signInCodeEmail } from './mail';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_PER_EMAIL = 5;
const RATE_PER_IP = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  firmId: string | null;
  role: 'firm_leader' | 'admin';
}

export class Auth {
  constructor(
    private db: DB,
    private secret: string,
    private mailer: Mailer,
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

  /**
   * Always resolves the same way, whether or not the address is authorised,
   * so the sign-in form can't be used to discover who has access.
   */
  async requestCode(rawEmail: string, ip: string): Promise<{ ok: true } | { ok: false; reason: 'rate_limited' }> {
    const email = rawEmail.trim().toLowerCase();
    if (this.limited(`ip:${ip}`, RATE_PER_IP) || this.limited(`email:${email}`, RATE_PER_EMAIL)) {
      return { ok: false, reason: 'rate_limited' };
    }
    const user = this.db
      .prepare("select id, email, name from users where email = ? and access_status in ('active','invited')")
      .get(email) as { id: string; email: string; name: string | null } | undefined;
    if (!user) {
      audit(this.db, 'sign_in_code_refused', null, email);
      return { ok: true };
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.db
      .prepare(
        'insert into login_codes (email, code_hash, expires_at, attempts) values (?,?,?,0) on conflict(email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0',
      )
      .run(email, this.hash(`${email}:${code}`), Date.now() + CODE_TTL_MS);
    await this.mailer.send(signInCodeEmail(user.email, code, user.name));
    audit(this.db, 'sign_in_code_sent', user);
    return { ok: true };
  }

  verifyCode(rawEmail: string, rawCode: string): { token: string; user: SessionUser } | null {
    const email = rawEmail.trim().toLowerCase();
    const code = rawCode.replace(/\D/g, '');
    const row = this.db.prepare('select * from login_codes where email = ?').get(email) as
      | { code_hash: string; expires_at: number; attempts: number }
      | undefined;
    // Reasons go to the server log (never the code itself) so a failed
    // sign-in can be diagnosed from the host's logs.
    const reject = (reason: string) => {
      console.log(`[sign-in] code rejected for ${email}: ${reason}`);
      return null;
    };
    if (!row) return reject('no active code for this email (never requested, already used, or the server restarted since)');
    if (row.expires_at < Date.now()) return reject('code expired (older than 10 minutes)');
    if (row.attempts >= CODE_MAX_ATTEMPTS) return reject('locked after 5 wrong attempts; request a new code');

    const expected = Buffer.from(row.code_hash, 'hex');
    const given = Buffer.from(this.hash(`${email}:${code}`), 'hex');
    if (code.length !== 6 || !timingSafeEqual(expected, given)) {
      this.db.prepare('update login_codes set attempts = attempts + 1 where email = ?').run(email);
      audit(this.db, 'sign_in_failed', null, email);
      return reject(`wrong code (attempt ${row.attempts + 1} of ${CODE_MAX_ATTEMPTS}); only the newest code works`);
    }

    this.db.prepare('delete from login_codes where email = ?').run(email);
    const user = this.db
      .prepare("select id, email, name, firm_id, role from users where email = ? and access_status in ('active','invited')")
      .get(email) as { id: string; email: string; name: string | null; firm_id: string | null; role: SessionUser['role'] } | undefined;
    if (!user) return reject('email is no longer authorised');
    console.log(`[sign-in] ${email} signed in`);
    this.db.prepare("update users set access_status = 'active' where id = ? and access_status = 'invited'").run(user.id);

    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    this.db
      .prepare('insert into auth_sessions (token_hash, user_id, created_at, expires_at) values (?,?,?,?)')
      .run(this.hash(token), user.id, now, now + SESSION_TTL_MS);
    audit(this.db, 'signed_in', user);
    return { token, user: { id: user.id, email: user.email, name: user.name, firmId: user.firm_id, role: user.role } };
  }

  /** Resolves a session cookie. Revoked users are signed out immediately. */
  userForToken(token: string | undefined): SessionUser | null {
    if (!token) return null;
    const row = this.db
      .prepare(
        `select u.id, u.email, u.name, u.firm_id, u.role from auth_sessions s
         join users u on u.id = s.user_id
         where s.token_hash = ? and s.expires_at > ? and u.access_status = 'active'`,
      )
      .get(this.hash(token), Date.now()) as
      | { id: string; email: string; name: string | null; firm_id: string | null; role: SessionUser['role'] }
      | undefined;
    return row ? { id: row.id, email: row.email, name: row.name, firmId: row.firm_id, role: row.role } : null;
  }

  signOut(token: string | undefined) {
    if (token) this.db.prepare('delete from auth_sessions where token_hash = ?').run(this.hash(token));
  }
}
