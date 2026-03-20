import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculates and upserts profils_eleves for a student based on all their resultats.
 * Shared across BilanSeance, BilanTestPassation, DevoirPassation.
 */
export async function updateProfilEleve(eleveId: string, niveauActuel?: string): Promise<void> {
  const { data: allResults } = await supabase
    .from("resultats")
    .select("score, exercice:exercices(competence)")
    .eq("eleve_id", eleveId);

  if (!allResults || allResults.length === 0) return;

  const byCompetence: Record<string, number[]> = {};
  const allScores: number[] = [];

  for (const r of allResults) {
    const score = Number(r.score);
    allScores.push(score);
    const comp = (r.exercice as { competence: string } | null)?.competence;
    if (comp) {
      if (!byCompetence[comp]) byCompetence[comp] = [];
      byCompetence[comp].push(score);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const globalAvg = avg(allScores);

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
    updated_at: new Date().toISOString(),
  }, { onConflict: "eleve_id" });
}
