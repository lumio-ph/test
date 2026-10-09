/**
 * Demo mode = the self-contained prototype (sample data in the page, hash
 * routes, no sign-in). Hosted mode = data from the reports server behind
 * sign-in. Set at build time: `vite build --mode single` builds the demo.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';

/** Turns an app path into a full shareable URL for the current mode. */
export const absoluteUrl = (path: string) =>
  DEMO
    ? `${window.location.origin}${window.location.pathname}#${path}`
    : `${window.location.origin}${path}`;

/** href for an <a> that opens an app path in a new tab. */
export const appHref = (path: string) => (DEMO ? `#${path}` : path);
