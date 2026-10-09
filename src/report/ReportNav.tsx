/**
 * Report navigation is abstracted so the same components work both on
 * their own routes and inside the admin preview (where "opening" a fellow
 * should switch the preview instead of leaving the admin screen).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ReportTarget {
  firmToken: string;
  fellowToken?: string;
  checkpointId?: string;
}

export const reportPath = ({ firmToken, fellowToken, checkpointId }: ReportTarget) =>
  `/r/${firmToken}${fellowToken ? `/${fellowToken}` : ''}${checkpointId ? `?cp=${checkpointId}` : ''}`;

type Go = (t: ReportTarget) => void;
const NavContext = createContext<Go | null>(null);

export function ReportNavProvider({ go, children }: { go: Go; children: ReactNode }) {
  return <NavContext.Provider value={go}>{children}</NavContext.Provider>;
}

export function useReportNav(): Go {
  const override = useContext(NavContext);
  const navigate = useNavigate();
  return override ?? ((t) => navigate(reportPath(t)));
}

/** True inside the admin preview, where report links switch the preview. */
export const useInPreview = () => useContext(NavContext) !== null;

/** Scroll to a section inside whichever element is scrolling the report. */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
