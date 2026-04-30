import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { checkConsent, consentBlockedResponse, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";
import { pseudonymize } from "../_shared/pseudonymize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scores, eleveNom, eleveId, detailScores, globalAvg, niveauEstime } = await req.json();
    const triggeredBy = await getUserIdFromAuth(req);
    const subjectId = eleveId || triggeredBy;
    const secretBlock = await ensurePseudonymSecretOrLog("analyze-test-entree", corsHeaders, subjectId);
    if (secretBlock) return secretBlock;
    if (subjectId) {
      const consent = await checkConsent({ userId: subjectId });
      if (!consent.ok) {
        await logAICall({ function_name: "analyze-test-entree", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: ["test_results"], pseudonymization_level: "hmac_sha256" });
        return consentBlockedResponse(consent.reason || "consent_required", corsHeaders);
      }
    }
    const pseudoNom = subjectId ? await pseudonymize(subjectId, "eleve") : "eleve_anon";
    await logAICall({ function_name: "analyze-test-entree", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "ok", data_categories: ["test_results"], pseudonymization_level: "hmac_sha256" });
    // AI key check moved to shared ai-client

    const systemPrompt = `Tu es un expert en FLE spécialisé dans la préparation au TCF IRN.
Tu analyses les scores d'évaluation détaillés d'un élève primo-arrivant et fournis un diagnostic de départ complet.
Sois concis, pratique et bienveillant. Écris en français. Structure ta réponse avec des titres en markdown.

IMPORTANT : Chaque sous-item est évalué de 0 à 100. Le niveau de difficulté correspondant (0-10) est calculé automatiquement (score/10).
- 0-30 = Zone critique (rouge) → priorité absolue
- 31-70 = Zone de travail (orange) → à consolider
- 71-100 = Zone de confort (vert) → acquis ou en bonne voie

Tu dois :
1. Identifier les sous-items critiques (< 30) et proposer des actions immédiates
2. Donner un niveau CECRL estimé
3. Proposer un plan de priorités pédagogiques
4. Recommander des exercices spécifiques pour chaque zone critique
5. Suggérer le niveau de difficulté de départ pour les exercices (échelle 0-10)`;

    let userPrompt = `Voici les scores d'évaluation de l'élève ${pseudoNom} :\n\n`;

    if (detailScores) {
      for (const [comp, data] of Object.entries(detailScores as Record<string, any>)) {
        userPrompt += `## ${comp} — Moyenne : ${data.moyenne}/100 (Niveau ${data.niveau_difficulte}/10)\n`;
        for (const si of data.sous_items) {
          const zone = si.score <= 30 ? "🔴" : si.score <= 70 ? "🟠" : "🟢";
          userPrompt += `  ${zone} ${si.item} : ${si.score}/100 (Niv. ${si.niveau_difficulte})\n`;
        }
        userPrompt += "\n";
      }
      userPrompt += `Score global moyen : ${globalAvg}/100\nNiveau CECRL estimé automatiquement : ${niveauEstime}\n`;
    } else {
      userPrompt += `- Compréhension Orale (CO) : ${scores.CO}/100\n`;
      userPrompt += `- Compréhension Écrite (CE) : ${scores.CE}/100\n`;
      userPrompt += `- Expression Orale (EO) : ${scores.EO}/100\n`;
      userPrompt += `- Expression Écrite (EE) : ${scores.EE}/100\n\n`;
      userPrompt += `Score moyen : ${Math.round((scores.CO + scores.CE + scores.EO + scores.EE) / 4)}/100\n`;
    }

    userPrompt += `\nDonne un diagnostic de départ complet avec :
1. Niveau CECRL estimé (A0, A1, A2, B1)
2. Les sous-items critiques à traiter en priorité
3. Les priorités pédagogiques (3 max)
4. Le niveau de difficulté recommandé pour démarrer les exercices (0-10)
5. Des exercices recommandés pour chaque zone critique`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    return new Response(JSON.stringify({ analysis: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-test-entree error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
