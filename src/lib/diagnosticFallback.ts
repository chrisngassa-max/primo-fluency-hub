import { supabase } from "@/integrations/supabase/client";

type DiagnosticQuestion = {
  competence: string;
  sous_competence: string;
  niveau: string;
  difficulte: number;
  explication: string;
  consigne: string;
  support: string;
  choix: string[];
  bonne_reponse: string;
};

function buildProceduralDiagnostic(competences: string[], niveau: string) {
  const normalized = (competences?.length ? competences : ["CE"]).filter(Boolean);
  const contexts = ["préfecture", "logement", "emploi", "transport", "CAF", "médecin", "mairie", "banque"];
  const questions: DiagnosticQuestion[] = normalized.flatMap((competence, compIndex) =>
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

export async function createProceduralDiagnosticTest({
  sessionId,
  groupId,
  competences,
  niveau,
  statut = "pret",
}: {
  sessionId: string;
  groupId: string;
  competences: string[];
  niveau: string;
  statut?: "pret" | "envoye";
}) {
  const diagnostic = buildProceduralDiagnostic(competences, niveau || "A1");
  const competencesCouvertes = [...new Set(diagnostic.questions.map((q) => q.competence))];

  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("formateur_id")
    .eq("id", groupId)
    .single();

  if (groupError) throw groupError;
  if (!groupData?.formateur_id) throw new Error("Formateur introuvable");

  const { data: bilanTest, error: insertError } = await supabase
    .from("bilan_tests")
    .insert({
      session_id: sessionId,
      formateur_id: groupData.formateur_id,
      contenu: diagnostic.questions,
      competences_couvertes: competencesCouvertes,
      nb_questions: diagnostic.questions.length,
      statut,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  return {
    bilanTestId: bilanTest.id,
    titre: diagnostic.titre,
    nbQuestions: diagnostic.questions.length,
    competences: competencesCouvertes,
  };
}