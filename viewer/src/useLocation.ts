import { useCallback, useEffect, useState } from "react";

/**
 * Minimal URL-driven state.  Exposes the portion of `window.location.pathname`
 * after Vite's configured BASE_URL plus the current query string, and a
 * `navigate` helper that pushes/replaces history entries.  Re-renders on
 * browser back/forward.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) {
    return pathname.slice(BASE.length) || "/";
  }
  return pathname;
}

function withBase(path: string): string {
  return BASE + (path.startsWith("/") ? path : "/" + path);
}

function currentSearch(): string {
  return window.location.search || "";
}

function splitPathQuery(target: string): { path: string; search: string } {
  const i = target.indexOf("?");
  if (i < 0) return { path: target, search: "" };
  return { path: target.slice(0, i), search: target.slice(i) };
}

export interface Location {
  path: string;
  /** Full query string including the leading `?`, or "" if absent. */
  search: string;
  /** Convenience accessor for a single query parameter. */
  query: (key: string) => string | null;
  /**
   * Navigate to a new path (and optional `?…` query suffix).  Pass
   * `{ replace: true }` to update without pushing a history entry.
   */
  navigate: (
    pathOrPathQuery: string,
    opts?: { replace?: boolean },
  ) => void;
}

export function useLocation(): Location {
  const [path, setPath] = useState(() => stripBase(window.location.pathname));
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => {
    const onPop = () => {
      setPath(stripBase(window.location.pathname));
      setSearch(currentSearch());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback<Location["navigate"]>((next, opts) => {
    const { path: nextPath, search: nextSearch } = splitPathQuery(next);
    const full = withBase(nextPath) + nextSearch;
    const current =
      window.location.pathname + window.location.search;
    if (full === current) return;
    if (opts?.replace) {
      window.history.replaceState({}, "", full);
    } else {
      window.history.pushState({}, "", full);
    }
    setPath(stripBase(withBase(nextPath)));
    setSearch(nextSearch);
  }, []);

  const query = useCallback(
    (key: string) => new URLSearchParams(search).get(key),
    [search],
  );

  return { path, search, query, navigate };
}
