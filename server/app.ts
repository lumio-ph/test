/**
 * HTTP API + static hosting.
 *
 * Access rules (enforced here, on the server, for every request):
 *  - No report data without a signed-in, active user.
 *  - A firm leader can open only their own firm's report and fellows. Any
 *    other token — wrong firm, unknown, disabled — gets the same 404.
 *  - Leaders see published checkpoints only; drafts are admin-only.
 *  - Report responses contain the firm's own fellows plus cohort averages,
 *    never another firm's rows.
 *  - Admin routes require role = admin.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { importCsv, tableSpecs } from '../src/data/importSpec';
import { InMemoryRepository } from '../src/data/repository';
import { validateDataset } from '../src/data/validate';
import { Auth, type SessionUser } from './auth';
import { audit, ensureAdmins, loadDataset, replaceTable, setMeta, tx, type DB } from './db';
import { reportInvitationEmail, type Mailer } from './mail';

export interface AppOptions {
  db: DB;
  mailer: Mailer;
  secret: string;
  baseUrl: string; // e.g. https://reports.included.vc
  adminEmails: string[];
  staticDir?: string;
  secureCookies: boolean;
}

const COOKIE = 'ivc_session';

declare module 'express-serve-static-core' {
  interface Request {
    user: SessionUser | null;
    sessionToken?: string;
  }
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function createApp(opts: AppOptions) {
  const { db, mailer } = opts;
  const auth = new Auth(db, opts.secret, mailer);
  const repo = new InMemoryRepository(() => loadDataset(db));
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer'); // report links carry tokens
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    if (opts.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.use((req, _res, next) => {
    req.sessionToken = readCookie(req, COOKIE);
    req.user = auth.userForToken(req.sessionToken);
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use(express.text({ type: 'text/csv', limit: '20mb' }));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Cross-site request protection: browsers can't add this header cross-origin
  // without a CORS preflight, which this API never grants.
  api.use((req, res, next) => {
    if (req.method !== 'GET' && req.get('x-ivc') !== '1') return res.status(403).json({ error: 'forbidden' });
    next();
  });

  const requireUser = (req: Request, res: Response, next: NextFunction) =>
    req.user ? next() : res.status(401).json({ error: 'sign_in_required' });
  const requireAdmin = (req: Request, res: Response, next: NextFunction) =>
    !req.user ? res.status(401).json({ error: 'sign_in_required' }) : req.user.role !== 'admin' ? res.status(403).json({ error: 'forbidden' }) : next();

  /* ---------- auth ---------- */

  api.post('/auth/request-code', async (req, res) => {
    const email = String(req.body?.email ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return res.status(400).json({ error: 'invalid_email' });
    try {
      const r = await auth.requestCode(email, req.ip ?? 'unknown');
      if (!r.ok) return res.status(429).json({ error: 'rate_limited' });
      res.json({ ok: true });
    } catch {
      res.status(502).json({ error: 'email_failed' });
    }
  });

  api.post('/auth/verify', (req, res) => {
    const r = auth.verifyCode(String(req.body?.email ?? ''), String(req.body?.code ?? ''));
    if (!r) return res.status(400).json({ error: 'invalid_code' });
    res.cookie(COOKIE, r.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      maxAge: 14 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ ok: true, home: homeFor(r.user) });
  });

  api.post('/auth/sign-out', (req, res) => {
    auth.signOut(req.sessionToken);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  function homeFor(user: SessionUser) {
    if (user.role === 'admin') return '/admin';
    const firm = db.prepare('select report_token from firms where id = ? and report_enabled = 1').get(user.firmId) as
      | { report_token: string }
      | undefined;
    return firm ? `/r/${firm.report_token}` : '/no-report';
  }

  api.get('/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    const firm = req.user.firmId
      ? (db.prepare('select name from firms where id = ?').get(req.user.firmId) as { name: string } | undefined)
      : undefined;
    res.json({
      user: { email: req.user.email, name: req.user.name, role: req.user.role, firmName: firm?.name ?? null },
      home: homeFor(req.user),
      mailLive: mailer.live,
    });
  });

  /* ---------- reports ---------- */

  /** True when this user may open the firm behind this token. */
  function mayOpen(user: SessionUser, firmToken: string) {
    if (user.role === 'admin') return true;
    const firm = db.prepare('select id from firms where report_token = ?').get(firmToken) as { id: string } | undefined;
    return Boolean(firm && firm.id === user.firmId);
  }

  const reportQuery = (req: Request) => ({
    checkpointId: typeof req.query.cp === 'string' ? req.query.cp : undefined,
    includeDrafts: req.user?.role === 'admin' && req.query.drafts === '1',
  });

  api.get('/reports/:firmToken', requireUser, async (req, res) => {
    const user = req.user!;
    if (!mayOpen(user, req.params.firmToken)) {
      audit(db, 'report_denied', user, req.params.firmToken);
      return res.status(404).json({ error: 'not_found' });
    }
    const model = await repo.getFirmReport(req.params.firmToken, reportQuery(req));
    if (!model) return res.status(404).json({ error: 'not_found' });
    audit(db, 'report_viewed', user, `${model.firm.name} · ${model.checkpoint.title}`);
    res.json(model);
  });

  api.get('/reports/:firmToken/:fellowToken', requireUser, async (req, res) => {
    const user = req.user!;
    if (!mayOpen(user, req.params.firmToken)) {
      audit(db, 'report_denied', user, `${req.params.firmToken}/${req.params.fellowToken}`);
      return res.status(404).json({ error: 'not_found' });
    }
    const model = await repo.getFellowReport(req.params.firmToken, req.params.fellowToken, reportQuery(req));
    if (!model) return res.status(404).json({ error: 'not_found' });
    audit(db, 'report_viewed', user, `${model.firm.name} · ${model.metrics.fellow.firstName} ${model.metrics.fellow.lastName} · ${model.checkpoint.title}`);
    res.json(model);
  });

  /* ---------- admin ---------- */

  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get('/dataset', (_req, res) => res.json(loadDataset(db)));

  admin.post('/import/:table', (req, res) => {
    const spec = tableSpecs.find((s) => s.key === req.params.table);
    if (!spec) return res.status(404).json({ error: 'unknown_table' });
    if (typeof req.body !== 'string') return res.status(400).json({ error: 'send text/csv' });
    const parsed = importCsv(spec, req.body);
    if (parsed.fatal || req.query.dryRun === '1') return res.json({ applied: false, ...parsed, count: parsed.items.length, items: undefined });
    tx(db, () => {
      replaceTable(db, spec.key, parsed.items as never);
      if (spec.key === 'users') ensureAdmins(db, opts.adminEmails);
      setMeta(db, 'label', 'Live data');
      setMeta(db, 'is_sample', '0');
    });
    audit(db, 'data_imported', req.user, `${spec.file}: ${parsed.items.length} rows`);
    const checks = validateDataset(loadDataset(db));
    res.json({ applied: true, count: parsed.items.length, issues: parsed.issues, checks });
  });

  admin.post('/checkpoints/:id/status', (req, res) => {
    const status = req.body?.status === 'published' ? 'published' : 'draft';
    const r = db.prepare('update checkpoints set status = ? where id = ?').run(status, req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'not_found' });
    audit(db, `checkpoint_${status}`, req.user, req.params.id);
    res.json({ ok: true });
  });

  /** Emails every active/invited leader of a firm a link to its report. */
  admin.post('/invite/:firmId', async (req, res) => {
    const data = loadDataset(db);
    const firm = data.firms.find((f) => f.id === req.params.firmId && f.reportEnabled !== false);
    if (!firm) return res.status(404).json({ error: 'not_found' });
    const model = await repo.getFirmReport(firm.reportToken);
    if (!model) return res.status(409).json({ error: 'no_published_checkpoint' });
    const recipients = data.users.filter(
      (u) => u.firmId === firm.id && u.role === 'firm_leader' && u.accessStatus !== 'revoked',
    );
    const link = `${opts.baseUrl}/r/${firm.reportToken}`;
    let sent = 0;
    const failed: string[] = [];
    for (const u of recipients) {
      try {
        await mailer.send(
          reportInvitationEmail({
            to: u.email,
            name: u.name ?? null,
            firmName: firm.name,
            checkpointTitle: model.checkpoint.title,
            link,
            fellowNames: model.fellows.map((m) => `${m.fellow.firstName} ${m.fellow.lastName}`),
          }),
        );
        sent++;
      } catch {
        failed.push(u.email);
      }
    }
    audit(db, 'invitations_sent', req.user, `${firm.name}: ${sent} sent${failed.length ? `, ${failed.length} failed` : ''}`);
    res.json({ sent, failed, link });
  });

  admin.get('/outbox', (_req, res) => {
    res.json({
      live: mailer.live,
      messages: db.prepare('select * from outbox order by id desc limit 50').all(),
    });
  });

  admin.get('/audit', (_req, res) => {
    res.json(db.prepare('select * from audit order by id desc limit 200').all());
  });

  api.use('/admin', admin);
  api.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use('/api', api);

  /* ---------- web app ---------- */
  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(
      express.static(opts.staticDir, {
        index: false,
        setHeaders(res, file) {
          res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(opts.staticDir!, 'index.html'));
    });
  }

  return app;
}
