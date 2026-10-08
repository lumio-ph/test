/**
 * Prototype data store: holds the active Dataset in memory and lets the
 * admin import screen swap tables in for the current browser session.
 * Nothing is persisted — reloading restores the demonstration data.
 */
import { sampleDataset } from './sample/sampleDataset';
import type { Dataset } from './types';

type Listener = () => void;

let current: Dataset = sampleDataset;
let version = 0;
const listeners = new Set<Listener>();

export const datasetStore = {
  get: () => current,
  version: () => version,
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  replace(next: Dataset) {
    current = next;
    version++;
    listeners.forEach((l) => l());
  },
  reset() {
    datasetStore.replace(sampleDataset);
  },
};
