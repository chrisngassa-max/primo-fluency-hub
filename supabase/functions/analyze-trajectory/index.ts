import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { checkConsentBatch, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { groupNom, trajectoryData, totalSeances, eleveIds } = await req.json();
    const triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("analyze-trajectory", corsHeaders, null);
    if (secretBlock) return secretBlock;

    // RGPD: si les données contiennent des noms d'élèves nominatifs, eleveIds est requis.
    const hasNominative = Array.isArray(trajectoryData) && trajectoryData.some((p: any) => p?.eleves && Object.keys(p.eleves).length > 0);
    if (hasNominative && (!Array.isArray(eleveIds) || eleveIds.length === 0)) {
      await logAICall({ function_name: "analyze-trajectory", triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: ["nominative"], pseudonymization_level: "none" });
      return new Response(JSON.stringify({ error: "missing_subject_ids", message: "eleveIds est requis quand des données nominatives sont envoyées." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let excludedIds: string[] = [];
    if (Array.isArray(eleveIds) && eleveIds.length > 0) {
      const batch = await checkConsentBatch(eleveIds);
      excludedIds = batch.excludedIds;
      if (batch.allowedIds.length === 0) {
        await logAICall({ function_name: "analyze-trajectory", triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: ["aggregated_results"], pseudonymization_level: "hmac_sha256" });
        return new Response(JSON.stringify({ error: "consent_required", excludedIds, degraded_mode: true, message: "Aucun élève consentant." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    await logAICall({ function_name: "analyze-trajectory", triggered_by_user_id: triggeredBy, status: "ok", data_categories: hasNominative ? ["nominative"] : ["aggregated_results"], pseudonymization_level: hasNominative ? "hmac_sha256" : "none" });
    // AI key check moved to shared ai-client

    const systemPrompt = `Tu es un analyste pédagogique expert en FLE (Français Langue Étrangère) spécialisé dans la préparation au TCF IRN.
Tu analyses la courbe de trajectoire d'un groupe d'élèves en comparant leur progression réelle à la courbe cible (objectif niveau 10 = TCF A1 en fin de formation).

Réponds en français. Structure ta réponse en 4 sections :
1. **Tendance générale** : Le groupe est-il en avance, dans la cible, ou en retard ?
2. **Causes de progression** : Identifie les séances où il y a eu une hausse significative et propose des hypothèses (ex: "La hausse en Séance 3 est liée à…").
3. **Hypothèses de blocage** : Identifie les plateaux ou baisses et propose des hypothèses pour chaque élève concerné.
4. **Projection** : À ce rythme, quand le groupe atteindra-t-il le niveau 10 ? Propose un ajustement si nécessaire.

Sois concis, factuel et actionnable. Utilise les noms des élèves et les numéros de séances.`;

    const seancesDetail = (trajectoryData || []).map((s: any) => {
      const elevesStr = Object.entries(s.eleves || {})
        .map(([nom, val]) => `${nom}: ${val ?? "absent"}`)
        .join(", ");
      return `Séance ${s.seance} "${s.titre}" (${s.date ? new Date(s.date).toLocaleDateString("fr-FR") : "?"}) — Cible: ${s.cible} | Groupe: ${s.groupe} | Compétences: ${(s.competences || []).join(", ") || "—"} | Élèves: ${elevesStr}`;
    }).join("\n");

    const userPrompt = `Analyse la trajectoire du groupe "${groupNom}" (${totalSeances} séances prévues) :

${seancesDetail}

La courbe cible va de 0 (Séance 1) à 10 (Séance ${totalSeances}).
Identifie les inflexions, les élèves en difficulté, et propose une projection.`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    const content = data.choices?.[0]?.message?.content || "Analyse indisponible.";
    return new Response(JSON.stringify({ analysis: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-trajectory error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
