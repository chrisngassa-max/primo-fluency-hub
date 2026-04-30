import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkConsent, consentBlockedResponse, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";
import { pseudonymizeProductionText } from "../_shared/pseudonymize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { criteres_evaluation, reponse_apprenant, metadata } = await req.json();
    const triggeredBy = await getUserIdFromAuth(req);
    const subjectId = metadata?.eleveId || triggeredBy;
    const isOralCheck = (metadata?.code || "").startsWith("EO") || metadata?.type_reponse === "oral";
    const secretBlock = await ensurePseudonymSecretOrLog("evaluate-test-response", corsHeaders, subjectId);
    if (secretBlock) return secretBlock;
    if (subjectId) {
      const consent = await checkConsent({ userId: subjectId, requireBiometric: isOralCheck });
      if (!consent.ok) {
        await logAICall({ function_name: "evaluate-test-response", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: isOralCheck ? ["production", "voice"] : ["production"], pseudonymization_level: "none" });
        return consentBlockedResponse(consent.reason || "consent_required", corsHeaders);
      }
    }
    await logAICall({ function_name: "evaluate-test-response", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "ok", data_categories: isOralCheck ? ["production", "voice"] : ["production"], pseudonymization_level: "level_b" });

    // === RGPD niveau B : pseudonymisation de la production ===
    let knownNames: string[] = [];
    if (subjectId) {
      try {
        const supaAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: prof } = await supaAdmin.from("profiles").select("nom, prenom, email").eq("id", subjectId).maybeSingle();
        if (prof) knownNames = [prof.prenom, prof.nom, prof.email].filter(Boolean) as string[];
      } catch (_) { /* best-effort */ }
    }
    let safeReponse: string;
    try {
      safeReponse = await pseudonymizeProductionText(String(reponse_apprenant ?? ""), knownNames);
    } catch (_pseudoErr) {
      await logAICall({ function_name: "evaluate-test-response", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "error_missing_pseudonym_secret", data_categories: ["production"], pseudonymization_level: "none" });
      return new Response(JSON.stringify({ error: "pseudonymization_failed", message: "Impossible de pseudonymiser la production." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // AI key check moved to shared ai-client

    // Determine if this is an oral response (EO) for high-tolerance mode
    const code = metadata?.code || "";
    const isOral = code.startsWith("EO") || metadata?.type_reponse === "oral";

    const toleranceBlock = isOral
      ? `

TOLÉRANCE PHONÉTIQUE ÉLEVÉE (CRITIQUE pour les réponses orales transcrites par STT) :
La réponse a été TRANSCRITE automatiquement depuis un enregistrement vocal d'un apprenant de niveau A0-A1. Le moteur Speech-to-Text fait des erreurs fréquentes, surtout avec un accent étranger.

Tu DOIS :
1. Accepter les homophones et approximations phonétiques (ex: "doctère" → "docteur", "mal e dent" → "mal de dent", "bonjoure" → "bonjour", "je mapelle" → "je m'appelle").
2. Ignorer la ponctuation, la casse et les espaces superflus.
3. Reconnaître l'INTENTION de l'apprenant même si la forme est imparfaite.
4. Valider les mots-clés phonétiquement proches (distance de Levenshtein ≤ 3 pour les mots courts).
5. Ne PAS pénaliser les erreurs clairement dues au STT (mots coupés, répétitions, hésitations "euh").
6. Évaluer la COMMUNICATION réussie, pas la perfection linguistique.`
      : "";

    const keywordsBlock = metadata?.mots_cles_attendus?.length
      ? `\nMots-clés attendus (valider même avec approximation phonétique) : ${metadata.mots_cles_attendus.join(", ")}`
      : "";

    const systemPrompt = `Tu es un évaluateur de français langue étrangère niveau A0-A1, spécialisé TCF IRN.
Évalue cette production selon les critères suivants : ${JSON.stringify(criteres_evaluation)}.${keywordsBlock}${toleranceBlock}

Donne un score de 0 à 3 et une justification courte en français (max 2 phrases). Sois ENCOURAGEANT — valorise les réussites même partielles.
Réponds uniquement en JSON : {"score": number, "justification": string}`;

    const data = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: safeReponse },
      ],
    });

    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({
        score: Math.min(3, Math.max(0, Math.round(parsed.score ?? 0))),
        justification: parsed.justification ?? "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("evaluate-test-response error:", e);
    return new Response(
      JSON.stringify({
        score: 0,
        justification: "Erreur lors de l'évaluation.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
