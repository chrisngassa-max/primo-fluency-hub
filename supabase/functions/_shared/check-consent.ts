// Shared helpers for RGPD-compliant AI calls.
// Uses service_role to check consent and write logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasPseudonymSecret } from "./pseudonymize.ts";

export interface ConsentCheckOptions {
  userId: string;
  requireBiometric?: boolean;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
  if (requireBiometric && !data.consent_biometric) {
    return { ok: false, reason: "consent_biometric_missing" };
  }

  return { ok: true, consentVersion: data.version };
}

export interface BatchConsentResult {
  allowedIds: string[];
  excludedIds: string[];
  versions: Record<string, string>;
}

/** Batch consent check for multiple subjects (Category B functions). */
export async function checkConsentBatch(
  userIds: string[],
  options: { requireBiometric?: boolean } = {},
): Promise<BatchConsentResult> {
  const requireBiometric = options.requireBiometric ?? false;
  const allowedIds: string[] = [];
  const excludedIds: string[] = [];
  const versions: Record<string, string> = {};
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return { allowedIds, excludedIds, versions };

  const supa = adminClient();
  const { data, error } = await supa
    .from("ai_processing_consents")
    .select("user_id, consent_ai, consent_biometric, revoked_at, version")
    .in("user_id", unique);

  if (error) {
    return { allowedIds: [], excludedIds: unique, versions };
  }

  const byId = new Map<string, any>();
  (data ?? []).forEach((row: any) => byId.set(row.user_id, row));

  for (const id of unique) {
    const row = byId.get(id);
    if (!row || row.revoked_at || !row.consent_ai || (requireBiometric && !row.consent_biometric)) {
      excludedIds.push(id);
    } else {
      allowedIds.push(id);
      versions[id] = row.version;
    }
  }
  return { allowedIds, excludedIds, versions };
}

export interface AILogEntry {
  subject_user_id?: string | null;
  triggered_by_user_id?: string | null;
  function_name: string;
  provider?: string;
  model?: string;
  data_categories?: string[];
  pseudonymization_level?: string;
  status:
    | "ok"
    | "blocked_no_consent"
    | "error"
    | "skipped"
    | "error_missing_pseudonym_secret";
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
      degraded_mode: true,
      message:
        "Cette formation nécessite le consentement IA et voix pour fonctionner.",
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** 500 response when AI_PSEUDONYM_SECRET is missing on the server. */
export function pseudonymSecretMissingResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "server_misconfigured",
      reason: "missing_pseudonym_secret",
      message:
        "Le secret de pseudonymisation IA n'est pas configuré côté serveur. Contactez l'administrateur.",
    }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Guard: returns null if OK, or an HTTP response to short-circuit if secret is missing. */
export async function ensurePseudonymSecretOrLog(
  functionName: string,
  corsHeaders: Record<string, string>,
  subjectUserId?: string | null,
): Promise<Response | null> {
  if (hasPseudonymSecret()) return null;
  await logAICall({
    subject_user_id: subjectUserId ?? null,
    triggered_by_user_id: subjectUserId ?? null,
    function_name: functionName,
    status: "error_missing_pseudonym_secret",
    data_categories: [],
    pseudonymization_level: "none",
  });
  return pseudonymSecretMissingResponse(corsHeaders);
}

/** Resolve userId from an Authorization Bearer JWT. Returns null if unauthenticated. */
export async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id as string;
}
