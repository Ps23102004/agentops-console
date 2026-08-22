"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useLocal } from "@/lib/useLocal";

type Ctx = {
  sessions: Session[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  current: Session | null;
  setCurrentId: (id: string) => void;
};

const SessionCtx = createContext<Ctx | null>(null);
const KEY = "agentops.session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useAsync(() => api.sessions(), []);
  const [id, setId] = useLocal(KEY, "");

  const current = useMemo(() => {
    if (!data?.length) return null;
    return data.find((s) => s.id === id) ?? data[0];
  }, [data, id]);

  const value: Ctx = {
    sessions: data, loading, error, reload, current,
    setCurrentId: setId,
  };
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSessions() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSessions must be used inside SessionProvider");
  return c;
}
