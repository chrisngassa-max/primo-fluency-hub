import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculates and upserts profils_eleves for a student based on all their resultats.
 * Shared across BilanSeance, BilanTestPassation, DevoirPassation.
 *
 * Bonus handling:
 * - resultats.is_bonus = true sont EXCLUS des taux de réussite (un bonus raté ne pénalise pas).
 * - Un bonus réussi (score >= 70) alimente un signal `eleve_en_avance` exposé via priorites_pedagogiques.
 */
export async function updateProfilEleve(eleveId: string, niveauActuel?: string): Promise<void> {
  const { data: allResults } = await supabase
    .from("resultats")
    .select("score, is_bonus, exercice:exercices(competence)")
    .eq("eleve_id", eleveId);

  if (!allResults || allResults.length === 0) return;

  const byCompetence: Record<string, number[]> = {};
  const allScores: number[] = [];
  let bonusCount = 0;
  let bonusReussisCount = 0;

  for (const r of allResults as Array<{
    score: number;
    is_bonus?: boolean | null;
    exercice: { competence: string } | null;
  }>) {
    const score = Number(r.score);
    const isBonus = r.is_bonus === true;
    if (isBonus) {
      bonusCount++;
      if (score >= 70) bonusReussisCount++;
      // bonus exclus des taux de réussite
      continue;
    }
    allScores.push(score);
    const comp = r.exercice?.competence;
    if (comp) {
      if (!byCompetence[comp]) byCompetence[comp] = [];
      byCompetence[comp].push(score);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const globalAvg = avg(allScores);

  // Fetch previous profile to compute progression speed
  const { data: previous } = await supabase
    .from("profils_eleves")
    .select("taux_reussite_global, updated_at")
    .eq("eleve_id", eleveId)
    .maybeSingle();

  let vitesse_progression: "rapide" | "normale" | "lente" = "normale";
  let score_progression_delta = 0;

  if (previous?.taux_reussite_global != null) {
    const delta = globalAvg - Number(previous.taux_reussite_global);
    score_progression_delta = delta;
    const daysSince = previous.updated_at
      ? (Date.now() - new Date(previous.updated_at).getTime()) / 86400000
      : 7;
    const deltaPerDay = daysSince > 0 ? delta / daysSince : 0;
    if (deltaPerDay > 1.5) vitesse_progression = "rapide";
    else if (deltaPerDay < 0.3) vitesse_progression = "lente";
  }

  // Signal "élève en avance" : >=2 bonus réussis OU >=60% des bonus réussis avec >=3 tentatives
  const ratioBonusReussis = bonusCount > 0 ? bonusReussisCount / bonusCount : 0;
  const eleve_en_avance =
    bonusReussisCount >= 2 || (bonusCount >= 3 && ratioBonusReussis >= 0.6);

  // Determine niveau
  let niveau = niveauActuel;
  if (!niveau) {
    if (globalAvg >= 80) niveau = "B1";
    else if (globalAvg >= 60) niveau = "A2";
    else if (globalAvg >= 30) niveau = "A1";
    else niveau = "A0";
  }

  await supabase.from("profils_eleves").upsert({
    eleve_id: eleveId,
    taux_reussite_global: globalAvg,
    taux_reussite_co: avg(byCompetence["CO"] ?? []),
    taux_reussite_ce: avg(byCompetence["CE"] ?? []),
    taux_reussite_ee: avg(byCompetence["EE"] ?? []),
    taux_reussite_eo: avg(byCompetence["EO"] ?? []),
    taux_reussite_structures: avg(byCompetence["Structures"] ?? []),
    niveau_actuel: niveau,
    priorites_pedagogiques: JSON.parse(JSON.stringify({
      vitesse_progression,
      score_progression_delta,
      bonus_count: bonusCount,
      bonus_reussis: bonusReussisCount,
      eleve_en_avance,
    })),
    updated_at: new Date().toISOString(),
  } as any, { onConflict: "eleve_id" });
}
