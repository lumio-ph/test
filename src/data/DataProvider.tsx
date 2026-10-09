import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AdminActions } from './adminActions';
import type { ReportRepository } from './repository';

interface Ctx {
  repo: ReportRepository;
  admin: AdminActions;
  /** Changes whenever the underlying data changes, so views re-query. */
  version: number;
  refresh(): void;
}

const DataContext = createContext<Ctx | null>(null);
const noop = () => () => {};

export function DataProvider({
  repo,
  admin,
  subscribe = noop,
  getVersion = () => 0,
  children,
}: {
  repo: ReportRepository;
  admin: AdminActions;
  subscribe?: (fn: () => void) => () => void;
  getVersion?: () => number;
  children: ReactNode;
}) {
  const external = useSyncExternalStore(subscribe, getVersion);
  const [local, setLocal] = useState(0);
  const refresh = useCallback(() => setLocal((n) => n + 1), []);
  return (
    <DataContext.Provider value={{ repo, admin, version: external * 1000 + local, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useRepository() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useRepository must be used inside <DataProvider>');
  return ctx;
}

/** Runs an async repository query and re-runs it when inputs or data change. */
export function useQuery<T>(run: (repo: ReportRepository) => Promise<T>, deps: unknown[]) {
  const { repo, version } = useRepository();
  const [state, setState] = useState<{ loading: boolean; data: T | null; error: unknown }>({
    loading: true,
    data: null,
    error: null,
  });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    run(repo).then(
      (data) => live && setState({ loading: false, data, error: null }),
      (error) => live && setState({ loading: false, data: null, error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version, ...deps]);
  return state;
}
