import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";
import {
  getOptionalModuleSessions,
  isCiviqueVisible,
  isOptionalModuleActive,
  resolvePlanCadreThemeId,
  type PlanCadreSession,
  type PlanCadreStudentProfile,
} from "../_shared/referential-loader.ts";

type VariantePlan = "enrichi" | "civique";

const normalizeVariante = (v?: string | null): VariantePlan =>
  v === "civique" ? "civique" : "enrichi";

// Lisibilité des séances du module optionnel S21–S30 (mappées vers le format GeneratedSeance).
const MODULE_TYPE_LABELS: Record<string, string> = {
  STRUCTURES_TRANSVERSALES: "Structures transversales",
  CIVIQUE_INTENSIF: "Civique intensif",
  SIMULATION_CIVIQUE: "Simulation examen civique",
  BILAN_ORIENTATION: "Bilan & orientation",
};

const MODULE_TYPE_COMPETENCES: Record<string, string[]> = {
  STRUCTURES_TRANSVERSALES: ["Structures"],
  CIVIQUE_INTENSIF: ["CE", "CO"],
  SIMULATION_CIVIQUE: ["CE", "CO"],
  BILAN_ORIENTATION: ["EO", "CE"],
};

/**
 * Construit un profil apprenant minimal mais réel à partir du corps de requête.
 * Si aucun profil n'est fourni, on dérive un défaut sûr :
 *  - civique  -> profil activant le module optionnel (re-signature + examen civique)
 *  - enrichi  -> civique masqué, module désactivé (comportement historique)
 */
function buildStudentProfile(
  body: Record<string, unknown>,
  variante: VariantePlan,
  typeDemarche: string,
): PlanCadreStudentProfile {
  const provided = body.profile;
  if (provided && typeof provided === "object") {
    return provided as PlanCadreStudentProfile;
  }
  if (variante === "civique") {
    return {
      type_demarche: typeDemarche || "naturalisation",
      mention: "NAT",
      premiere_demande_CSP: true,
      premiere_demande_CR_eligible: true,
      re_signature_civique: true,
      examen_civique_obligatoire: true,
    };
  }
  return {
    type_demarche: typeDemarche || "titre_sejour",
    re_signature_civique: false,
    examen_civique_obligatoire: false,
  };
}

function estimateModuleExercices(session: PlanCadreSession): number {
  const duree = typeof session.duree_min === "number" ? session.duree_min : 180;
  return Math.max(3, Math.round(duree / 40));
}

