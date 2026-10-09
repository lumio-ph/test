import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { ApiRepository, apiAdminActions } from '../data/api';
import { DataProvider } from '../data/DataProvider';

const repo = new ApiRepository();

/** Hosted app: data comes from the reports server, behind sign-in. */
export function Root() {
  return (
    <DataProvider repo={repo} admin={apiAdminActions}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </DataProvider>
  );
}
