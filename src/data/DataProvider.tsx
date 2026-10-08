import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { InMemoryRepository, type ReportRepository } from './repository';
import { datasetStore } from './store';

interface Ctx {
  repo: ReportRepository;
  /** Changes whenever the underlying data changes, so views re-query. */
  version: number;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const version = useSyncExternalStore(datasetStore.subscribe, datasetStore.version);
  const repo = useMemo(() => new InMemoryRepository(datasetStore.get), []);
  return <DataContext.Provider value={{ repo, version }}>{children}</DataContext.Provider>;
}

export function useRepository() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useRepository must be used inside <DataProvider>');
  return ctx;
}

/** Runs an async repository query and re-runs it when inputs or data change. */
export function useQuery<T>(run: (repo: ReportRepository) => Promise<T>, deps: unknown[]) {
  const { repo, version } = useRepository();
  const [state, setState] = useState<{ loading: boolean; data: T | null }>({ loading: true, data: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    run(repo).then((data) => live && setState({ loading: false, data }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version, ...deps]);
  return state;
}
