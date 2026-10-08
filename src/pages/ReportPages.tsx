import { useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import logo from '../assets/included-vc-logo.png';
import { useQuery } from '../data/DataProvider';
import { FellowReportView } from '../report/FellowReportView';
import { FirmReportView } from '../report/FirmReportView';

/*
 * PROTOTYPE ACCESS NOTE
 * Reports are addressed by opaque tokens and a fellow is only reachable
 * through their own firm's token. That prevents casual URL-guessing but is
 * NOT security: the whole demo dataset ships to the browser. Phase 3
 * replaces this with authenticated sessions + row-level security
 * (see docs/ARCHITECTURE.md).
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
  const { loading, data } = useQuery((r) => r.getFirmReport(firmToken, { checkpointId: cp }), [firmToken, cp]);
  useEffect(() => {
    if (data) document.title = `Your Fellows' Progress · ${data.firm.name} · Included VC`;
  }, [data]);
  if (loading && !data) return null;
  return data ? <FirmReportView model={data} /> : <ReportNotFound />;
}

export function FellowReportPage() {
  useScrollTop();
  const { firmToken = '', fellowToken = '' } = useParams();
  const [params] = useSearchParams();
  const cp = params.get('cp') ?? undefined;
  const { loading, data } = useQuery(
    (r) => r.getFellowReport(firmToken, fellowToken, { checkpointId: cp }),
    [firmToken, fellowToken, cp],
  );
  useEffect(() => {
    if (data)
      document.title = `${data.metrics.fellow.firstName} ${data.metrics.fellow.lastName} · Progress report · Included VC`;
  }, [data]);
  if (loading && !data) return null;
  return data ? <FellowReportView model={data} /> : <ReportNotFound />;
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
            The link may have expired or been mistyped. Please use the private link shared with you by the Included VC
            programme team, or contact them for a new one.
          </p>
          <p style={{ marginTop: 32 }}>
            <Link to="/" className="r-mono">
              Prototype index
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
