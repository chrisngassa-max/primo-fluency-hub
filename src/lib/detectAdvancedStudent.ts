/**
 * Détection légère des élèves "en avance" pour l'espace formateur.
 *
 * ⚠️ IMPORTANT — Ce signal est strictement réservé à l'affichage formateur.
 * Il ne doit JAMAIS apparaître côté élève (consigne pédagogique :
 * éviter les étiquettes hiérarchisantes pour le public allophone primo-arrivant).
 *
 * Aucun nouveau scoring : on combine uniquement des données déjà calculées
 * et déjà stockées :
 *   - profils_eleves.taux_reussite_global / par compétence
 *   - profils_eleves.priorites_pedagogiques.eleve_en_avance (signal bonus)
 *   - student_competency_status (compétences acquises / acquis_provisoire)
 *   - devoirs (faits vs total non archivé)
 *   - resultats récents (moyenne, hors bonus pénalisants)
 *   - parametres.seuil_acquis (seuil formateur, défaut 80)
 *
 * Un élève est "en avance" si AU MOINS 2 des 4 signaux ci-dessous sont vrais :
 *   1. moyenne_recente >= seuil_acquis (sur les 5 derniers résultats non bonus)
 *   2. ratio_devoirs_faits >= 0.7 sur >= 3 devoirs
 *   3. >= 2 compétences en `acquis` ou `acquis_provisoire`
 *   4. signal bonus déjà calculé : priorites_pedagogiques.eleve_en_avance === true
 */

import { supabase } from "@/integrations/supabase/client";

export interface AdvancedSignal {
  isAdvanced: boolean;
  reasons: string[];
}

export interface AdvancedDetectionInput {
  taux_reussite_global?: number | null;
  priorites_pedagogiques?: any;
  recentScores: number[]; // hors bonus
  devoirsTotal: number;
  devoirsFaits: number;
  competencesAcquises: number; // statut acquis | acquis_provisoire
  bonusReussis: number;
  seuilAcquis: number; // défaut 80
}

export function isAdvancedStudent(input: AdvancedDetectionInput): AdvancedSignal {
  const reasons: string[] = [];
  const seuil = Number(input.seuilAcquis) || 80;

  // 1. Moyenne récente élevée
  if (input.recentScores.length >= 3) {
    const avg = input.recentScores.reduce((a, b) => a + b, 0) / input.recentScores.length;
    if (avg >= seuil) {
      reasons.push(`Moyenne récente ${Math.round(avg)}% ≥ ${seuil}%`);
    }
  }

  // 2. Devoirs majoritairement faits
  if (input.devoirsTotal >= 3) {
    const ratio = input.devoirsFaits / input.devoirsTotal;
    if (ratio >= 0.7) {
      reasons.push(`Devoirs faits ${input.devoirsFaits}/${input.devoirsTotal}`);
    }
  }

  // 3. Plusieurs compétences acquises
  if (input.competencesAcquises >= 2) {
    reasons.push(`${input.competencesAcquises} compétences acquises`);
  }

  // 4. Signal bonus déjà calculé dans priorites_pedagogiques
  const prio = input.priorites_pedagogiques;
  const bonusFlag =
    (prio && typeof prio === "object" && (prio as any).eleve_en_avance === true) ||
    input.bonusReussis >= 2;
  if (bonusFlag) {
    reasons.push(
      input.bonusReussis >= 2
        ? `${input.bonusReussis} bonus réussis`
        : "Bonus réussis (profil)"
    );
  }

  return { isAdvanced: reasons.length >= 2, reasons };
}

/**
 * Récupère et calcule en lot les signaux pour une liste d'élèves
 * et un formateur donné. Renvoie une map eleve_id -> AdvancedSignal.
 *
 * Conçue pour un usage côté formateur uniquement (RLS sur les tables
 * sources = profils_eleves / student_competency_status / devoirs /
 * resultats / parametres).
 */
export async function detectAdvancedStudentsBatch(
  eleveIds: string[],
  formateurId: string
): Promise<Record<string, AdvancedSignal>> {
  const result: Record<string, AdvancedSignal> = {};
  if (!eleveIds.length) return result;

  // Seuil formateur
  let seuilAcquis = 80;
  try {
    const { data: param } = await supabase
      .from("parametres")
      .select("seuil_acquis")
      .eq("formateur_id", formateurId)
      .maybeSingle();
    if (param?.seuil_acquis) seuilAcquis = Number(param.seuil_acquis);
  } catch {
    /* ignore — fallback 80 */
  }

  // Fetch en parallèle
  const [profilsRes, statusRes, devoirsRes, resultatsRes] = await Promise.all([
    supabase
      .from("profils_eleves")
      .select("eleve_id, taux_reussite_global, priorites_pedagogiques")
      .in("eleve_id", eleveIds),
    supabase
      .from("student_competency_status")
      .select("eleve_id, statut")
      .in("eleve_id", eleveIds),
    supabase
      .from("devoirs")
      .select("eleve_id, statut, archived_at")
      .in("eleve_id", eleveIds),
    supabase
      .from("resultats")
      .select("eleve_id, score, created_at, is_bonus")
      .in("eleve_id", eleveIds)
      .order("created_at", { ascending: false })
      .limit(eleveIds.length * 10),
  ]);

  const profilMap = new Map<string, any>();
  (profilsRes.data ?? []).forEach((p: any) => profilMap.set(p.eleve_id, p));

  const acquisCount: Record<string, number> = {};
  (statusRes.data ?? []).forEach((s: any) => {
    if (s.statut === "acquis" || s.statut === "acquis_provisoire") {
      acquisCount[s.eleve_id] = (acquisCount[s.eleve_id] ?? 0) + 1;
    }
  });

  const devoirsAgg: Record<string, { total: number; faits: number }> = {};
  (devoirsRes.data ?? []).forEach((d: any) => {
    if (d.archived_at) return;
    const a = (devoirsAgg[d.eleve_id] = devoirsAgg[d.eleve_id] ?? { total: 0, faits: 0 });
    a.total += 1;
    if (d.statut === "fait") a.faits += 1;
  });

  const recentByEleve: Record<string, number[]> = {};
  const bonusByEleve: Record<string, number> = {};
  (resultatsRes.data ?? []).forEach((r: any) => {
    if (r.is_bonus) {
      if (Number(r.score) >= 70) bonusByEleve[r.eleve_id] = (bonusByEleve[r.eleve_id] ?? 0) + 1;
      return;
    }
    const arr = (recentByEleve[r.eleve_id] = recentByEleve[r.eleve_id] ?? []);
    if (arr.length < 5) arr.push(Number(r.score));
  });

  for (const eleveId of eleveIds) {
    const profil = profilMap.get(eleveId);
    const dev = devoirsAgg[eleveId] ?? { total: 0, faits: 0 };
    result[eleveId] = isAdvancedStudent({
      taux_reussite_global: profil?.taux_reussite_global ?? 0,
      priorites_pedagogiques: profil?.priorites_pedagogiques ?? null,
      recentScores: recentByEleve[eleveId] ?? [],
      devoirsTotal: dev.total,
      devoirsFaits: dev.faits,
      competencesAcquises: acquisCount[eleveId] ?? 0,
      bonusReussis: bonusByEleve[eleveId] ?? 0,
      seuilAcquis,
    });
  }

  return result;
}
