/**
 * Production entry point.
 *
 * Environment:
 *   PORT              default 8787
 *   DATABASE_PATH     SQLite file, default ./data/reports.db (use a persistent disk)
 *   PUBLIC_URL        the address partners use, e.g. https://reports.included.vc
 *   SESSION_SECRET    long random string (required in production)
 *   ADMIN_EMAILS      comma-separated Included VC admin emails
 *   SMTP_URL          e.g. smtps://user:pass@smtp.postmarkapp.com:465 — omit to keep mail in the test outbox
 *   MAIL_FROM         e.g. "Included VC Africa <reports@included.vc>"
 *   SEED_DEMO         "1" to load the demonstration data into an empty database (default 1)
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { sampleDataset } from '../src/data/sample/sampleDataset';
import { createApp } from './app';
import { ensureAdmins, isEmpty, openDb, seedDataset } from './db';
import { createMailer } from './mail';

const env = process.env;
const production = env.NODE_ENV === 'production';
const port = Number(env.PORT ?? 8787);
const dbPath = env.DATABASE_PATH ?? path.resolve('data/reports.db');
const secret = env.SESSION_SECRET ?? (production ? '' : 'dev-only-secret-change-me');
if (!secret || secret.length < 32) {
  if (production) throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters');
}

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = openDb(dbPath);
if (isEmpty(db) && (env.SEED_DEMO ?? '1') === '1') {
  seedDataset(db, sampleDataset);
  console.log('Loaded demonstration data into an empty database.');
}
const adminEmails = (env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
ensureAdmins(db, adminEmails);

const mailer = createMailer(db, {
  smtpUrl: env.SMTP_URL,
  from: env.MAIL_FROM ?? 'Included VC Africa <reports@example.com>',
});

const app = createApp({
  db,
  mailer,
  secret,
  baseUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  adminEmails,
  staticDir: path.resolve(env.STATIC_DIR ?? 'dist'),
  secureCookies: production,
});

app.listen(port, () => {
  console.log(`Reports server on :${port} · database ${dbPath} · email ${mailer.live ? 'SMTP' : 'test outbox'}`);
  if (!adminEmails.length) console.log('No ADMIN_EMAILS set — demo admin is programme@included.vc.demo');
});
