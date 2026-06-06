import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { TCF_SYSTEM_PROMPT, MODEL } from "../_shared/system-prompt.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseJsonObject(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("L'IA n'a pas retourné un JSON valide");
  }
}

function buildProceduralDiagnostic(competences: string[], niveau: string) {
  const normalized = (competences?.length ? competences : ["CE"]).filter(Boolean);
  const contexts = ["préfecture", "logement", "emploi", "transport", "CAF", "médecin", "mairie", "banque"];
  const questions = normalized.flatMap((competence, compIndex) =>
    Array.from({ length: Math.max(3, Math.ceil(8 / normalized.length)) }, (_, i) => {
      const ctx = contexts[(compIndex + i) % contexts.length];
      const base = {
        competence,
        sous_competence: `Repérage d'information en contexte ${ctx}`,
        niveau,
        difficulte: i % 3 === 0 ? 2 : i % 3 === 1 ? 3 : 4,
        explication: `La réponse attendue vérifie la compréhension d'une information utile dans une situation de ${ctx}.`,
      };

      if (competence === "CO") {
        return {
          ...base,
          consigne: "Écoute le message et choisis la bonne réponse.",
          support: `Bonjour. Pour votre rendez-vous à la ${ctx}, apportez une pièce d'identité [pause 1s] et un justificatif récent [pause 1s]. Le rendez-vous est confirmé pour jeudi matin. [débit lent]`,
          choix: ["Jeudi matin", "Lundi soir", "Samedi après-midi", "Dimanche matin"],
          bonne_reponse: "Jeudi matin",
        };
      }

      if (competence === "CE") {
        return {
          ...base,
          consigne: "Lis le document et choisis la bonne réponse.",
          support: `Avis ${ctx} : votre dossier est disponible à l'accueil du lundi au vendredi, de 9 h à 12 h. Merci d'apporter votre numéro de dossier.`,
          choix: ["De 9 h à 12 h", "De 14 h à 18 h", "Le samedi matin", "Uniquement le dimanche"],
          bonne_reponse: "De 9 h à 12 h",
        };
      }

      if (competence === "Structures") {
        return {
          ...base,
          consigne: "Choisis la phrase correcte.",
          support: "",
          choix: ["Je dois apporter mon justificatif.", "Je dois apportez mon justificatif.", "Je doit apporter mon justificatif.", "Je dois apporte mon justificatif."],
          bonne_reponse: "Je dois apporter mon justificatif.",
        };
      }

      if (competence === "EE") {
        return {
          ...base,
          consigne: `Écris un message court pour demander une information liée à ${ctx}.`,
          support: `Tu dois contacter un service de ${ctx} pour demander un rendez-vous ou une information simple.`,
          choix: [],
          bonne_reponse: "Production écrite attendue : message clair avec salutation, demande précise et formule de politesse.",
        };
      }

      return {
        ...base,
        consigne: `Prépare une réponse orale courte pour expliquer ta situation liée à ${ctx}.`,
        support: `Situation : tu es à un guichet de ${ctx}. Explique ce dont tu as besoin en phrases simples.`,
        choix: [],
        bonne_reponse: "Production orale attendue : réponse compréhensible, informations personnelles utiles et demande claire.",
      };
    })
  ).slice(0, 15);

  while (questions.length < 8) questions.push({ ...questions[questions.length % Math.max(questions.length, 1)] });

  return {
    titre: `Diagnostic pré-séance ${niveau}`,
    duree_estimee_minutes: 6,
    questions: questions.slice(0, 15),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AI key check moved to shared ai-client

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      sessionId,
      groupId,
      competences, // string[] e.g. ["CO", "CE"]
      niveau,      // e.g. "A1"
      weakPoints,  // optional: [{ competence, exercice, score }]
      previousSessionScores, // optional: Record<string, { avg, count }>
      statut: requestedStatut, // optional: "pret" | "envoye" (default "envoye")
    } = body;

    if (!sessionId || !groupId || !competences || !niveau) {
      throw new Error("Champs requis : sessionId, groupId, competences, niveau");
    }

    // Build prompt for diagnostic test generation
    let userPrompt = `Action : générer un TEST DIAGNOSTIQUE EXHAUSTIF pré-séance au format TCF IRN.
Durée cible : 5 à 8 minutes de passation.

Objectif : évaluer de manière PRÉCISE et EXHAUSTIVE le niveau actuel des élèves sur les compétences suivantes : ${competences.join(", ")}
Niveau cible : ${niveau}

NOMBRE DE QUESTIONS : Générer entre 8 et 15 questions au total.
- Minimum 2-3 questions PAR compétence demandée pour une évaluation fiable
- Varier les sous-compétences testées au sein de chaque compétence
- Couvrir différents aspects : vocabulaire, syntaxe, pragmatique, phonologie selon la compétence

CONTRAINTE TCF IRN ABSOLUE : Chaque question doit respecter le format officiel du TCF.
- CO : QCM 4 choix basé sur un script audio réaliste (fournir le script complet avec balises [pause], contexte IRN : préfecture, CAF, médecin, logement, transport)
- CE : QCM 4 choix basé sur un document authentique (courrier administratif, formulaire, affiche, panneau, SMS, email) — fournir le texte intégral du support
- EE : Tâche de production écrite calibrée (remplir un formulaire, écrire un message court, répondre à une annonce)
- EO : Tâche de production orale calibrée (se présenter, décrire une situation, laisser un message vocal)
- Structures : QCM 4 choix sur la grammaire/vocabulaire en contexte IRN (conjugaison, articles, prépositions, négation, vocabulaire administratif)

CALIBRATION DE LA DIFFICULTÉ :
- 60% des questions au niveau ${niveau} (consolidation)
- 25% des questions un demi-niveau en dessous (vérification des acquis de base)
- 15% des questions un demi-niveau au-dessus (détection des élèves avancés)

QUALITÉ DES DISTRACTEURS (choix incorrects) :
- Les distracteurs doivent être PLAUSIBLES (erreurs typiques des apprenants de ce niveau)
- Pas de distracteurs absurdes ou évidents
- Chaque distracteur doit correspondre à une erreur identifiable (confusion phonétique, interférence L1, surgénéralisation)

EXPLICATION PÉDAGOGIQUE : Pour chaque question, fournir :
- La bonne réponse avec une explication claire
- Le type d'erreur que chaque distracteur représente
- Le micro-objectif pédagogique évalué`;


    if (weakPoints && weakPoints.length > 0) {
      userPrompt += `\n\nPOINTS FAIBLES DÉTECTÉS (à tester en priorité) :`;
      weakPoints.forEach((wp: any) => {
        userPrompt += `\n- ${wp.competence} : "${wp.exercice}" (score ${wp.score}%)`;
      });
    }

    if (previousSessionScores) {
      userPrompt += `\n\nSCORES SÉANCE PRÉCÉDENTE PAR COMPÉTENCE :`;
      Object.entries(previousSessionScores).forEach(([comp, data]: [string, any]) => {
        userPrompt += `\n- ${comp} : ${data.avg}% (${data.count} résultats)`;
      });
    }

    const systemPrompt = TCF_SYSTEM_PROMPT + `

// Mode diagnostic pré-séance EXHAUSTIF — Génère un test complet (8-15 questions, ~5-8 min) pour évaluer précisément le niveau avant la séance.
// Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant/après.
// Structure obligatoire :
// {
//   "titre": "...",
//   "duree_estimee_minutes": 5,
//   "questions": [
//     {
//       "competence": "CO|CE|EE|EO|Structures",
//       "sous_competence": "...",
//       "consigne": "...",
//       "support": "script audio CO ou texte support CE, sinon chaîne vide",
//       "choix": ["A", "B", "C", "D"],
//       "bonne_reponse": "réponse exacte ou production attendue",
//       "explication": "...",
//       "niveau": "${niveau}",
//       "difficulte": 3
//     }
//   ]
// }
// CO, CE et Structures : choix contient exactement 4 réponses. EE et EO : choix peut être [].`;

    let diagnostic: any;
    try {
      const aiResult = await callAI({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const content = aiResult.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("L'IA n'a pas retourné de diagnostic exploitable");
      }
      diagnostic = parseJsonObject(content);
    } catch (aiError) {
      if (aiError instanceof AIError && (aiError.status === 402 || aiError.status === 429)) throw aiError;
      console.warn("AI diagnostic generation failed, using procedural fallback:", aiError);
      diagnostic = buildProceduralDiagnostic(competences, niveau);
    }

    // Validate: at least 3 questions with 4 choices each
    if (!diagnostic.questions || diagnostic.questions.length < 8) {
      throw new Error("Le diagnostic doit contenir au moins 8 questions pour une évaluation exhaustive");
    }

    for (const q of diagnostic.questions) {
      // QCM questions (CO, CE, Structures) must have 4 choices; EE/EO may not have choices
      if (q.choix && q.choix.length > 0 && q.choix.length !== 4) {
        throw new Error(`QCM invalide : ${q.competence} doit avoir 4 choix`);
      }
    }

    // Save as bilan_test linked to the session
    const competencesCouvertes = [...new Set(diagnostic.questions.map((q: any) => q.competence))];

    // Get formateur id from session
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("group_id")
      .eq("id", sessionId)
      .single();

    const { data: groupData } = await supabase
      .from("groups")
      .select("formateur_id")
      .eq("id", sessionData?.group_id || groupId)
      .single();

    const formateurId = groupData?.formateur_id;
    if (!formateurId) throw new Error("Formateur introuvable");

    const { data: bilanTest, error: insertErr } = await supabase
      .from("bilan_tests")
      .insert({
        session_id: sessionId,
        formateur_id: formateurId,
        contenu: diagnostic.questions,
        competences_couvertes: competencesCouvertes,
        nb_questions: diagnostic.questions.length,
        statut: requestedStatut === "pret" ? "pret" : "envoye",
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        bilanTestId: bilanTest.id,
        titre: diagnostic.titre,
        nbQuestions: diagnostic.questions.length,
        competences: competencesCouvertes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-diagnostic-test error:", e);
    const status = e instanceof AIError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
