import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { validateAndFix } from "../_shared/exercise-validator.ts";
import { QA_REVIEW_BLOCK, logQaAuto } from "../_shared/qa-prompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkConsentBatch, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function scorePct(score: unknown): number {
  if (typeof score === "number") return score;
  if (score && typeof score === "object" && "pct" in score) {
    return Number((score as { pct: number }).pct) || 0;
  }
  return 100;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scoresParCompetence, niveauCible, sessionTitle, eleveIds, persistContext } = await req.json();
    const triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("generate-bilan-devoirs", corsHeaders, null);
    if (secretBlock) return secretBlock;
    let excludedIds: string[] = [];
    if (Array.isArray(eleveIds) && eleveIds.length > 0) {
      const batch = await checkConsentBatch(eleveIds);
      excludedIds = batch.excludedIds;
      if (batch.allowedIds.length === 0) {
        await logAICall({ function_name: "generate-bilan-devoirs", triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: ["aggregated_results"], pseudonymization_level: "hmac_sha256" });
        return new Response(JSON.stringify({ error: "consent_required", excludedIds, degraded_mode: true, message: "Aucun élève consentant." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    await logAICall({ function_name: "generate-bilan-devoirs", triggered_by_user_id: triggeredBy, status: "ok", data_categories: ["aggregated_results"], pseudonymization_level: "hmac_sha256" });
    // AI key check moved to shared ai-client

    // Identify weaknesses
    const competencesATravailler = Object.entries(scoresParCompetence || {})
      .filter(([_, score]) => scorePct(score) < 80)
      .map(([comp, score]) => {
        const pct = scorePct(score);
        return {
          competence: comp,
          score: pct,
          type: pct < 60 ? "renforcement" : "consolidation",
        };
      });

    if (competencesATravailler.length === 0) {
      return new Response(JSON.stringify({ devoirs: [], devoirs_created: 0, message: "Tous les scores sont >= 80%. Aucun devoir nécessaire." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un expert en pédagogie FLE/TCF IRN.
Tu génères des devoirs ciblés sur les lacunes identifiées lors d'un test de bilan.

SYSTÈME MULTIMÉDIA ACTIF :
L'application dispose d'un lecteur vocal (Text-to-Speech) et d'un enregistreur vocal (Speech-to-Text) côté élève.

═══════════════════════════════════════════════════
CARTOGRAPHIE DES EXERCICES TCF IRN — NIVEAU A1
Chaque exercice DOIT porter un code et des métadonnées issus de cette cartographie.
═══════════════════════════════════════════════════

### CO — TTS obligatoire
CO1 (Identifier situation, 45s), CO2 (Sujet global, 50s), CO3 (Consignes/Règles, 45s), CO4 (Info chiffrée, 50s)
→ "script_audio" OBLIGATOIRE dans contenu. "question" = consigne d'écoute.

### CE — texte support obligatoire
CE1 (Signalétique, 80s), CE2 (Messages familiers, 80s), CE3 (Recherche d'info, 80s), CE4 (Texte admin, 100s)
→ "texte" OBLIGATOIRE dans contenu.

### EO — production_orale + type_reponse "oral"
EO1 (Se présenter, 120s), EO2 (Interaction, 180s), EO3 (Survie, 120s), EO4 (Demande d'info, 120s)
→ format "production_orale", "criteres_evaluation" + "mots_cles_attendus".

### EE — production_ecrite
EE1 (Remplir/Saisir, 300s), EE2 (Informer par écrit, 600s), EE3 (Décrire/Raconter, 600s)

Règles :
- Pour chaque compétence < 60% : exercices de renforcement (même niveau ou inférieur)
- Pour 60-80% : exercices de consolidation (variantes)
- 3 à 5 exercices par devoir maximum
- Contexte IRN obligatoire
- Chaque exercice doit avoir un metadata avec code, skill, sub_skill, time_limit_seconds` + QA_REVIEW_BLOCK;

    const userPrompt = `RÉSULTATS DU TEST DE BILAN (séance "${sessionTitle}") :
${competencesATravailler.map(c => `- ${c.competence} : ${c.score}% → ${c.type}`).join("\n")}

NIVEAU CIBLE : ${niveauCible || "A1"}

Génère les devoirs ciblés pour chaque compétence en difficulté. Attribue un code TCF IRN à chaque exercice.`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_devoirs",
            description: "Génère les devoirs ciblés sur les lacunes avec codes TCF IRN",
            parameters: {
              type: "object",
              properties: {
                devoirs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      competence: { type: "string" },
                      type_devoir: { type: "string", enum: ["renforcement", "consolidation", "confirmation"] },
                      titre: { type: "string" },
                      consigne: { type: "string" },
                      format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "production_orale", "production_ecrite"] },
                      niveau_vise: { type: "string" },
                      type_reponse: { type: "string", enum: ["ecrit", "oral"] },
                      script_audio: { type: "string" },
                      criteres_evaluation: { type: "object" },
                      mots_cles_attendus: { type: "array", items: { type: "string" } },
                      metadata: {
                        type: "object",
                        properties: {
                          code: { type: "string" },
                          skill: { type: "string" },
                          sub_skill: { type: "string" },
                          time_limit_seconds: { type: "number" },
                        },
                        required: ["code", "skill", "sub_skill", "time_limit_seconds"],
                      },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            question: { type: "string" },
                            options: { type: "array", items: { type: "string" } },
                            bonne_reponse: { type: "string" },
                            explication: { type: "string" },
                          },
                          required: ["question", "options", "bonne_reponse", "explication"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["competence", "type_devoir", "titre", "consigne", "format", "niveau_vise", "metadata", "items"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["devoirs"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_devoirs" } },
      });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer les devoirs");

    const result = JSON.parse(toolCall.function.arguments);

    // ── Validation + régénération de chaque devoir ──
    const validatedDevoirs: any[] = [];
    const excludedDevoirs: { titre: string; reason: string }[] = [];
    for (const devoir of result.devoirs || []) {
      const validated = await validateAndFix(
        { ...devoir, niveau_vise: devoir.niveau_vise || niveauCible },
        { niveau: niveauCible || "A1" }
      );
      if (!validated) {
        excludedDevoirs.push({ titre: devoir.titre || "?", reason: "validation_failed_after_3_attempts" });
        console.warn(`[bilan-devoirs] Excluded: ${devoir.titre}`);
        continue;
      }
      validatedDevoirs.push({ ...devoir, ...validated.exercise });
    }

    // ── QA gate : ≥60% des devoirs initiaux doivent rester valides ──
    const initial = (result.devoirs || []).length;
    const ratio = initial > 0 ? validatedDevoirs.length / initial : 1;
    if (initial > 0 && ratio < 0.6) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SERVICE_KEY) {
        const sb = createClient(SUPABASE_URL, SERVICE_KEY);
        await logQaAuto(sb, {
          context: "qa_auto_bilan_devoirs",
          excluded: excludedDevoirs,
          action_taken: `blocked_publication_ratio_${(ratio * 100).toFixed(0)}pct`,
        });
      }
      return new Response(
        JSON.stringify({
          error: `QA bloquée : seulement ${validatedDevoirs.length}/${initial} devoirs valides (<60%)`,
          excluded: excludedDevoirs,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional persistence (service role) — BilanTestPassation after test submission
    let devoirsCreated = 0;
    const ctx = persistContext as {
      formateur_id?: string;
      session_id?: string;
      eleve_id?: string;
    } | undefined;
    if (
      ctx?.formateur_id &&
      ctx?.session_id &&
      ctx?.eleve_id &&
      triggeredBy === ctx.eleve_id &&
      validatedDevoirs.length > 0
    ) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SERVICE_KEY) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: point } = await admin.from("points_a_maitriser").select("id").limit(1).single();
        const pointId = point?.id;
        if (pointId) {
          const delaiJours = 3;
          const dateEcheance = new Date(Date.now() + delaiJours * 86400000).toISOString();
          for (const devoir of validatedDevoirs) {
            const { data: newEx, error: exErr } = await admin
              .from("exercices")
              .insert({
                formateur_id: ctx.formateur_id,
                titre: devoir.titre,
                consigne: devoir.consigne,
                competence: devoir.competence,
                format: devoir.format || "qcm",
                niveau_vise: devoir.niveau_vise || niveauCible || "A1",
                contenu: { items: devoir.items || [] },
                point_a_maitriser_id: pointId,
                is_devoir: true,
                is_ai_generated: true,
                eleve_id: ctx.eleve_id,
              })
              .select("id")
              .single();
            if (exErr || !newEx) {
              console.warn("[bilan-devoirs] exercise insert failed:", exErr?.message);
              continue;
            }
            const raison = devoir.type_devoir === "renforcement" ? "remediation" : "consolidation";
            const { error: devErr } = await admin.from("devoirs").insert({
              eleve_id: ctx.eleve_id,
              exercice_id: newEx.id,
              formateur_id: ctx.formateur_id,
              session_id: ctx.session_id,
              raison,
              statut: "en_attente",
              contexte: "devoir",
              date_echeance: dateEcheance,
            });
            if (devErr) {
              console.warn("[bilan-devoirs] devoir insert failed:", devErr.message);
              continue;
            }
            devoirsCreated++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        devoirs: validatedDevoirs,
        excluded: excludedDevoirs,
        totalExcluded: excludedDevoirs.length,
        devoirs_created: devoirsCreated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-bilan-devoirs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
