import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SandboxPreviewProvider } from "@/contexts/SandboxPreviewContext";

export type SandboxLevel = "A1" | "A2" | "B1" | "B2";

export interface SandboxStudent {
  niveau: SandboxLevel;
  email: string;
  user_id: string;
  display_name: string;
  mot_de_passe_initial?: string;
}

interface SandboxSession {
  id: string;
  statut: "provisioning" | "active" | "expired" | "reset";
  group_id: string | null;
  eleve_emails: SandboxStudent[];
  expires_at: string;
  created_at: string;
  group?: { id: string; nom: string } | null;
}

interface SandboxCounts {
  resultats: number;
  devoirs: number;
  sessions: number;
}

interface SandboxContextValue {
  session: SandboxSession | null;
  counts: SandboxCounts;
  loading: boolean;
  displayHint: boolean;
  refresh: () => Promise<void>;
  setup: (forceRecreate?: boolean) => Promise<SandboxStudent[]>;
  reset: (scope: "attempts_only" | "sessions" | "everything") => Promise<Record<string, number>>;
  invite: (niveau: SandboxLevel) => Promise<string>;
  exitSandboxMode: () => Promise<void>;

}

const SandboxContext = createContext<SandboxContextValue | null>(null);
const EMPTY_COUNTS = { resultats: 0, devoirs: 0, sessions: 0 };

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const { role, user } = useAuth();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [counts, setCounts] = useState<SandboxCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [displayHint, setDisplayHint] = useState(
    () =>
      localStorage.getItem("sandbox_mode") === "true" &&
      localStorage.getItem("sandbox_dismissed") !== "true",
  );

  const refresh = useCallback(async () => {
    if (role !== "formateur") {
      setSession(null);
      setCounts(EMPTY_COUNTS);
      setDisplayHint(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sandbox-status");
      if (error) throw error;
      setSession(data?.session ?? null);
      setCounts(data?.counts ?? EMPTY_COUNTS);
      const dismissed = localStorage.getItem("sandbox_dismissed") === "true";
      const visible = !!data?.session && data.session.statut !== "reset" && !dismissed;
      setDisplayHint(visible);
      if (visible) localStorage.setItem("sandbox_mode", "true");
      else if (!data?.session) {
        localStorage.removeItem("sandbox_mode");
        localStorage.removeItem("sandbox_dismissed");
      }
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (user && role === "formateur") void refresh();
  }, [refresh, role, user]);

  useEffect(() => {
    if (!session?.expires_at || session.statut !== "active") return;
    const delay = new Date(session.expires_at).getTime() - Date.now();
    if (delay <= 0) {
      void refresh();
      return;
    }
    const timer = window.setTimeout(() => void refresh(), Math.min(delay + 250, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [refresh, session?.expires_at, session?.statut]);

  const setup = useCallback(async (forceRecreate = false) => {
    const { data, error } = await supabase.functions.invoke("sandbox-setup", {
      body: { force_recreate: forceRecreate },
    });
    if (error) throw error;
    localStorage.setItem("sandbox_mode", "true");
    localStorage.removeItem("sandbox_dismissed");
    setDisplayHint(true);
    await refresh();
    return (data?.eleves ?? []) as SandboxStudent[];
  }, [refresh]);

  const reset = useCallback(async (scope: "attempts_only" | "sessions" | "everything") => {
    const { data, error } = await supabase.functions.invoke("sandbox-reset", {
      body: { scope, sandbox_session_id: session?.id },
    });
    if (error) throw error;
    await refresh();
    return data?.tables_nettoyees ?? {};
  }, [refresh, session?.id]);

  const invite = useCallback(async (niveau: SandboxLevel) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}#/eleve`;
    const { data, error } = await supabase.functions.invoke("sandbox-invite", {
      body: { niveau, redirect_to: redirectTo },
    });
    if (error) throw error;
    return data.invite_url as string;
  }, []);

  const exitSandboxMode = useCallback(async () => {
    localStorage.setItem("sandbox_dismissed", "true");
    localStorage.removeItem("sandbox_mode");
    setDisplayHint(false);
    const { error } = await supabase.functions.invoke("sandbox-reset", {
      body: { scope: "everything", sandbox_session_id: session?.id },
    });
    if (error) throw error;
    setSession(null);
    setCounts(EMPTY_COUNTS);
  }, [session?.id]);

  const value = useMemo(
    () => ({ session, counts, loading, displayHint, refresh, setup, reset, invite, exitSandboxMode }),
    [session, counts, loading, displayHint, refresh, setup, reset, invite, exitSandboxMode],
  );


  const previewActive =
    displayHint &&
    session?.statut === "active" &&
    new Date(session.expires_at).getTime() > Date.now();

  return (
    <SandboxContext.Provider value={value}>
      <SandboxPreviewProvider active={previewActive}>
        {children}
      </SandboxPreviewProvider>
    </SandboxContext.Provider>
  );
}

export function useSandbox() {
  const context = useContext(SandboxContext);
  if (!context) throw new Error("useSandbox must be used within SandboxProvider");
  return context;
}
