import { supabase } from "@/integrations/supabase/client";

/**
 * Determines whether the learner advances to the next tier or stops.
 * Requires ≥2 points out of 3 to advance. Max tier is 4.
 */
export function getPalierSuivant(
  scorePalierActuel: number,
  palierActuel: number
): number | null {
  if (scorePalierActuel >= 2 && palierActuel < 4) return palierActuel + 1;
  return null;
}

/**
 * Computes the final profile from tiers reached per competence.
 */
export function calculerProfilFinal(paliers: {
  co: number;
  ce: number;
  eo: number;
  ee: number;
}): string {
  const scores = Object.values(paliers);
  const moyenne = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (moyenne <= 1.5) return "A0_bas";
  if (moyenne <= 2.5) return "A0_intermediaire";
  if (moyenne <= 3.5) return "A0_haut";
  return "A1_maitrise";
}

/**
 * Suggests a learning group based on profile.
 */
export function suggererGroupe(profil: string): string {
  if (profil === "A0_bas" || profil === "A0_intermediaire") return "groupe_1";
  return "groupe_2";
}

/**
 * Profile label for display.
 */
export function getProfilLabel(profil: string): string {
  switch (profil) {
    case "A0_bas":
      return "Niveau A0 débutant";
    case "A0_intermediaire":
      return "Niveau A0 intermédiaire";
    case "A0_haut":
      return "Niveau A0 avancé";
    case "A1_maitrise":
      return "Niveau A1";
    default:
      return profil;
  }
}

/**
 * Encouraging message by profile.
 */
export function getProfilMessage(profil: string): string {
  switch (profil) {
    case "A0_bas":
      return "Vous commencez votre parcours en français. Bienvenue ! Votre formateur vous accompagnera pas à pas.";
    case "A0_intermediaire":
      return "Vous avez de bonnes bases. Continuez ainsi !";
    case "A0_haut":
      return "Très bon début ! Vous progressez rapidement.";
    case "A1_maitrise":
      return "Excellent ! Vous maîtrisez déjà les bases du français.";
    default:
      return "";
  }
}

/**
 * Evaluates an EO or EE response using Gemini via tcf-evaluate-answer edge function.
 */
export async function evaluerReponseIA(
  question: { criteres_evaluation: unknown },
  reponseApprenant: string,
  metadata?: { code?: string; type_reponse?: string; mots_cles_attendus?: string[] }
): Promise<{
  score: number;
  justification: string;
  reformulationModele?: string;
  scoreRaw10?: number;
  resultat?: "correct" | "partiellement_correct" | "incorrect";
}> {
  const rule = metadata?.type_reponse === "oral"
    ? "Évaluation orale FLE : prononciation, vocabulaire, grammaire, cohérence"
    : "Grammaire et compréhension FLE";

  const exerciseContent = typeof question.criteres_evaluation === "object"
    ? JSON.stringify(question.criteres_evaluation)
    : String(question.criteres_evaluation ?? "Exercice FLE");

  const { data, error } = await supabase.functions.invoke(
    "tcf-evaluate-answer",
    {
      body: {
        studentAnswer: reponseApprenant,
        exerciseContent,
        rule,
      },
    }
  );

  if (error) {
    console.error("AI evaluation error:", error);
    return { score: 0, justification: "Évaluation IA indisponible." };
  }

  // L'edge tcf-evaluate-answer renvoie maintenant un score 0-10 (champ `score`,
  // alias `score_estime`). On le convertit en /3 pour la compat historique.
  const rawScore = Number(data?.score ?? data?.score_estime ?? 0);
  const safeRaw = Math.max(0, Math.min(10, Math.round(isFinite(rawScore) ? rawScore : 0)));
  const normalizedScore = Math.round((safeRaw / 10) * 3);

  return {
    score: normalizedScore,
    scoreRaw10: safeRaw,
    justification: data?.justification ?? data?.correction_text ?? "Pas de justification disponible.",
    reformulationModele: data?.reformulation_modele ?? undefined,
    resultat: data?.resultat,
  };
}

/**
 * Competence order for the test flow.
 */
export const COMPETENCE_ORDER = ["CO", "CE", "EO", "EE"] as const;

export type TestCompetence = (typeof COMPETENCE_ORDER)[number];
