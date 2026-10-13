import { Component, useEffect, useState, type ReactNode } from 'react';

/** Sends a browser error to the server log (hosted mode), best effort. */
export function reportClientError(error: unknown, where: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ivc': '1' },
      body: JSON.stringify({ where, message: e.message, stack: (e.stack ?? '').slice(0, 2000), url: location.pathname + location.search }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* nothing else to do */
  }
}

export function FailurePanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="r-root">
      <div className="r-notfound">
        <div>
          <div className="r-rule" style={{ margin: '0 auto 20px' }} />
          <h1 className="r-h2">This report couldn’t be shown.</h1>
          <p className="r-body">Please reload the page. If it happens again, send a screenshot of this page to the Included VC team.</p>
          <p style={{ marginTop: 24 }}>
            <button type="button" className="r-button" onClick={() => location.reload()}>
              Reload
            </button>
          </p>
          <p className="r-mono" style={{ marginTop: 28, fontSize: 11, color: 'var(--ink-400)', wordBreak: 'break-word' }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Shows FailurePanel instead of a blank page if anything below it crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    reportClientError(error, 'render');
  }
  render() {
    return this.state.error ? <FailurePanel error={this.state.error} /> : this.props.children;
  }
}

/** A quiet loading line, shown only if loading takes more than a moment. */
export function Loading({ label = 'Loading report…' }: { label?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="r-root">
      <div className="r-notfound" style={{ minHeight: '60vh' }}>
        {show && <p className="r-mono">{label}</p>}
      </div>
    </div>
  );
}
