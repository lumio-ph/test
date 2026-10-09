import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEMO } from '../config';
import { authApi } from '../data/api';
import logo from '../assets/included-vc-logo.png';
import mark from '../assets/africa-mark.png';
import { useQuery } from '../data/DataProvider';
import { fullName } from '../report/format';
import { FirmMark, Icon } from '../report/primitives';
import { reportPath } from '../report/ReportNav';

/**
 * Prototype index for reviewers. Not part of the production experience:
 * leadership only ever receives their own firm's link.
 */
export function IndexPage() {
  return DEMO ? <DemoIndex /> : <HostedHome />;
}

/** Hosted: send people straight to where they belong. */
function HostedHome() {
  const navigate = useNavigate();
  useEffect(() => {
    authApi.me().then((me) => navigate(me.user ? (me.home ?? '/no-report') : '/sign-in', { replace: true }));
  }, [navigate]);
  return null;
}

function DemoIndex() {
  const { data } = useQuery((r) => r.getDataset(), []);
  if (!data) return null;
  const firms = data.firms.filter((f) => f.reportEnabled !== false);

  return (
    <div className="r-root" style={{ minHeight: '100vh' }}>
      <div className="r-demo">
        <b>PROTOTYPE</b> · Phase 1 design review · demonstration data only · not yet access-controlled
      </div>
      <header className="r-header">
        <div className="r-header__bar">
          <img className="r-header__logo" src={logo} alt="Included VC Africa" />
          <div className="r-header__tools" style={{ marginLeft: 'auto' }}>
            <Link to="/admin" className="r-button" style={{ padding: '9px 16px', fontSize: 13.5 }}>
              Admin preview <Icon.Arrow />
            </Link>
          </div>
        </div>
        <div className="r-header__stripe" />
      </header>
      <section className="r-hero">
        <img className="r-hero__mark" src={mark} alt="" aria-hidden="true" />
        <div className="r-wrap">
          <div className="r-rule" />
          <div className="r-eyebrow" style={{ marginBottom: 28 }}>
            {data.cohorts[0]?.name} · Sponsor progress reporting
          </div>
          <h1 className="r-h1" style={{ maxWidth: '15ch', marginBottom: 28 }}>
            One report design. <span className="hl-lime">Every firm.</span> <span className="hl-gold">Every fellow.</span>
          </h1>
          <p className="r-lede" style={{ marginBottom: 56 }}>
            Each participating firm receives a private company report, with an individual report for every fellow it
            sponsors. Choose a sample report below, or open the admin preview to switch between them.
          </p>
          <div className="r-fellows">
            {firms.map((f) => (
              <div key={f.id} className="r-card" style={{ padding: '36px 32px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                  <div className="r-prepared__logo">
                    <FirmMark firm={f} />
                  </div>
                  <Link className="r-button" to={reportPath({ firmToken: f.reportToken })}>
                    Company report <Icon.Arrow />
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {data.fellows
                    .filter((x) => x.firmId === f.id)
                    .map((x) => (
                      <Link
                        key={x.id}
                        className="r-button r-button--ghost"
                        to={reportPath({ firmToken: f.reportToken, fellowToken: x.reportToken })}
                      >
                        {fullName(x)} <Icon.Arrow />
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
