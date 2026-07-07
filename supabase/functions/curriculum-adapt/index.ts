import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-client.ts";
import {
  checkConsentBatch,
  ensurePseudonymSecretOrLog,
  getUserIdFromAuth,
  logAICall,
} from "../_shared/check-consent.ts";
import {
  buildVariantHints,
  matchDeroulePhase,
  normalizePhaseKey,
  pickLatestPublishedResources,
  pickResourceByKind,
  resolvePublishedResourceIds,
  toPublishedSummaries,
  type CurriculumResourceRow,
  type ExerciseVariantRow,
} from "../_shared/curriculum-adapt-lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CURRICULUM_BUCKET = Deno.env.get("CURRICULUM_STORAGE_BUCKET") ?? "curriculum-published";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function assertFormateur(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw Object.assign(new Error("Non autorisé"), { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error } = await caller.auth.getUser();
  if (error || !user) throw Object.assign(new Error("Non autorisé"), { status: 401 });

  const { data: isFormateur } = await admin.rpc("has_role", { _user_id: user.id, _role: "formateur" });
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

  if (!isFormateur && !isAdmin) {
    throw Object.assign(new Error("Accès réservé aux formateurs"), { status: 403 });
  }

  return { admin, user };
}

async function downloadJson(
  admin: ReturnType<typeof createClient>,
  chemin: string | null,
): Promise<unknown | null> {
  if (!chemin) return null;
  const { data, error } = await admin.storage.from(CURRICULUM_BUCKET).download(chemin);
  if (error || !data) {
    console.warn("curriculum-adapt: download failed", chemin, error?.message);
    return null;
  }
  try {
    return JSON.parse(await data.text());
  } catch {
    console.warn("curriculum-adapt: invalid JSON at", chemin);
    return null;
  }
}

async function loadPublishedResources(
  admin: ReturnType<typeof createClient>,
  trainingSessionId: string,
): Promise<CurriculumResourceRow[]> {
  const { data, error } = await admin
    .from("session_resources")
    .select("id, session_id, resource_id, kind, version, chemin, statut, support_id, metadata")
    .eq("session_id", trainingSessionId)
    .eq("statut", "published");

  if (error) throw error;
  return (data ?? []) as CurriculumResourceRow[];
}

async function loadExerciseVariants(
  admin: ReturnType<typeof createClient>,
  supportIds: string[],
): Promise<ExerciseVariantRow[]> {
  if (supportIds.length === 0) return [];
  const { data, error } = await admin
    .from("exercise_variants")
    .select("id, support_id, niveau, version, statut, consigne")
    .in("support_id", supportIds)
    .eq("statut", "published");
  if (error) {
    console.warn("curriculum-adapt: exercise_variants query failed", error.message);
    return [];
  }
  return (data ?? []) as ExerciseVariantRow[];
}

