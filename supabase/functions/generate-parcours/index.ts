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
    const { heuresTotales, niveauDepart, niveauCible, dureeSeanceMinutes = 90, type_demarche = 'titre_sejour' } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!heuresTotales || !niveauDepart || !niveauCible) {
      return new Response(
        JSON.stringify({ error: "heuresTotales, niveauDepart et niveauCible sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN.
Tu conçois des parcours de formation pour adultes primo-arrivants.

On te donne :
- Le volume horaire total disponible
- Le niveau de départ et le niveau cible (CECRL)
- La durée type d'une séance

Tu dois découper ce volume en séances cohérentes avec une progression pédagogique logique.

Compétences TCF IRN : CO (Compréhension Orale), CE (Compréhension Écrite), EE (Expression Écrite), EO (Expression Orale), Structures (Grammaire/Vocabulaire).

Règles :
- Alterner les compétences pour éviter la monotonie
- Commencer par CO et CE (réception) avant EE et EO (production)
- Les Structures doivent être réparties tout au long du parcours
- Prévoir des séances de révision/évaluation intermédiaires
- Le nombre d'exercices doit être proportionnel à la durée de la séance`;

    const userPrompt = `Génère un parcours de formation FLE/TCF IRN :
- Volume total : ${heuresTotales} heures
- Niveau de départ : ${niveauDepart}
- Niveau cible : ${niveauCible}
- Durée type d'une séance : ${dureeSeanceMinutes} minutes

Propose le découpage complet en séances.`;

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
                name: "generate_progression",
                description: "Génère le découpage du parcours en séances",
                parameters: {
                  type: "object",
                  properties: {
                    seances: {
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
                        },
                        required: ["titre", "objectif_principal", "competences_cibles", "duree_minutes", "nb_exercices_suggeres"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["seances"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_progression" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez." }),
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
    if (!toolCall) throw new Error("L'IA n'a pas pu générer la progression");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ seances: parsed.seances || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-parcours error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
