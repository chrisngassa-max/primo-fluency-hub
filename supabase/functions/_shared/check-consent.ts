// Shared helpers for RGPD-compliant AI calls
// Uses service_role to check consent and write logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface ConsentCheckOptions {
  userId: string;
  requireBiometric?: boolean;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export async function checkConsent({ userId, requireBiometric = false }: ConsentCheckOptions): Promise<{
  ok: boolean;
  consentVersion?: string;
  reason?: string;
}> {
  if (!userId) return { ok: false, reason: "missing_user_id" };
  const supa = adminClient();
  const { data, error } = await supa
    .from("ai_processing_consents")
    .select("consent_ai, consent_biometric, revoked_at, version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, reason: "consent_check_failed" };
  if (!data) return { ok: false, reason: "consent_missing" };
  if (data.revoked_at) return { ok: false, reason: "consent_revoked" };
  if (!data.consent_ai) return { ok: false, reason: "consent_ai_missing" };
  if (requireBiometric && !data.consent_biometric) return { ok: false, reason: "consent_biometric_missing" };

  return { ok: true, consentVersion: data.version };
}

export interface AILogEntry {
  subject_user_id?: string | null;
  triggered_by_user_id?: string | null;
  function_name: string;
  provider?: string;
  model?: string;
  data_categories?: string[];
  pseudonymization_level?: string;
  status: "ok" | "blocked_no_consent" | "error" | "skipped";
  duration_ms?: number;
  consent_version?: string;
}

export async function logAICall(entry: AILogEntry): Promise<void> {
  try {
    const supa = adminClient();
    await supa.from("ai_processing_logs").insert(entry);
  } catch (err) {
    console.error("[ai-log] failed", err);
  }
}

/** Standard 403 response when consent is missing. */
export function consentBlockedResponse(reason: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "consent_required",
      reason,
      message:
        "Le traitement IA et le traitement vocal sont nécessaires à l'exécution de la formation sur captcf.fr.",
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/** Resolve userId from an Authorization Bearer JWT. Returns null if unauthenticated. */
export async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data, error } = await supa.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}
