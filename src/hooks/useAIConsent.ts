import { consentTimestamps } from "@/lib/homeworkConsent";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const CONSENT_VERSION = "v1.0";

export interface AIConsent {
  user_id: string;
  consent_ai: boolean;
  consent_biometric: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  version: string;
  updated_at: string;
}

export function useAIConsent() {
  const { user } = useAuth();
  const [consent, setConsent] = useState<AIConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    if (!user) {
      setResolvedUserId(null);
      setConsent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_processing_consents" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (current !== sequence.current) return;
    setResolvedUserId(user.id);
    if (error) console.error("[useAIConsent]", error);
    setConsent((data as any) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
    const changed = () => { void refresh(); };
    window.addEventListener("captcf:consent-changed", changed);
    return () => { ++sequence.current; window.removeEventListener("captcf:consent-changed", changed); };
  }, [refresh]);

  const accept = useCallback(
    async (consent_ai: boolean, consent_biometric: boolean, source = "modal") => {
      if (!user) return { error: new Error("not authenticated") };
      const payload = {
        user_id: user.id,
        consent_ai,
        consent_biometric,
        ...consentTimestamps(consent_ai, consent_biometric, new Date().toISOString()),
        version: CONSENT_VERSION,
        source,
      };
      const { error } = await supabase
        .from("ai_processing_consents" as any)
        .upsert(payload, { onConflict: "user_id" });
      if (!error) { await refresh(); window.dispatchEvent(new Event("captcf:consent-changed")); }
      return { error };
    },
    [user, refresh]
  );

  const isFullyGranted = !!consent && consent.consent_ai && consent.consent_biometric && !consent.revoked_at;
  const hasAnswered = !!consent;

  const unresolved = loading || resolvedUserId !== (user?.id ?? null);
  return { consent: unresolved ? null : consent, loading: unresolved, refresh, accept, isFullyGranted: !unresolved && isFullyGranted, hasAnswered: !unresolved && hasAnswered };
}
