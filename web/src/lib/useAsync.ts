"use client";
import { useEffect, useRef, useState } from "react";

export type Async<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

type State<T> = { data: T | null; error: string | null; loading: boolean };
const PENDING = { data: null, error: null, loading: true };

/**
 * One request, three states. `deps` re-runs it; `reload` retries after a failure.
 * The reset lives in render (the sanctioned "adjust state when input changes"
 * path) so the effect only ever sets state from the settled promise.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const key = JSON.stringify(deps);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>(PENDING);
  const [seen, setSeen] = useState(key);

  // fn is a fresh closure every render; keep the latest without making it a
  // dependency. This effect is declared first, so it lands before the fetch.
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  if (seen !== key) {
    setSeen(key);
    setState(PENDING);
  }

  useEffect(() => {
    let live = true;
    fnRef.current().then(
      (data) => { if (live) setState({ data, error: null, loading: false }); },
      (e) => { if (live) setState({ data: null, error: e?.message ?? "Something went wrong.", loading: false }); },
    );
    return () => { live = false; };
  }, [key, nonce]);

  return { ...state, reload: () => { setState(PENDING); setNonce((x) => x + 1); } };
}
