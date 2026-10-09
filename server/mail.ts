/**
 * Outgoing email. With SMTP_URL set, mail is sent for real and the outbox
 * keeps only the recipient and subject. Without it (local testing), mail is
 * kept in the outbox so admins can read it in the admin's "Access" tab.
 */
import nodemailer from 'nodemailer';
import type { DB } from './db';

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  readonly live: boolean;
  send(email: Email): Promise<void>;
}

export function createMailer(db: DB, opts: { smtpUrl?: string; from: string }): Mailer {
  const transport = opts.smtpUrl ? nodemailer.createTransport(opts.smtpUrl) : null;
  const record = db.prepare(
    'insert into outbox (created_at, to_addr, subject, text_body, html_body, status, error) values (?,?,?,?,?,?,?)',
  );
  return {
    live: Boolean(transport),
    async send(email) {
      if (!transport) {
        record.run(Date.now(), email.to, email.subject, email.text, email.html, 'test_outbox', null);
        // Test mode only: lets whoever runs the server read sign-in codes in the log.
        console.log(`[test outbox] to ${email.to}: ${email.subject}`);
        return;
      }
      try {
        await transport.sendMail({ from: opts.from, ...email });
        record.run(Date.now(), email.to, email.subject, null, null, 'sent', null);
      } catch (e) {
        record.run(Date.now(), email.to, email.subject, null, null, 'failed', String(e));
        throw e;
      }
    },
  };
}

/* ---------------- templates ---------------- */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function frame(body: string) {
  return `<!doctype html><html><body style="margin:0;background:#FAFAF8;font-family:Helvetica,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E5E5E5;border-radius:12px;overflow:hidden">
<tr><td style="height:4px;background:#128A38;background-image:linear-gradient(90deg,#128A38,#31B44B,#7ED321,#FFC400)"></td></tr>
<tr><td style="padding:32px 36px 8px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#128A38">Included VC Africa · Investment Cohort</td></tr>
<tr><td style="padding:8px 36px 36px">${body}</td></tr>
</table>
<p style="font-size:11px;color:#8A8A8A;margin:16px 0 0">Sent by the Included VC Africa programme team.</p>
</td></tr></table></body></html>`;
}

export function signInCodeEmail(to: string, code: string, name: string | null): Email {
  const greeting = name ? `Hello ${name},` : 'Hello,';
  return {
    to,
    subject: `${code} is your Included VC report sign-in code`,
    text: `${greeting}\n\nYour sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't ask for this code, you can ignore this email.`,
    html: frame(`<p style="font-size:16px;line-height:1.6;margin:0 0 20px">${esc(greeting)}</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 12px">Your sign-in code is:</p>
<p style="font-size:40px;font-weight:900;letter-spacing:.12em;margin:0 0 20px;font-family:Helvetica,Arial,sans-serif">${code}</p>
<p style="font-size:14px;line-height:1.6;color:#5C5C5C;margin:0">It expires in 10 minutes. If you didn't ask for this code, you can ignore this email.</p>`),
  };
}

export function reportInvitationEmail(opts: {
  to: string;
  name: string | null;
  firmName: string;
  checkpointTitle: string;
  link: string;
  fellowNames: string[];
}): Email {
  const greeting = opts.name ? `Dear ${opts.name},` : 'Hello,';
  const fellows =
    opts.fellowNames.length <= 1
      ? opts.fellowNames.join('')
      : `${opts.fellowNames.slice(0, -1).join(', ')} and ${opts.fellowNames[opts.fellowNames.length - 1]}`;
  const subject = `Your fellows' progress: ${opts.firmName} · ${opts.checkpointTitle}`;
  const text = `${greeting}

The ${opts.checkpointTitle} progress report for ${opts.firmName} is ready. It shows how ${fellows} ${opts.fellowNames.length === 1 ? 'is' : 'are'} attending, engaging and applying what they are learning on the Investment Cohort.

Open your private report:
${opts.link}

You'll be asked for this email address and sent a one-time sign-in code. The report is private to your firm's leadership.

Included VC Africa`;
  const html = frame(`<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${esc(greeting)}</p>
<h1 style="font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-.02em;margin:0 0 16px">Your fellows' progress</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">The ${esc(opts.checkpointTitle)} progress report for <strong>${esc(opts.firmName)}</strong> is ready. It shows how ${esc(fellows)} ${opts.fellowNames.length === 1 ? 'is' : 'are'} attending, engaging and applying what they are learning on the Investment Cohort.</p>
<p style="margin:0 0 28px"><a href="${esc(opts.link)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:999px">Open your report →</a></p>
<p style="font-size:14px;line-height:1.6;color:#5C5C5C;margin:0">You'll be asked for this email address and sent a one-time sign-in code. The report is private to your firm's leadership.</p>`);
  return { to: opts.to, subject, text, html };
}
