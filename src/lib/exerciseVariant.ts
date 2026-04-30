/**
 * Sélection et application des variantes d'exercices côté élève.
 *
 * Les exercices peuvent contenir deux variantes optionnelles :
 *   - variante_niveau_bas  : version simplifiée (consigne reformulée, aide,
 *     nb_items_reduit)
 *   - variante_niveau_haut : version enrichie (consigne avec contrainte
 *     supplémentaire, extension)
 *
 * Ces colonnes existent déjà sur la table `exercices` mais n'étaient pas
 * servies. Ce module choisit la variante adaptée au profil élève / au statut
 * de séance, puis fusionne les champs dans `consigne` + `contenu` de manière
 * transparente — aucune mention "version basse / haute" n'est exposée à
 * l'élève.
 */

import { supabase } from "@/integrations/supabase/client";

export type StudentExerciseLevel = "bas" | "standard" | "haut";

export interface ExerciseVariantInput {
  consigne?: string | null;
  contenu?: any;
  variante_niveau_bas?: any;
  variante_niveau_haut?: any;
}

export interface ExerciseVariantOutput {
  consigne: string;
  contenu: any;
  appliedLevel: StudentExerciseLevel;
}

/**
 * Applique la variante choisie sur l'exercice. Si la variante demandée
 * n'existe pas, retourne la version standard (fallback silencieux).
 */
export function applyExerciseVariant(
  ex: ExerciseVariantInput,
  level: StudentExerciseLevel,
): ExerciseVariantOutput {
  const baseContenu = (ex?.contenu ?? {}) as any;
  const baseConsigne = ex?.consigne ?? "";

  if (level === "bas" && ex?.variante_niveau_bas) {
    const v = ex.variante_niveau_bas as any;
    let consigne = typeof v.consigne === "string" && v.consigne.trim()
      ? v.consigne
      : baseConsigne;
    if (typeof v.aide === "string" && v.aide.trim()) {
      consigne = `${consigne}\n\n💡 ${v.aide}`;
    }
    let contenu = { ...baseContenu };
    // Réduction du nombre d'items si demandé
    const n = Number(v.nb_items_reduit);
    if (Number.isFinite(n) && n > 0 && Array.isArray(baseContenu?.items)) {
      contenu = { ...contenu, items: baseContenu.items.slice(0, n) };
    }
    return { consigne, contenu, appliedLevel: "bas" };
  }

  if (level === "haut" && ex?.variante_niveau_haut) {
    const v = ex.variante_niveau_haut as any;
    let consigne = typeof v.consigne === "string" && v.consigne.trim()
      ? v.consigne
      : baseConsigne;
    if (typeof v.extension === "string" && v.extension.trim()) {
      consigne = `${consigne}\n\n➕ ${v.extension}`;
    }
    return { consigne, contenu: baseContenu, appliedLevel: "haut" };
  }

  return { consigne: baseConsigne, contenu: baseContenu, appliedLevel: "standard" };
}

/**
 * Mappe le statut d'objectif de séance vers un niveau de variante.
 */
export function outcomeStatusToLevel(status?: string | null): StudentExerciseLevel {
  switch (status) {
    case "non_atteint":
      return "bas";
    case "au_dela":
      return "haut";
    case "a_consolider":
    case "atteint":
    case "absent":
    default:
      return "standard";
  }
}

/**
 * Mappe un `source_label` de devoir vers un niveau de variante.
 */
export function sourceLabelToLevel(label?: string | null): StudentExerciseLevel | null {
  if (!label) return null;
  if (label === "outcome_rattrapage" || label === "outcome_remediation") return "bas";
  if (label === "outcome_approfondissement") return "haut";
  return null;
}

/**
 * Détermine le niveau adapté pour (élève, séance, devoir) en interrogeant :
 *   1. le `source_label` du devoir (signal le plus précis)
 *   2. `session_student_outcomes` pour la séance courante
 *   3. `profils_eleves.priorites_pedagogiques` (élève en avance / soutien)
 */
export async function resolveStudentExerciseLevel(opts: {
  eleveId: string;
  sessionId?: string | null;
  sourceLabel?: string | null;
}): Promise<StudentExerciseLevel> {
  const { eleveId, sessionId, sourceLabel } = opts;

  // 1) source_label du devoir
  const fromLabel = sourceLabelToLevel(sourceLabel);
  if (fromLabel) return fromLabel;

  // 2) outcome de séance
  if (sessionId) {
    try {
      const { data } = await supabase
        .from("session_student_outcomes")
        .select("objectif_status")
        .eq("session_id", sessionId)
        .eq("eleve_id", eleveId)
        .maybeSingle();
      if (data?.objectif_status) {
        return outcomeStatusToLevel(data.objectif_status as string);
      }
    } catch {
      /* ignore */
    }
  }

  // 3) profil élève
  try {
    const { data } = await supabase
      .from("profils_eleves")
      .select("priorites_pedagogiques")
      .eq("eleve_id", eleveId)
      .maybeSingle();
    const prios = (data?.priorites_pedagogiques ?? []) as unknown as string[];
    if (Array.isArray(prios)) {
      if (prios.includes("eleve_en_avance")) return "haut";
      if (prios.includes("soutien") || prios.includes("remediation")) return "bas";
    }
  } catch {
    /* ignore */
  }

  return "standard";
}
