import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logoInverse from '../assets/included-vc-logo-inverse.png';
import mark from '../assets/africa-mark.png';
import { authApi, type SignInError } from '../data/api';

/** Only same-site paths are allowed as a post-sign-in destination. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

/** The firm link a partner arrived on, e.g. /r/k7Qm2xP9aRf4/... → k7Qm2xP9aRf4 */
const firmTokenFrom = (next: string | null) => next?.match(/^\/r\/([^/?#]+)/)?.[1] ?? null;

const partnerMessages: Record<SignInError, string> = {
  not_authorised:
    "This email isn't on the list for this report. Use the address your invitation was sent to, or contact the Included VC programme team.",
  rate_limited: 'Too many attempts. Please wait 15 minutes and try again.',
  invalid_email: 'Enter a full email address, like name@firm.com.',
  admin_not_configured: 'Something went wrong. Please try again.',
  failed: 'Something went wrong. Please try again in a minute.',
};

const adminMessages: Record<SignInError, string> = {
  not_authorised: "That email and password don't match an admin account.",
  rate_limited: 'Too many attempts. Please wait 15 minutes and try again.',
  invalid_email: 'Enter a full email address.',
  admin_not_configured: 'Admin sign-in is not switched on yet. Set ADMIN_PASSWORD in the hosting settings (Render → Environment).',
  failed: 'Something went wrong. Please try again in a minute.',
};

export function SignInPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const firmToken = firmTokenFrom(next);
  const mode: 'partner' | 'admin' = firmToken ? 'partner' : 'admin';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign in · Included VC progress reports';
    authApi.me().then((me) => {
      if (me.user) navigate(next ?? me.home ?? '/', { replace: true });
    });
  }, [navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = mode === 'partner' ? await authApi.signInEmail(email, firmToken!) : await authApi.signInAdmin(email, password);
    setBusy(false);
    if ('home' in r) navigate(next ?? r.home, { replace: true });
    else setError((mode === 'partner' ? partnerMessages : adminMessages)[r.error]);
  };

  return (
    <div className="r-root">
      <div className="s-page">
        <aside className="s-brand">
          <img className="s-mark" src={mark} alt="" aria-hidden="true" />
          <img className="s-logo" src={logoInverse} alt="Included VC Africa" />
          <div>
            <div className="r-rule" style={{ background: 'var(--gold)' }} />
            <div className="r-eyebrow r-eyebrow--gold" style={{ marginBottom: 18 }}>
              Progress reports
            </div>
            <h1 className="s-title">Your fellows' progress, privately.</h1>
            <p className="s-lede">
              Each report is prepared for the leadership of one sponsoring firm and opens only for the people your firm
              has authorised.
            </p>
          </div>
        </aside>

        <main className="s-main">
          <div className="s-card">
            <form onSubmit={submit} noValidate>
              {mode === 'partner' ? (
                <>
                  <h2 className="r-h3 s-h">Open your report</h2>
                  <p className="s-help">Enter the email address your report invitation was sent to.</p>
                </>
              ) : (
                <>
                  <h2 className="r-h3 s-h">Included VC admin</h2>
                  <p className="s-help">
                    Sign in with your admin email and password. Partners: please open the link in your invitation email
                    instead.
                  </p>
                </>
              )}
              <label className="s-label" htmlFor="email">
                {mode === 'partner' ? 'Work email' : 'Admin email'}
              </label>
              <input
                id="email"
                className="s-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'partner' ? 'name@firm.com' : 'ops@included.vc'}
                autoFocus
              />
              {mode === 'admin' && (
                <>
                  <label className="s-label" htmlFor="password" style={{ marginTop: 18 }}>
                    Password
                  </label>
                  <input
                    id="password"
                    className="s-input"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </>
              )}
              {error && (
                <p className="s-msg s-msg--error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="r-button s-submit"
                type="submit"
                disabled={busy || !email.trim() || (mode === 'admin' && !password)}
              >
                {busy ? 'Checking…' : mode === 'partner' ? 'Open report' : 'Sign in'}
              </button>
            </form>
          </div>
          <p className="s-foot">Trouble getting in? Contact the Included VC programme team.</p>
        </main>
      </div>
    </div>
  );
}
