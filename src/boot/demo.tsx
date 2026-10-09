import { HashRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import type { AdminActions } from '../data/adminActions';
import { DataProvider } from '../data/DataProvider';
import { importCsv } from '../data/importSpec';
import { InMemoryRepository } from '../data/repository';
import { datasetStore } from '../data/store';
import { validateDataset } from '../data/validate';

const repo = new InMemoryRepository(datasetStore.get);

const admin: AdminActions = {
  async importTable(spec, csv, dryRun) {
    const r = importCsv(spec, csv);
    if (r.fatal || dryRun) return { applied: false, fatal: r.fatal, count: r.items.length, issues: r.issues };
    datasetStore.replace({ ...datasetStore.get(), label: 'Imported data (this browser tab only)', [spec.key]: r.items });
    return { applied: true, count: r.items.length, issues: r.issues, checks: validateDataset(datasetStore.get()) };
  },
  reset: () => datasetStore.reset(),
};

/** Self-contained prototype: sample data in the page, no server, no sign-in. */
export function Root() {
  return (
    <DataProvider repo={repo} admin={admin} subscribe={datasetStore.subscribe} getVersion={datasetStore.version}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </DataProvider>
  );
}