/** Mappe les séances S21–S30 du module optionnel vers le format de séance renvoyé au front. */
function buildOptionalModuleSeances(profile: PlanCadreStudentProfile) {
  return getOptionalModuleSessions().map((session) => {
    const type = typeof session.type === "string" ? session.type : "";
    const label = MODULE_TYPE_LABELS[type] ?? "Module optionnel";
    const competences = MODULE_TYPE_COMPETENCES[type] ?? ["Structures"];
    const objectif = typeof session.objectif_communicatif === "string"
      ? session.objectif_communicatif
      : "Module optionnel civique";
    return {
      titre: `Module optionnel S${session.numero} — ${label}`,
      objectif_principal: objectif,
      competences_cibles: competences,
      duree_minutes: typeof session.duree_min === "number" ? session.duree_min : 180,
      nb_exercices_suggeres: estimateModuleExercices(session),
      // Métadonnées plan-cadre (ignorées par le front si non utilisées)
      numero: session.numero,
      module_optionnel: true,
      theme_id: resolvePlanCadreThemeId(session),
      civique_visible: isCiviqueVisible(session, profile),
    };
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const _triggeredBy = await getUserIdFromAuth(req);
    const _secretBlock = await ensurePseudonymSecretOrLog("generate-parcours", corsHeaders, null);
    if (_secretBlock) return _secretBlock;
    await logAICall({ function_name: "generate-parcours", triggered_by_user_id: _triggeredBy, status: "ok", data_categories: [], pseudonymization_level: "none" });
    const body = await req.json();
    const { heuresTotales, niveauDepart, niveauCible, dureeSeanceMinutes = 90, type_demarche = 'titre_sejour', groupId, parcoursId } = body;
    // AI key check moved to shared ai-client

    if (!heuresTotales || !niveauDepart || !niveauCible) {
      return new Response(
        JSON.stringify({ error: "heuresTotales, niveauDepart et niveauCible sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === VARIANTE DE PLAN : enrichi (défaut) vs civique (module optionnel S21–S30) ===
    // Source de vérité : le corps de requête (la ligne `parcours` n'existe pas encore
    // au moment de la génération). À défaut, on relit la ligne `parcours` si un id est fourni.
    let variante = normalizeVariante(body.variante_plan ?? body.variante);
    if (!body.variante_plan && !body.variante && parcoursId) {
      try {
        const sbUrl = Deno.env.get("SUPABASE_URL")!;
        const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(sbUrl, sbKey);
        const { data: parcoursRow } = await sb
          .from("parcours")
          .select("variante_plan")
          .eq("id", parcoursId)
          .maybeSingle();
        if (parcoursRow?.variante_plan) variante = normalizeVariante(parcoursRow.variante_plan);
      } catch (vErr) {
        console.error("Error reading parcours variante_plan:", vErr);
      }
    }

    const studentProfile = buildStudentProfile(body, variante, type_demarche);
    const includeOptionalModule = variante === "civique" && isOptionalModuleActive(studentProfile);
    const optionalModuleSeances = includeOptionalModule
      ? buildOptionalModuleSeances(studentProfile)
      : [];
    const moduleHeures = Math.round(
      optionalModuleSeances.reduce((sum, s) => sum + (s.duree_minutes || 0), 0) / 60,
    );
    // On demande à l'IA le découpage de la partie « tronc commun » uniquement ;
    // le module optionnel (≈30h / 10 séances) est ajouté de façon déterministe.
    const baseHeures = includeOptionalModule
      ? Math.max(heuresTotales - moduleHeures, Math.round(dureeSeanceMinutes / 60))
      : heuresTotales;

    // === ENRICHISSEMENT : Récupérer l'historique du groupe ===
    let studentHistoryPrompt = "";
    if (groupId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        // 1. Membres du groupe
        const { data: members } = await supabase
          .from("group_members")
          .select("eleve_id, profiles:profiles(nom, prenom)")
          .eq("group_id", groupId);

        if (members?.length) {
          const eleveIds = members.map((m: any) => m.eleve_id);

          // 2. Séances déjà réalisées pour ce groupe
          const { data: sessions } = await supabase
            .from("sessions")
            .select("titre, date_seance, statut, competences_cibles, duree_minutes, niveau_cible")
            .eq("group_id", groupId)
            .in("statut", ["terminee", "en_cours"])
            .order("date_seance", { ascending: true });

          // 3. Profils élèves
          const { data: profils } = await supabase
            .from("profils_eleves")
            .select("eleve_id, niveau_actuel, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures, score_risque, priorites_pedagogiques")
            .in("eleve_id", eleveIds);

          // 4. Tests de positionnement
          const { data: testSessions } = await supabase
            .from("test_sessions")
            .select("apprenant_id, score_co, score_ce, score_ee, score_eo, palier_co, palier_ce, palier_ee, palier_eo, profil_final")
            .in("apprenant_id", eleveIds)
            .eq("statut", "termine");

          // 5. Résultats récents (moyennes par compétence)
          const { data: resultats } = await supabase
            .from("resultats")
            .select("eleve_id, score, exercice:exercices(competence)")
            .in("eleve_id", eleveIds)
            .order("created_at", { ascending: false })
            .limit(eleveIds.length * 20);

          // 6. Niveaux de compétence validés
          const { data: compLevels } = await supabase
            .from("student_competency_levels")
            .select("eleve_id, competence, niveau_actuel")
            .in("eleve_id", eleveIds);

          // Construire le résumé du groupe
          const studentSummaries = members.map((m: any) => {
            const id = m.eleve_id;
            const nom = `${m.profiles?.prenom || ""} ${m.profiles?.nom || ""}`.trim() || "Anonyme";
            const profil = profils?.find((p: any) => p.eleve_id === id);
            const test = testSessions?.find((t: any) => t.apprenant_id === id);
            const results = (resultats || []).filter((r: any) => r.eleve_id === id);
            const levels = (compLevels || []).filter((l: any) => l.eleve_id === id);

            // Moyennes par compétence
            const scoresByComp: Record<string, number[]> = {};
            results.forEach((r: any) => {
              const comp = r.exercice?.competence;
              if (comp) {
                if (!scoresByComp[comp]) scoresByComp[comp] = [];
                scoresByComp[comp].push(r.score);
              }
            });
            const avgByComp: Record<string, number> = {};
            for (const [comp, scores] of Object.entries(scoresByComp)) {
              avgByComp[comp] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            }

            return {
              nom,
              niveau: profil?.niveau_actuel || "A0",
              score_risque: profil?.score_risque || 0,
              taux: profil ? {
                CO: profil.taux_reussite_co, CE: profil.taux_reussite_ce,
                EE: profil.taux_reussite_ee, EO: profil.taux_reussite_eo,
                Structures: profil.taux_reussite_structures
              } : null,
              test_positionnement: test ? {
                CO: test.score_co, CE: test.score_ce, EE: test.score_ee, EO: test.score_eo,
                paliers: { CO: test.palier_co, CE: test.palier_ce, EE: test.palier_ee, EO: test.palier_eo },
                profil: test.profil_final
              } : null,
              moyennes_exercices: avgByComp,
              niveaux_valides: levels.reduce((acc: any, l: any) => { acc[l.competence] = l.niveau_actuel; return acc; }, {}),
              priorites: profil?.priorites_pedagogiques || [],
            };
          });

          const sessionsRealisees = (sessions || []).map((s: any) => ({
            titre: s.titre,
            date: s.date_seance,
            competences: s.competences_cibles,
            duree: s.duree_minutes,
          }));

          studentHistoryPrompt = `

═══ HISTORIQUE DU GROUPE — DONNÉES RÉELLES ═══
Ce groupe a déjà réalisé ${sessionsRealisees.length} séance(s). Le parcours doit CONTINUER à partir de là, pas repartir de zéro.

SÉANCES DÉJÀ RÉALISÉES :
${JSON.stringify(sessionsRealisees, null, 2)}

PROFILS DES APPRENANTS :
${JSON.stringify(studentSummaries, null, 2)}

RÈGLES D'ADAPTATION DU PARCOURS :
1. NE PAS répéter les compétences déjà bien couvertes dans les séances passées
2. Renforcer les compétences où les taux de réussite sont faibles (< 60%)
3. Si des élèves ont un score_risque élevé (> 60), prévoir des séances de remédiation
4. Tenir compte des paliers du test de positionnement pour calibrer la progression
5. Le parcours DOIT s'appuyer sur les acquis : ne pas re-faire ce qui est maîtrisé
6. Intégrer les priorités pédagogiques identifiées par l'IA
═══════════════════════════════════════════════════`;
        }
      } catch (ctxErr) {
        console.error("Error fetching group history:", ctxErr);
      }
    }

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN.
Tu conçois des parcours de formation pour adultes primo-arrivants.

On te donne :
- Le volume horaire total disponible
- Le niveau de départ et le niveau cible (CECRL)
- La durée type d'une séance
- ÉVENTUELLEMENT l'historique des séances déjà réalisées et les profils des apprenants

Tu dois découper ce volume en séances cohérentes avec une progression pédagogique logique.

Compétences TCF IRN : CO (Compréhension Orale), CE (Compréhension Écrite), EE (Expression Écrite), EO (Expression Orale), Structures (Grammaire/Vocabulaire).

Règles :
- Alterner les compétences pour éviter la monotonie
- Commencer par CO et CE (réception) avant EE et EO (production)
- Les Structures doivent être réparties tout au long du parcours
- Prévoir des séances de révision/évaluation intermédiaires
- Le nombre d'exercices doit être proportionnel à la durée de la séance
- Si un historique de groupe est fourni, ADAPTER la progression en conséquence (ne pas recommencer ce qui est acquis)`;

    const demarcheLabel = type_demarche === 'naturalisation'
      ? 'Naturalisation (B2 requis sur les 4 épreuves)'
      : 'Titre de séjour / Résidence (B1 — 4 compétences travaillées, pondération CO/CE renforcée)';

    const moduleNote = includeOptionalModule
      ? `\n- IMPORTANT : un module optionnel civique de ${moduleHeures}h (séances S21–S30 : structures transversales, civique intensif, simulations d'examen et bilan) sera AJOUTÉ automatiquement après ta progression. Ne le génère donc PAS toi-même ; planifie uniquement le tronc commun sur ${baseHeures}h.`
      : "";

    const userPrompt = `Génère un parcours de formation FLE/TCF IRN :
- Volume total à découper : ${baseHeures} heures
- Niveau de départ : ${niveauDepart}
- Niveau cible : ${niveauCible}
- Durée type d'une séance : ${dureeSeanceMinutes} minutes
- Type de démarche : ${demarcheLabel}${moduleNote}

Propose le découpage complet en séances.
${studentHistoryPrompt}`;

    const data = await callAI({
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
        });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer la progression");

    const parsed = JSON.parse(toolCall.function.arguments);
    const baseSeances = parsed.seances || [];
    const seances = [...baseSeances, ...optionalModuleSeances];

    return new Response(
      JSON.stringify({
        seances,
        variante_plan: variante,
        module_optionnel_inclus: includeOptionalModule,
        nb_seances_module: optionalModuleSeances.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("generate-parcours error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
