import { HashRouter, Route, Routes } from 'react-router-dom';
import { AdminApp } from './admin/AdminApp';
import { DataProvider } from './data/DataProvider';
import { IndexPage } from './pages/IndexPage';
import { FellowReportPage, FirmReportPage, ReportNotFound } from './pages/ReportPages';

/*
 * Hash routing keeps the prototype deployable as static files (or a single
 * HTML page). Production moves to path routes behind authentication.
 */
export function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/r/:firmToken" element={<FirmReportPage />} />
          <Route path="/r/:firmToken/:fellowToken" element={<FellowReportPage />} />
          <Route path="/admin" element={<AdminApp />} />
          <Route path="*" element={<ReportNotFound />} />
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}
