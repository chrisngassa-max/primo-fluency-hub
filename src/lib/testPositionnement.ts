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
 * Evaluates an EO or EE response using the existing AI engine via edge function.
 */
export async function evaluerReponseIA(
  question: { criteres_evaluation: unknown },
  reponseApprenant: string
): Promise<{ score: number; justification: string }> {
  const { data, error } = await supabase.functions.invoke(
    "evaluate-test-response",
    {
      body: {
        criteres_evaluation: question.criteres_evaluation,
        reponse_apprenant: reponseApprenant,
      },
    }
  );

  if (error) {
    console.error("AI evaluation error:", error);
    return { score: 0, justification: "Évaluation IA indisponible." };
  }

  return {
    score: data?.score ?? 0,
    justification: data?.justification ?? "Pas de justification disponible.",
  };
}

/**
 * Competence order for the test flow.
 */
export const COMPETENCE_ORDER = ["CO", "CE", "EO", "EE"] as const;

export type TestCompetence = (typeof COMPETENCE_ORDER)[number];
