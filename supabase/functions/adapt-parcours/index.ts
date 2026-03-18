import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const {
      mode, // "respecter_chrono" | "garder_exigence"
      parcoursTitle,
      niveauDepart,
      niveauCible,
      heuresTotalesPrevues,
      seancesRestantes, // array of remaining planned sessions
      retard, // { exercicesNonFaits: number, minutesRetard: number }
      seanceActuelle, // current session info
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN.
Un formateur a pris du retard sur son plan de formation. Tu dois adapter les séances restantes.

MODE "${mode === "respecter_chrono" ? "RESPECTER LE CHRONO" : "GARDER L'EXIGENCE"}" :
${mode === "respecter_chrono"
  ? `Le volume horaire total ne doit PAS changer. Tu dois :
- Fusionner des concepts quand c'est possible
- Supprimer des exercices secondaires
- Prioriser les compétences les plus faibles
- Garder le même nombre de séances restantes mais les alléger`
  : `Tous les exercices prévus doivent être maintenus. Tu dois :
- Répartir le retard sur des séances supplémentaires
- Ajouter une ou plusieurs séances à la fin du parcours
- Le volume horaire total va augmenter
- Maintenir la qualité pédagogique`}

Compétences TCF IRN : CO, CE, EE, EO, Structures.`;

    const userPrompt = `Parcours "${parcoursTitle}" (${niveauDepart} → ${niveauCible})
Volume prévu : ${heuresTotalesPrevues}h
Retard détecté : ${retard?.exercicesNonFaits || 0} exercices non faits, ~${retard?.minutesRetard || 0} min de retard

Séance actuelle : ${seanceActuelle?.titre || "N/A"}

Séances restantes à adapter (${seancesRestantes?.length || 0}) :
${(seancesRestantes || []).map((s: any, i: number) => 
  `${i+1}. ${s.titre} — ${s.duree_minutes}min — ${s.competences_cibles?.join(",")} — ${s.nb_exercices_suggeres} exercices`
).join("\n")}

Propose le nouveau planning adapté.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "adapt_parcours",
                description: "Retourne le parcours adapté",
                parameters: {
                  type: "object",
                  properties: {
                    message_formateur: { type: "string", description: "Résumé court des changements pour le formateur" },
                    heures_totales_ajustees: { type: "number" },
                    seances_adaptees: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          titre: { type: "string" },
                          objectif_principal: { type: "string" },
                          competences_cibles: {
                            type: "array",
                            items: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                          },
                          duree_minutes: { type: "number" },
                          nb_exercices_suggeres: { type: "number" },
                          est_nouvelle: { type: "boolean", description: "true si c'est une séance ajoutée" },
                        },
                        required: ["titre", "objectif_principal", "competences_cibles", "duree_minutes", "nb_exercices_suggeres"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["message_formateur", "heures_totales_ajustees", "seances_adaptees"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "adapt_parcours" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu adapter le parcours");

    const adaptation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ adaptation }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("adapt-parcours error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
