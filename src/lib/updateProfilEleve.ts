import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculates and upserts profils_eleves for a student based on all their resultats.
 * Shared across BilanSeance, BilanTestPassation, DevoirPassation.
 */
export async function updateProfilEleve(eleveId: string, niveauActuel?: string): Promise<void> {
  // Fetch all results for this student with competence info
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

  const compFieldMap: Record<string, string> = {
    CO: "taux_reussite_co",
    CE: "taux_reussite_ce",
    EE: "taux_reussite_ee",
    EO: "taux_reussite_eo",
    Structures: "taux_reussite_structures",
  };

  const profilUpdate: Record<string, unknown> = {
    eleve_id: eleveId,
    taux_reussite_global: globalAvg,
    updated_at: new Date().toISOString(),
  };

  if (niveauActuel) {
    profilUpdate.niveau_actuel = niveauActuel;
  }

  for (const [comp, field] of Object.entries(compFieldMap)) {
    if (byCompetence[comp]) {
      profilUpdate[field] = avg(byCompetence[comp]);
    }
  }

  // Need niveau_actuel for insert — use provided or estimate from score
  if (!profilUpdate.niveau_actuel) {
    if (globalAvg >= 80) profilUpdate.niveau_actuel = "B1";
    else if (globalAvg >= 60) profilUpdate.niveau_actuel = "A2";
    else if (globalAvg >= 30) profilUpdate.niveau_actuel = "A1";
    else profilUpdate.niveau_actuel = "A0";
  }

  await supabase
    .from("profils_eleves")
    .upsert(profilUpdate as Parameters<typeof supabase.from<"profils_eleves">>[0] extends infer T ? Record<string, unknown> : never, { onConflict: "eleve_id" } as never);
}
