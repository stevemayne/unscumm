import { useCallback, useEffect, useState } from "react";

/**
 * Minimal URL-driven state.  Exposes the portion of `window.location.pathname`
 * after Vite's configured BASE_URL, plus a `navigate` helper that
 * pushes/replaces history entries.  Re-renders on browser back/forward.
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

export interface Location {
  path: string;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
}

export function useLocation(): Location {
  const [path, setPath] = useState(() => stripBase(window.location.pathname));

  useEffect(() => {
    const onPop = () => setPath(stripBase(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback<Location["navigate"]>((next, opts) => {
    const full = withBase(next);
    if (full === window.location.pathname) return;
    if (opts?.replace) {
      window.history.replaceState({}, "", full);
    } else {
      window.history.pushState({}, "", full);
    }
    setPath(stripBase(full));
  }, []);

  return { path, navigate };
}
