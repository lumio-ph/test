import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logoInverse from "../assets/included-vc-logo-inverse.png";
import mark from "../assets/africa-mark.png";
import { authApi } from "../data/api";

/** Only same-site paths are allowed as a post-sign-in destination. */
const safeNext = (next: string | null) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : null;

export function SignInPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "info";
    text: string;
  } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Sign in · Included VC progress reports";
    authApi.me().then((me) => {
      if (me.user) navigate(next ?? me.home ?? "/", { replace: true });
    });
  }, [navigate, next]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setMessage(null);
    const r = await authApi.requestCode(email);
    setBusy(false);
    if (r === "sent") {
      setStep("code");
      setMessage({
        tone: "info",
        text: `If ${email.trim()} has access to a report, a 6-digit code is on its way. It expires in 10 minutes.`,
      });
    } else if (r === "rate_limited")
      setMessage({
        tone: "error",
        text: "Too many codes requested. Please wait 15 minutes and try again.",
      });
    else if (r === "invalid")
      setMessage({
        tone: "error",
        text: "Enter a full email address, like name@firm.com.",
      });
    else
      setMessage({
        tone: "error",
        text: "We couldn't send the email just now. Please try again in a minute.",
      });
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const r = await authApi.verify(email, code);
    setBusy(false);
    if (r) navigate(next ?? r.home, { replace: true });
    else {
      setMessage({
        tone: "error",
        text: "That code didn't work. Check you're using the latest email, or request a new code. Codes expire after 10 minutes or 5 attempts.",
      });
      setCode("");
    }
  };

  return (
    <div className="r-root">
      <div className="s-page">
        <aside className="s-brand">
          <img className="s-mark" src={mark} alt="" aria-hidden="true" />
          <img className="s-logo" src={logoInverse} alt="Included VC Africa" />
          <div>
            <div className="r-rule" style={{ background: "var(--gold)" }} />
            <div
              className="r-eyebrow r-eyebrow--gold"
              style={{ marginBottom: 18 }}
            >
              Investment Cohort · Progress reports
            </div>
            <h1 className="s-title">Your fellows' progress, privately.</h1>
            <p className="s-lede">
              Each report is prepared for the leadership of one sponsoring firm
              and opens only for the people your firm has authorised.
            </p>
          </div>
        </aside>

        <main className="s-main">
          <div className="s-card">
            {step === "email" ? (
              <form onSubmit={sendCode} noValidate>
                <h2 className="r-h3 s-h">Sign in</h2>
                <p className="s-help">
                  Enter the email address your report invitation was sent to.
                  We'll email you a one-time code.
                </p>
                <label className="s-label" htmlFor="email">
                  Work email
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
                  placeholder="name@firm.com"
                  autoFocus
                />
                {message && (
                  <p className={`s-msg s-msg--${message.tone}`} role="alert">
                    {message.text}
                  </p>
                )}
                <button
                  className="r-button s-submit"
                  type="submit"
                  disabled={busy || !email.trim()}
                >
                  {busy ? "Sending…" : "Email me a code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verify} noValidate>
                <h2 className="r-h3 s-h">Check your email</h2>
                {message && (
                  <p
                    className={`s-msg s-msg--${message.tone}`}
                    role={message.tone === "error" ? "alert" : "status"}
                  >
                    {message.text}
                  </p>
                )}
                <label className="s-label" htmlFor="code">
                  6-digit code
                </label>
                <input
                  id="code"
                  ref={codeRef}
                  className="s-input s-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="••••••"
                />
                <button
                  className="r-button s-submit"
                  type="submit"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? "Checking…" : "Sign in"}
                </button>
                <div className="s-alt">
                  <button
                    type="button"
                    onClick={() => sendCode()}
                    disabled={busy}
                  >
                    Send a new code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setMessage(null);
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </div>
          <p className="s-foot">
            No password needed. Trouble signing in? Contact the Included VC
            programme team.
          </p>
        </main>
      </div>
    </div>
  );
}
