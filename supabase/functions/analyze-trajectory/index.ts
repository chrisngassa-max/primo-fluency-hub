import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { groupNom, trajectoryData, totalSeances } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Analyse indisponible.";
    return new Response(JSON.stringify({ analysis: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-trajectory error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
