import { Route, Routes } from 'react-router-dom';
import { AdminApp } from './admin/AdminApp';
import { DEMO } from './config';
import { IndexPage } from './pages/IndexPage';
import { FellowReportPage, FirmReportPage, NoReportPage, ReportNotFound } from './pages/ReportPages';
import { SignInPage } from './pages/SignInPage';

/** Routes shared by the hosted app and the self-contained demo. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/r/:firmToken" element={<FirmReportPage />} />
      <Route path="/r/:firmToken/:fellowToken" element={<FellowReportPage />} />
      <Route path="/admin" element={<AdminApp />} />
      {!DEMO && <Route path="/sign-in" element={<SignInPage />} />}
      {!DEMO && <Route path="/no-report" element={<NoReportPage />} />}
      <Route path="*" element={<ReportNotFound />} />
    </Routes>
  );
}
