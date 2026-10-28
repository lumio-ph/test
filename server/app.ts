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
import { Auth, type SessionUser, type SignInResult } from './auth';
import { audit, ensureAdmins, loadDataset, replaceTable, setMeta, tx, type DB } from './db';
import { reportInvitationEmail, type Mailer } from './mail';
import { readWorkbook } from './workbook';

export interface AppOptions {
  db: DB;
  mailer: Mailer;
  secret: string;
  baseUrl: string; // e.g. https://reports.included.vc
  adminEmails: string[];
  adminPassword?: string;
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
  const auth = new Auth(db, opts.secret, opts.adminPassword);
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

  const requireAdmin = (req: Request, res: Response, next: NextFunction) =>
    !req.user ? res.status(401).json({ error: 'sign_in_required' }) : req.user.role !== 'admin' ? res.status(403).json({ error: 'forbidden' }) : next();

  /* ---------- auth ---------- */

  const finishSignIn = (res: Response, r: SignInResult) => {
    if (!r.ok) {
      const status = r.reason === 'rate_limited' ? 429 : r.reason === 'admin_not_configured' ? 503 : 400;
      return res.status(status).json({ error: r.reason });
    }
    res.cookie(COOKIE, r.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      maxAge: 14 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ ok: true, home: homeFor(r.user) });
  };

  /** Partner: email + the firm link they arrived on. */
  api.post('/auth/email', (req, res) => {
    const email = String(req.body?.email ?? '');
    const firmToken = String(req.body?.firmToken ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return res.status(400).json({ error: 'invalid_email' });
    if (!firmToken) return res.status(400).json({ error: 'link_required' });
    finishSignIn(res, auth.signInWithEmail(email, firmToken, req.ip ?? 'unknown'));
  });

  /** Admin: email + ADMIN_PASSWORD. */
  api.post('/auth/admin', (req, res) => {
    finishSignIn(res, auth.signInAdmin(String(req.body?.email ?? ''), String(req.body?.password ?? ''), req.ip ?? 'unknown'));
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
      adminConfigured: Boolean(opts.adminPassword),
    });
  });

  /** Browser errors, so a blank page can be diagnosed from the host's logs. */
  const clientErrors: number[] = [];
  api.post('/client-error', (req, res) => {
    const now = Date.now();
    while (clientErrors.length && clientErrors[0] < now - 60_000) clientErrors.shift();
    if (clientErrors.length < 30) {
      clientErrors.push(now);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const t = (v: unknown, n: number) => String(v ?? '').slice(0, n).replace(/\s+/g, ' ');
      console.log(`[client-error] ${t(b.where, 20)} ${t(b.url, 200)} · ${req.user?.email ?? 'signed out'} · ${t(b.message, 300)} · ${t(b.stack, 800)}`);
    }
    res.status(204).end();
  });

  /* ---------- reports ---------- */

  // Report links open without sign-in: the unguessable firm token is the
  // access. A fellow token only opens under its own firm's token (enforced in
  // the repository), and drafts stay admin-only. Too many wrong links from one
  // address in 10 minutes and it is paused, so links can't be guessed.
  const misses = new Map<string, { n: number; since: number }>();
  const MISS_LIMIT = 30;
  const MISS_WINDOW = 10 * 60_000;
  const missCount = (ip: string) => {
    const m = misses.get(ip);
    return m && Date.now() - m.since < MISS_WINDOW ? m.n : 0;
  };
  const notFound = (req: Request, res: Response) => {
    const ip = req.ip ?? '';
    const m = misses.get(ip);
    misses.set(ip, m && Date.now() - m.since < MISS_WINDOW ? { n: m.n + 1, since: m.since } : { n: 1, since: Date.now() });
    if (misses.size > 10_000) misses.clear();
    audit(db, 'report_denied', req.user ?? null, req.path);
    res.status(404).json({ error: 'not_found' });
  };
  const notThrottled = (req: Request, res: Response, next: NextFunction) =>
    !req.user && missCount(req.ip ?? '') >= MISS_LIMIT ? res.status(429).json({ error: 'rate_limited' }) : next();
  // Partners always get the latest published checkpoint and no list of
  // others; only admins can pick a checkpoint (?cp=) or see drafts.
  const isAdmin = (req: Request) => req.user?.role === 'admin';
  const reportQuery = (req: Request) => ({
    checkpointId: isAdmin(req) && typeof req.query.cp === 'string' ? req.query.cp : undefined,
    includeDrafts: isAdmin(req) && req.query.drafts === '1',
  });
  const forViewer = <T extends { checkpoint: unknown; checkpoints: unknown[] }>(req: Request, model: T): T =>
    isAdmin(req) ? model : { ...model, checkpoints: [model.checkpoint] };

  api.get('/reports/:firmToken', notThrottled, async (req, res) => {
    const user = req.user ?? null;
    const model = await repo.getFirmReport(req.params.firmToken, reportQuery(req));
    if (!model) return notFound(req, res);
    audit(db, 'report_viewed', user, `${model.firm.name} · ${model.checkpoint.title}`);
    res.json(forViewer(req, model));
  });

  api.get('/reports/:firmToken/:fellowToken', notThrottled, async (req, res) => {
    const user = req.user ?? null;
    const model = await repo.getFellowReport(req.params.firmToken, req.params.fellowToken, reportQuery(req));
    if (!model) return notFound(req, res);
    audit(db, 'report_viewed', user, `${model.firm.name} · ${model.metrics.fellow.firstName} ${model.metrics.fellow.lastName} · ${model.checkpoint.title}`);
    res.json(forViewer(req, model));
  });

  /* ---------- admin ---------- */

  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get('/dataset', (_req, res) => res.json(loadDataset(db)));

  const existingLogos = () =>
    new Map(
      (db.prepare('select id, logo_url from firms where logo_url is not null and logo_url != ?').all('') as Array<{
        id: string;
        logo_url: string;
      }>).map((r) => [r.id, r.logo_url]),
    );

  const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'];

  /** Upload a firm's logo (stored with the firm; shown in its reports). */
  admin.post('/firms/:id/logo', express.raw({ type: () => true, limit: '2mb' }), (req, res) => {
    const type = String(req.get('content-type') ?? '').split(';')[0].trim();
    if (!LOGO_TYPES.includes(type)) return res.status(400).json({ error: 'Use a PNG, JPG, SVG or WebP image.' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Empty file.' });
    const url = `data:${type};base64,${req.body.toString('base64')}`;
    const r = db.prepare('update firms set logo_url = ? where id = ?').run(url, req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'not_found' });
    audit(db, 'logo_updated', req.user, req.params.id);
    res.json({ ok: true });
  });

  admin.delete('/firms/:id/logo', (req, res) => {
    db.prepare('update firms set logo_url = null where id = ?').run(req.params.id);
    audit(db, 'logo_removed', req.user, req.params.id);
    res.json({ ok: true });
  });

  /** Current link tokens by firm/fellow id, so re-imports keep sent links working. */
  const existingTokens = () =>
    new Map(
      (db.prepare('select id, report_token from firms union all select id, report_token from fellows').all() as Array<{
        id: string;
        report_token: string;
      }>).map((r) => [r.id, r.report_token]),
    );

  admin.post('/import/:table', (req, res) => {
    const spec = tableSpecs.find((s) => s.key === req.params.table);
    if (!spec) return res.status(404).json({ error: 'unknown_table' });
    if (typeof req.body !== 'string') return res.status(400).json({ error: 'send text/csv' });
    const parsed = importCsv(spec, req.body, existingTokens(), existingLogos());
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

  /** Whole data template (.xlsx) in one upload. Tabs present replace their tables. */
  admin.post(
    '/import-workbook',
    express.raw({ type: () => true, limit: '30mb' }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'send the .xlsx file' });
      let read: Awaited<ReturnType<typeof readWorkbook>>;
      try {
        read = await readWorkbook(req.body, existingTokens(), existingLogos());
      } catch {
        return res.status(400).json({ error: 'not_a_workbook' });
      }
      const summary = read.tables.map((t) => ({
        table: t.spec.key,
        title: t.spec.title,
        count: t.items.length,
        fatal: t.fatal,
        issues: t.issues.slice(0, 200),
        issueCount: t.issues.length,
      }));
      const fatal = read.tables.some((t) => t.fatal);
      if (fatal || req.query.dryRun === '1') return res.json({ applied: false, fatal, tables: summary, missingTabs: read.missingTabs });
      tx(db, () => {
        for (const t of read.tables) replaceTable(db, t.spec.key, t.items as never);
        ensureAdmins(db, opts.adminEmails);
        setMeta(db, 'label', 'Live data');
        setMeta(db, 'is_sample', '0');
      });
      audit(db, 'data_imported', req.user, `Workbook: ${summary.map((t) => `${t.title} ${t.count}`).join(', ')}`);
      res.json({ applied: true, fatal: false, tables: summary, missingTabs: read.missingTabs, checks: validateDataset(loadDataset(db)) });
    },
  );

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
    // Frame Studio: a standalone page (public/frame/) beside the report app.
    // Express treats /frame and /frame/ as one route; the page's relative links need the slash.
    app.get('/frame/', (req, res) => {
      if (!req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(301, '/frame/');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(opts.staticDir!, 'frame', 'index.html'));
    });
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(opts.staticDir!, 'index.html'));
    });
  }

  return app;
}
