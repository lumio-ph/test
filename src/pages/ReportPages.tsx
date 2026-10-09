import { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AuthRequired } from '../data/api';
import { SignOutLink } from '../report/SignOut';
import { DEMO } from '../config';
import logo from '../assets/included-vc-logo.png';
import { useQuery } from '../data/DataProvider';
import { FellowReportView } from '../report/FellowReportView';
import { FirmReportView } from '../report/FirmReportView';

/*
 * ACCESS
 * Hosted mode: the server only returns a report to a signed-in recipient
 * of that firm (see server/app.ts). A 401 sends the visitor to sign-in and
 * back; anything they may not see is indistinguishable from a bad link.
 * Demo mode: sample data in the page, no sign-in — not access-controlled.
 */

function useScrollTop() {
  const { pathname, search } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname, search]);
}

export function FirmReportPage() {
  useScrollTop();
  const { firmToken = '' } = useParams();
  const [params] = useSearchParams();
  const cp = params.get('cp') ?? undefined;
  const { loading, data, error } = useQuery((r) => r.getFirmReport(firmToken, { checkpointId: cp }), [firmToken, cp]);
  useEffect(() => {
    if (data) document.title = `Your Fellows' Progress · ${data.firm.name} · Included VC`;
  }, [data]);
  if (error instanceof AuthRequired) return <ToSignIn />;
  if (loading && !data) return null;
  return data ? <FirmReportView model={data} /> : <ReportNotFound />;
}

export function FellowReportPage() {
  useScrollTop();
  const { firmToken = '', fellowToken = '' } = useParams();
  const [params] = useSearchParams();
  const cp = params.get('cp') ?? undefined;
  const { loading, data, error } = useQuery(
    (r) => r.getFellowReport(firmToken, fellowToken, { checkpointId: cp }),
    [firmToken, fellowToken, cp],
  );
  useEffect(() => {
    if (data)
      document.title = `${data.metrics.fellow.firstName} ${data.metrics.fellow.lastName} · Progress report · Included VC`;
  }, [data]);
  if (error instanceof AuthRequired) return <ToSignIn />;
  if (loading && !data) return null;
  return data ? <FellowReportView model={data} /> : <ReportNotFound />;
}

function ToSignIn() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/sign-in?next=${encodeURIComponent(pathname + search)}`} replace />;
}

/** Signed in, but the firm's report isn't published yet (or reports are off). */
export function NoReportPage() {
  return (
    <div className="r-root">
      <div className="r-notfound">
        <div>
          <img src={logo} alt="Included VC Africa" style={{ height: 40, marginBottom: 40 }} />
          <div className="r-rule" style={{ margin: '0 auto 20px' }} />
          <h1 className="r-h2">Your report isn't ready yet.</h1>
          <p className="r-body">
            Your access is set up. We'll email you as soon as your firm's progress report is published.
          </p>
          <p style={{ marginTop: 32 }}>
            <SignOutLink />
          </p>
        </div>
      </div>
    </div>
  );
}

/** Same response for "doesn't exist" and "not yours", so links can't be probed. */
export function ReportNotFound() {
  return (
    <div className="r-root">
      <div className="r-notfound">
        <div>
          <img src={logo} alt="Included VC Africa" style={{ height: 40, marginBottom: 40 }} />
          <div className="r-rule" style={{ margin: '0 auto 20px' }} />
          <h1 className="r-h2">This report link isn't available.</h1>
          <p className="r-body">
            The link may have been mistyped, or it belongs to a different firm. Please use the private link emailed to
            you by the Included VC programme team, or contact them for help.
          </p>
          <p style={{ marginTop: 32, display: 'flex', gap: 24, justifyContent: 'center' }}>
            <Link to="/" className="r-mono">
              {DEMO ? 'Prototype index' : 'Go to my report'}
            </Link>
            <SignOutLink />
          </p>
        </div>
      </div>
    </div>
  );
}
