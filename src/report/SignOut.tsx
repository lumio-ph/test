import { DEMO } from '../config';
import { authApi } from '../data/api';
import { useInPreview } from './ReportNav';

/** Hosted mode only. Hidden in the demo and inside the admin preview. */
export function SignOutLink({ className = 'r-mono' }: { className?: string }) {
  const inPreview = useInPreview();
  if (DEMO || inPreview) return null;
  return (
    <button
      type="button"
      className={className}
      style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
      onClick={() => authApi.signOut().then(() => (window.location.href = '/sign-in'))}
    >
      Sign out
    </button>
  );
}
