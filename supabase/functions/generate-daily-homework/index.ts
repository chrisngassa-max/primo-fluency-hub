import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sessionId, dailyDuration, targetDays, targetWeaknesses, formateurId } = await req.json();

    if (!sessionId || !dailyDuration || !targetDays || !formateurId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch session info
    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("*, group:groups(id, nom, niveau)")
      .eq("id", sessionId)
      .single();
    if (sessErr || !session) throw new Error("Session not found");

    const groupId = session.group_id;
    const niveauCible = session.niveau_cible || "A1";

    // 2. Fetch group members
    const { data: members } = await supabase
      .from("group_members")
      .select("eleve_id")
      .eq("group_id", groupId);
    if (!members?.length) throw new Error("No students in group");

    const eleveIds = members.map((m: any) => m.eleve_id);

    // 3. Fetch session exercises (what was taught)
    const { data: sessionExercices } = await supabase
      .from("session_exercices")
      .select("exercice:exercices(id, competence, format, difficulte, titre, contenu)")
      .eq("session_id", sessionId);

    const taughtExercises = (sessionExercices ?? [])
      .map((se: any) => se.exercice)
      .filter(Boolean);

    // 4. If targeting weaknesses, fetch bilan test results
    let studentWeaknesses: Record<string, Record<string, number>> = {};
    if (targetWeaknesses) {
      const { data: bilanTests } = await supabase
        .from("bilan_tests")
        .select("id")
        .eq("session_id", sessionId)
        .eq("statut", "envoye")
        .limit(1);

      if (bilanTests?.length) {
        const { data: results } = await supabase
          .from("bilan_test_results")
          .select("eleve_id, scores_par_competence")
          .eq("bilan_test_id", bilanTests[0].id);

        (results ?? []).forEach((r: any) => {
          const scores: Record<string, number> = {};
          if (r.scores_par_competence && typeof r.scores_par_competence === "object") {
            for (const [comp, info] of Object.entries(r.scores_par_competence as Record<string, any>)) {
              scores[comp] = info.pct ?? 0;
            }
          }
          studentWeaknesses[r.eleve_id] = scores;
        });
      }
    }

    // 5. Fetch student competency levels
    const { data: studentLevels } = await supabase
      .from("student_competency_levels")
      .select("eleve_id, competence, niveau_actuel")
      .in("eleve_id", eleveIds);

    const levelMap: Record<string, Record<string, number>> = {};
    (studentLevels ?? []).forEach((sl: any) => {
      if (!levelMap[sl.eleve_id]) levelMap[sl.eleve_id] = {};
      levelMap[sl.eleve_id][sl.competence] = sl.niveau_actuel;
    });

    // 6. Fetch a default point_a_maitriser for exercise creation
    const { data: defaultPoint } = await supabase
      .from("points_a_maitriser")
      .select("id")
      .limit(1)
      .single();
    if (!defaultPoint) throw new Error("No points_a_maitriser found");

    // 7. Build AI prompt for daily homework plan
    const competencesUsed = [...new Set(taughtExercises.map((e: any) => e.competence))];
    const exerciseSummary = taughtExercises.map((e: any) =>
      `- ${e.titre} (${e.competence}, ${e.format}, diff ${e.difficulte}/5)`
    ).join("\n");

    const systemPrompt = `Tu es un expert en didactique du FLE spécialisé dans la préparation au TCF IRN.
Tu dois concevoir un programme de devoirs quotidiens étalé sur ${targetDays} jour(s).

CONTRAINTES TEMPORELLES STRICTES :
- Budget quotidien : ${dailyDuration} minutes par jour
- Durées estimées par type d'exercice :
  * CO (compréhension orale) : 45 secondes par item + 30s de lecture
  * CE (compréhension écrite) : 3 minutes par exercice
  * EE (expression écrite) : 3 minutes par exercice  
  * EO (expression orale) : 2 minutes par exercice
  * Structures (grammaire) : 1.5 minutes par exercice
  * QCM/vrai_faux : 30 secondes par item
  * Appariement : 2 minutes par exercice
  * Texte lacunaire : 2 minutes par exercice

Tu dois calculer le nombre d'exercices pour atteindre exactement ${dailyDuration} minutes.

RÈGLES PÉDAGOGIQUES :
- Varier les compétences chaque jour (ne pas faire que du CE)
- Jour 1-2 : reprendre les exercices vus en classe (consolidation)
- Jour 3+ : introduire de nouvelles variations (remédiation)
- Progression spiralaire : revenir sur les points faibles
- Respecter le niveau CECRL ${niveauCible}

FORMATS D'EXERCICE SUPPORTÉS : qcm, vrai_faux, appariement, texte_lacunaire, transformation
Pour CO : ajouter un champ "script_audio" (texte que le TTS lira)
Pour EO : utiliser le format "production_orale" avec consigne orale

STRUCTURE DE SORTIE (JSON via tool calling) :
Un tableau "jours" où chaque jour contient un tableau "exercices".
Chaque exercice : { titre, consigne, competence, format, difficulte (1-5), contenu: { items: [{ question, options?, bonne_reponse, explication, script_audio? }] }, duree_estimee_minutes }`;

    const weaknessInfo = targetWeaknesses && Object.keys(studentWeaknesses).length > 0
      ? `\n\nFAIBLESSES DÉTECTÉES AU TEST DE SÉANCE :\n${Object.entries(studentWeaknesses).map(([_, scores]) =>
          Object.entries(scores).filter(([, pct]) => pct < 60).map(([comp, pct]) => `${comp}: ${pct}%`).join(", ")
        ).filter(Boolean).join("\n")}\nPriorise ces compétences dans le programme.`
      : "";

    const userPrompt = `Séance "${session.titre}" — Niveau ${niveauCible}
Compétences travaillées : ${competencesUsed.join(", ")}
Exercices faits en classe :
${exerciseSummary}
${weaknessInfo}

Génère un programme de ${targetDays} jour(s) à ${dailyDuration} min/jour.
Calcule précisément le temps total pour chaque jour.`;

    // 8. Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              name: "generate_daily_plan",
              description: "Generate a daily homework plan with exercises for each day",
              parameters: {
                type: "object",
                properties: {
                  jours: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        jour: { type: "integer" },
                        duree_totale_minutes: { type: "number" },
                        exercices: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              titre: { type: "string" },
                              consigne: { type: "string" },
                              competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                              format: { type: "string", enum: ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_ecrite", "production_orale"] },
                              difficulte: { type: "integer", minimum: 1, maximum: 5 },
                              duree_estimee_minutes: { type: "number" },
                              contenu: {
                                type: "object",
                                properties: {
                                  items: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        question: { type: "string" },
                                        options: { type: "array", items: { type: "string" } },
                                        bonne_reponse: { type: "string" },
                                        explication: { type: "string" },
                                        script_audio: { type: "string" },
                                      },
                                      required: ["question", "bonne_reponse"],
                                    },
                                  },
                                },
                                required: ["items"],
                              },
                            },
                            required: ["titre", "consigne", "competence", "format", "difficulte", "contenu"],
                          },
                        },
                      },
                      required: ["jour", "exercices"],
                    },
                  },
                },
                required: ["jours"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_daily_plan" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const plan = JSON.parse(toolCall.function.arguments);
    const jours = plan.jours || [];

    // 9. Insert exercises and devoirs with staggered deadlines
    const sessionDate = new Date(session.date_seance);
    let totalDevoirs = 0;

    for (const jour of jours) {
      const dayOffset = jour.jour || 1;
      const deadline = new Date(sessionDate);
      deadline.setDate(deadline.getDate() + dayOffset);
      deadline.setHours(23, 59, 59, 0);

      for (const ex of jour.exercices || []) {
        // Create exercise in DB
        const { data: inserted, error: insertErr } = await supabase
          .from("exercices")
          .insert({
            titre: ex.titre,
            consigne: ex.consigne,
            competence: ex.competence,
            format: ex.format || "qcm",
            difficulte: ex.difficulte || 3,
            contenu: ex.contenu || { items: [] },
            niveau_vise: niveauCible,
            formateur_id: formateurId,
            point_a_maitriser_id: defaultPoint.id,
            is_ai_generated: true,
            is_template: false,
            is_devoir: true,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("Insert exercise error:", insertErr);
          continue;
        }

        // Create devoirs for each student
        const devoirInserts = eleveIds.map((eleveId: string) => ({
          eleve_id: eleveId,
          exercice_id: inserted.id,
          formateur_id: formateurId,
          raison: "consolidation" as const,
          statut: "en_attente" as const,
          session_id: sessionId,
          source_label: `jour_${dayOffset}`,
          date_echeance: deadline.toISOString(),
        }));

        const { error: devoirErr } = await supabase.from("devoirs").insert(devoirInserts);
        if (devoirErr) {
          console.error("Insert devoir error:", devoirErr);
          continue;
        }
        totalDevoirs += devoirInserts.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalJours: jours.length,
        totalExercices: jours.reduce((sum: number, j: any) => sum + (j.exercices?.length || 0), 0),
        totalDevoirs,
        plan: jours.map((j: any) => ({
          jour: j.jour,
          duree: j.duree_totale_minutes,
          exercices: (j.exercices || []).length,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-daily-homework error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
