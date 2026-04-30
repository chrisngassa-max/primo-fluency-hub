import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { checkConsent, consentBlockedResponse, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";
import { pseudonymize, pseudonymizeText } from "../_shared/pseudonymize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { eleveNom, eleveId, profil, levels, recentResults, testEntree, failures } = await req.json();
    const triggeredBy = await getUserIdFromAuth(req);
    const subjectId = eleveId || triggeredBy;

    const secretBlock = await ensurePseudonymSecretOrLog("analyze-student-progress", corsHeaders, subjectId);
    if (secretBlock) return secretBlock;

    if (subjectId) {
      const consent = await checkConsent({ userId: subjectId });
      if (!consent.ok) {
        await logAICall({ function_name: "analyze-student-progress", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: ["profile", "results"], pseudonymization_level: "hmac_sha256" });
        return consentBlockedResponse(consent.reason || "consent_required", corsHeaders);
      }
    }
    const pseudoNom = subjectId ? await pseudonymize(subjectId, "eleve") : "eleve_anon";
    await logAICall({ function_name: "analyze-student-progress", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "ok", data_categories: ["profile", "results"], pseudonymization_level: "hmac_sha256" });
    // AI key check moved to shared ai-client

    const systemPrompt = `Tu es un conseiller pédagogique expert en FLE (Français Langue Étrangère) spécialisé dans la préparation au TCF IRN (niveau A1).
Tu analyses le profil d'un élève adulte primo-arrivant et tu fournis des recommandations précises et actionnables.
Réponds en français. Structure ta réponse en 3 sections :
1. **Diagnostic des blocages** : Identifie les compétences et points spécifiques où l'élève échoue régulièrement.
2. **Points de travail immédiats** : 3 à 5 axes prioritaires concrets à travailler en classe ou en autonomie.
3. **Exercices recommandés** : Propose 3 à 5 types d'exercices spécifiques (avec format et thème) adaptés au niveau actuel de l'élève.
Sois concis, bienveillant et pragmatique.`;

    const userPrompt = `Analyse le profil de l'élève "${eleveNom}" :

**Profil actuel :**
- Niveau : ${profil?.niveau_actuel || "non évalué"}
- Score moyen global : ${profil ? Math.round(Number(profil.taux_reussite_global)) : 0}%
- CO : ${profil ? Math.round(Number(profil.taux_reussite_co)) : 0}% | CE : ${profil ? Math.round(Number(profil.taux_reussite_ce)) : 0}% | EE : ${profil ? Math.round(Number(profil.taux_reussite_ee)) : 0}% | EO : ${profil ? Math.round(Number(profil.taux_reussite_eo)) : 0}%
- Score de risque : ${profil ? Math.round(Number(profil.score_risque)) : 0}/100

**Niveaux validés (0-10) :**
${(levels || []).map((l: any) => `- ${l.competence} : Niveau ${l.niveau_actuel}`).join("\n") || "Aucun niveau validé"}

**Test d'entrée :**
${testEntree ? `Score global : ${testEntree.score_global}% | Niveau estimé : ${testEntree.niveau_estime}` : "Pas de test d'entrée"}

**Derniers résultats :**
${(recentResults || []).map((r: any) => `- ${r.titre} (${r.competence}, diff. ${r.difficulte}) → ${r.score}%`).join("\n") || "Aucun résultat"}

**Points d'échec récurrents :**
${(failures || []).map((f: any) => `- "${f.titre}" (${f.competence}) : ${f.score}% en moyenne, ${f.count} échec(s)`).join("\n") || "Aucun échec récurrent"}`;

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
    console.error("analyze-student-progress error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
