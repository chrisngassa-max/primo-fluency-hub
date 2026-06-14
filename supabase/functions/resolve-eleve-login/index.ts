import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LoginHintCode =
  | "email_not_found"
  | "wrong_password"
  | "pending_approval"
  | "consent_missing"
  | "not_eleve";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json(400, { error: "email required" });
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, status, email")
    .eq("email", email)
    .maybeSingle();
  if (profileErr) {
    console.error("[resolve-eleve-login] profile lookup failed:", profileErr.message);
    return json(500, { error: "lookup_failed" });
  }

  if (!profile) {
    return json(200, { code: "email_not_found" as LoginHintCode });
  }

  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (roleErr) {
    console.error("[resolve-eleve-login] role lookup failed:", roleErr.message);
    return json(500, { error: "lookup_failed" });
  }

  if (roleRow?.role !== "eleve") {
    return json(200, { code: "not_eleve" as LoginHintCode });
  }

  if (profile.status === "pending") {
    return json(200, { code: "pending_approval" as LoginHintCode });
  }

  const { data: consent, error: consentErr } = await admin
    .from("ai_processing_consents")
    .select("consent_ai, consent_biometric, revoked_at")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (consentErr) {
    console.error("[resolve-eleve-login] consent lookup failed:", consentErr.message);
    return json(500, { error: "lookup_failed" });
  }

  const hasConsent =
    !!consent &&
    consent.consent_ai === true &&
    consent.consent_biometric === true &&
    !consent.revoked_at;

  if (!hasConsent) {
    return json(200, { code: "consent_missing" as LoginHintCode });
  }

  // Account exists and is eligible — caller should treat failed sign-in as wrong password.
  return json(200, { code: "wrong_password" as LoginHintCode });
});