const TEACHER_VALIDATION_RULE = `
REGLE PRODUIT OBLIGATOIRE :
- Le systeme propose uniquement. Le formateur valide, modifie ou refuse.
- Ne presente jamais une adaptation de deroule, une variante ou une ressource comme deja appliquee en classe.
- Respecte strictement les regles d'adaptation publiees : ne jamais remplacer un dialogue audio publie par du texte ecrit.
- Les recommandations doivent citer les resource_id publies utilises ou recommandes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      sessionId,
      trainingSessionId,
      sessionCode,
      palierCible,
      phase,
      eleveIds,
      aggregatedErrors,
      exercicesNonTraites,
      tempsRestantMin,
    } = body ?? {};

    const triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("curriculum-adapt", corsHeaders, triggeredBy);
    if (secretBlock) return secretBlock;

    if (!trainingSessionId || !sessionCode) {
      return json(400, {
        error: "missing_fields",
        message: "trainingSessionId et sessionCode sont requis.",
      });
    }

    const { admin, user } = await assertFormateur(req);

    const allPublished = await loadPublishedResources(admin, trainingSessionId);
    const publishedLatest = pickLatestPublishedResources(allPublished);

    if (publishedLatest.length === 0) {
      return json(200, {
        adaptation: {
          analyse: "Aucune ressource curriculum publiee n'est disponible pour cette seance.",
          recommandations: [],
          resource_ids: [],
          variantes_par_niveau: {},
          ajustements_deroule: [],
          message_formateur: "Publiez d'abord le paquet de la seance (Production parcours) avant de demander une adaptation IA.",
        },
        published_resources_used: [],
        degraded_mode: true,
        message: "Aucune ressource publiee pour cette seance curriculum.",
      });
    }

    let excludedIds: string[] = [];
    const studentIds = Array.isArray(eleveIds) ? eleveIds.filter(Boolean) : [];
    if (studentIds.length > 0) {
      const batch = await checkConsentBatch(studentIds);
      excludedIds = batch.excludedIds;
      if (batch.allowedIds.length === 0) {
        await logAICall({
          function_name: "curriculum-adapt",
          triggered_by_user_id: triggeredBy ?? user.id,
          status: "blocked_no_consent",
          data_categories: ["aggregated_results"],
          pseudonymization_level: "hmac_sha256",
        });
        return json(403, {
          error: "consent_required",
          excludedIds,
          degraded_mode: true,
          message: "Aucun eleve consentant pour le traitement IA.",
        });
      }
    }

    const adaptationRulesResource = pickResourceByKind(allPublished, "adaptation_rules_json");
    const derouleResource = pickResourceByKind(allPublished, "deroule_json");
    const variantsResource = pickResourceByKind(allPublished, "variantes_json");

    const [adaptationRules, derouleJson, variantsJson] = await Promise.all([
      downloadJson(admin, adaptationRulesResource?.chemin ?? null),
      downloadJson(admin, derouleResource?.chemin ?? null),
      downloadJson(admin, variantsResource?.chemin ?? null),
    ]);

    const supportIds = [
      ...new Set(
        publishedLatest
          .map((r) => r.support_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const dbVariants = await loadExerciseVariants(admin, supportIds);
    const variantHints = buildVariantHints(variantsJson, dbVariants);

    const phaseKey = normalizePhaseKey(typeof phase === "string" ? phase : undefined);
    const currentPhase = matchDeroulePhase(
      Array.isArray(derouleJson) ? derouleJson : null,
      phaseKey,
    );

    const publishedCatalog = publishedLatest.map((r) => ({
      resource_id: r.resource_id,
      kind: r.kind,
      version: r.version,
    }));

    await logAICall({
      function_name: "curriculum-adapt",
      triggered_by_user_id: triggeredBy ?? user.id,
      status: "ok",
      data_categories: ["aggregated_results"],
      pseudonymization_level: "none",
    });

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN pour le curriculum CapTCF v2.
On te fournit les regles d'adaptation publiees, le deroule de seance, les variantes par niveau et des signaux pedagogiques agreges (sans donnees nominatives).

Tu dois proposer une adaptation EN SEANCE en respectant le tronc commun curriculum.
${TEACHER_VALIDATION_RULE}`;

    const userPrompt = `SEANCE CURRICULUM : ${sessionCode}
Palier cible variantes : ${palierCible ?? "non precise"}
Phase en cours : ${phase ?? "non precise"}${currentPhase ? ` (${currentPhase.phase}, ${currentPhase.duree_min} min prevues)` : ""}
Temps restant estime : ${typeof tempsRestantMin === "number" ? `${tempsRestantMin} min` : "non precise"}

REGLES D'ADAPTATION PUBLIEES (adaptation_rules_json) :
${JSON.stringify(adaptationRules ?? [], null, 2)}

DEROULE PUBLIE (deroule_json) :
${JSON.stringify(derouleJson ?? [], null, 2)}

VARIANTES DISPONIBLES (indices par niveau) :
${JSON.stringify(variantHints, null, 2)}

CATALOGUE RESSOURCES PUBLIEES (utiliser UNIQUEMENT ces resource_id) :
${JSON.stringify(publishedCatalog, null, 2)}

SIGNAUX AGREGES (erreurs / lacunes, pseudonymises, sans noms) :
${JSON.stringify(Array.isArray(aggregatedErrors) ? aggregatedErrors : [], null, 2)}

EXERCICES NON TRAITES / REPORTES :
${JSON.stringify(Array.isArray(exercicesNonTraites) ? exercicesNonTraites : [], null, 2)}

${excludedIds.length > 0 ? `Note : ${excludedIds.length} eleve(s) exclus faute de consentement IA.` : ""}

Propose une adaptation concrete pour la phase en cours ou la suite de seance.`;

    const aiData = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "propose_curriculum_adaptation",
            description: "Propose une adaptation curriculum basee sur les ressources publiees",
            parameters: {
              type: "object",
              properties: {
                analyse: {
                  type: "string",
                  description: "Analyse concise de la situation pedagogique (2-4 phrases)",
                },
                recommandations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "prolonger_phase",
                          "raccourcir_phase",
                          "reprendre_lexique",
                          "atelier_differentie",
                          "mise_en_commun",
                          "remediation",
                          "conserver_tronc_commun",
                        ],
                      },
                      description: { type: "string" },
                      resource_id: { type: "string" },
                      duree_minutes: { type: "number" },
                    },
                    required: ["type", "description"],
                    additionalProperties: false,
                  },
                },
                resource_ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "resource_id publies utilises ou recommandes",
                },
                variantes_par_niveau: {
                  type: "object",
                  properties: {
                    A1: { type: "string" },
                    A2: { type: "string" },
                    B1: { type: "string" },
                    B2: { type: "string" },
                  },
                  additionalProperties: false,
                },
                ajustements_deroule: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      phase: { type: "string" },
                      action: { type: "string" },
                      duree_delta_min: { type: "number" },
                    },
                    required: ["phase", "action"],
                    additionalProperties: false,
                  },
                },
                message_formateur: {
                  type: "string",
                  description: "Message court pour le formateur (proposition, pas decision prise)",
                },
              },
              required: [
                "analyse",
                "recommandations",
                "resource_ids",
                "variantes_par_niveau",
                "ajustements_deroule",
                "message_formateur",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "propose_curriculum_adaptation" } },
    });

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu proposer d'adaptation curriculum");

    const rawAdaptation = JSON.parse(toolCall.function.arguments);
    const validatedResourceIds = resolvePublishedResourceIds(
      Array.isArray(rawAdaptation.resource_ids) ? rawAdaptation.resource_ids : [],
      allPublished,
    );

    for (const rec of rawAdaptation.recommandations ?? []) {
      if (rec?.resource_id) {
        validatedResourceIds.push(
          ...resolvePublishedResourceIds([rec.resource_id], allPublished),
        );
      }
    }
    const uniqueResourceIds = [...new Set(validatedResourceIds)];

    const adaptation = {
      ...rawAdaptation,
      resource_ids: uniqueResourceIds,
      variantes_par_niveau: rawAdaptation.variantes_par_niveau ?? {},
    };

    const published_resources_used = toPublishedSummaries(
      publishedLatest.filter((r) => uniqueResourceIds.includes(r.resource_id)),
    );

    const recommandations = Array.isArray(adaptation.recommandations) ? adaptation.recommendations : [];
    if (recommandations.length > 0 && sessionId) {
      const recTypeMap: Record<string, string> = {
        prolonger_phase: "support_guide",
        raccourcir_phase: "support_guide",
        reprendre_lexique: "atelier_remediation",
        atelier_differentie: "atelier_remediation",
        mise_en_commun: "mise_en_commun",
        remediation: "atelier_remediation",
        conserver_tronc_commun: "support_guide",
      };

      const rows = recommandations.slice(0, 8).map((rec: Record<string, unknown>) => ({
        source_session_id: sessionId,
        target_session_id: sessionId,
        formateur_id: user.id,
        type: recTypeMap[String(rec.type)] ?? "support_guide",
        competence: null,
        eleves_concernes: [],
        raison_formateur: String(rec.description ?? adaptation.analyse ?? ""),
        action_proposee: {
          curriculum_adapt: true,
          session_code: sessionCode,
          phase: phase ?? null,
          adaptation_type: rec.type,
          resource_id: rec.resource_id ?? null,
          duree_minutes: rec.duree_minutes ?? null,
          resource_ids: uniqueResourceIds,
          message_formateur: adaptation.message_formateur ?? null,
        },
        source: "system",
        status: "proposed",
      }));

      const { error: recErr } = await admin.from("session_recommendations").insert(rows);
      if (recErr) console.warn("curriculum-adapt: insert session_recommendations failed", recErr);
    }

    return json(200, {
      adaptation,
      published_resources_used,
      degraded_mode: false,
      excludedIds: excludedIds.length > 0 ? excludedIds : undefined,
    });
  } catch (e) {
    const status = (e as { status?: number })?.status ?? 500;
    console.error("curriculum-adapt error:", e);
    return json(status, {
      error: e instanceof Error ? e.message : "Erreur inconnue",
    });
  }
});
