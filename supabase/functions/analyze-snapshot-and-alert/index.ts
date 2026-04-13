import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: params } = await supabase
      .from("parametres")
      .select("seuil_baisse_pourcent, seuil_stagnation_semaines, seuil_devoirs_non_rendus_relance, seuil_devoirs_non_rendus_entretien")
      .limit(1)
      .single();

    const SEUIL_BAISSE = params?.seuil_baisse_pourcent ?? 15;
    const SEUIL_STAGNATION_SEMAINES = params?.seuil_stagnation_semaines ?? 3;
    const SEUIL_DEVOIRS_RELANCE = params?.seuil_devoirs_non_rendus_relance ?? 2;
    const SEUIL_DEVOIRS_ENTRETIEN = params?.seuil_devoirs_non_rendus_entretien ?? 4;

    const alertsToInsert: any[] = [];
    const now = new Date().toISOString();

    const { data: allSnapshots } = await supabase
      .from("progression_snapshots")
      .select("eleve_id, snapshot_date, score_global, tendance, nb_devoirs_fait")
      .order("snapshot_date", { ascending: false });

    const snapshotsByEleve: Record<string, any[]> = {};
    (allSnapshots ?? []).forEach(s => {
      if (!snapshotsByEleve[s.eleve_id]) snapshotsByEleve[s.eleve_id] = [];
      if (snapshotsByEleve[s.eleve_id].length < 4) snapshotsByEleve[s.eleve_id].push(s);
    });

    const { data: devoirsEnAttente } = await supabase
      .from("devoirs")
      .select("eleve_id, statut")
      .in("statut", ["en_attente", "expire"]);

    const devoirsNonRendusByEleve: Record<string, number> = {};
    (devoirsEnAttente ?? []).forEach(d => {
      devoirsNonRendusByEleve[d.eleve_id] = (devoirsNonRendusByEleve[d.eleve_id] ?? 0) + 1;
    });

    const eleveIds = Object.keys(snapshotsByEleve);
    const { data: profils } = await supabase
      .from("profils_eleves")
      .select("eleve_id, formateur_id, groupe_id")
      .in("eleve_id", eleveIds);

    const profilByEleve: Record<string, any> = {};
    (profils ?? []).forEach(p => { profilByEleve[p.eleve_id] = p; });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingAlerts } = await supabase
      .from("alertes")
      .select("eleve_id, type")
      .gte("created_at", oneDayAgo);

    const existingAlertKeys = new Set(
      (existingAlerts ?? []).map(a => `${a.eleve_id}:${a.type}`)
    );

    for (const [eleveId, snapshots] of Object.entries(snapshotsByEleve)) {
      const latest = snapshots[0];
      const profil = profilByEleve[eleveId];
      const formateurId = profil?.formateur_id ?? null;
      const groupeId = profil?.groupe_id ?? null;
      const nbNonRendus = devoirsNonRendusByEleve[eleveId] ?? 0;

      if (snapshots.length >= 2) {
        const prev = snapshots[1];
        if (latest.score_global !== null && prev.score_global !== null &&
            prev.score_global - latest.score_global >= SEUIL_BAISSE) {
          const key = `${eleveId}:tendance_baisse`;
          if (!existingAlertKeys.has(key)) {
            alertsToInsert.push({
              eleve_id: eleveId, formateur_id: formateurId, group_id: groupeId,
              type: "tendance_baisse", alert_category: "apprenant",
              message: `Score en baisse de ${Math.round(prev.score_global - latest.score_global)}% (${Math.round(latest.score_global)}% vs ${Math.round(prev.score_global)}%).`,
              recommandation: "Planifier un entretien individuel et proposer des exercices de remédiation.",
              created_at: now,
            });
          }
        }
      }

      if (snapshots.length >= SEUIL_STAGNATION_SEMAINES) {
        const recentScores = snapshots.slice(0, SEUIL_STAGNATION_SEMAINES)
          .map(s => s.score_global).filter(s => s !== null) as number[];
        if (recentScores.length === SEUIL_STAGNATION_SEMAINES) {
          const max = Math.max(...recentScores);
          const min = Math.min(...recentScores);
          if (max - min < 5) {
            const key = `${eleveId}:stagnation`;
            if (!existingAlertKeys.has(key)) {
              alertsToInsert.push({
                eleve_id: eleveId, formateur_id: formateurId, group_id: groupeId,
                type: "score_risque", alert_category: "apprenant",
                message: `Progression stagnante depuis ${SEUIL_STAGNATION_SEMAINES} semaines (score entre ${Math.round(min)}% et ${Math.round(max)}%).`,
                recommandation: "Revoir le parcours et diversifier les exercices.",
                created_at: now,
              });
            }
          }
        }
      }

      if (nbNonRendus >= SEUIL_DEVOIRS_ENTRETIEN) {
        const key = `${eleveId}:devoir_expire`;
        if (!existingAlertKeys.has(key)) {
          alertsToInsert.push({
            eleve_id: eleveId, formateur_id: formateurId, group_id: groupeId,
            type: "devoir_expire", alert_category: "apprenant",
            message: `${nbNonRendus} devoirs non rendus — situation préoccupante.`,
            recommandation: "Entretien individuel recommandé.",
            created_at: now,
          });
        }
      } else if (nbNonRendus >= SEUIL_DEVOIRS_RELANCE) {
        const key = `${eleveId}:abandon_eleve`;
        if (!existingAlertKeys.has(key)) {
          alertsToInsert.push({
            eleve_id: eleveId, formateur_id: formateurId, group_id: groupeId,
            type: "abandon_eleve", alert_category: "apprenant",
            message: `${nbNonRendus} devoirs non rendus — relance nécessaire.`,
            recommandation: "Envoyer un message de relance.",
            created_at: now,
          });
        }
      }
    }

    const { data: qualityProblems } = await supabase
      .from("exercise_quality")
      .select("exercise_id, abandon_rate, avg_score_normalized, total_attempts")
      .or("abandon_rate.gte.0.5,avg_score_normalized.lte.20")
      .gte("total_attempts", 5);

    for (const q of qualityProblems ?? []) {
      const isAbandon = (q.abandon_rate ?? 0) >= 0.5;
      const isScoreBas = (q.avg_score_normalized ?? 100) <= 20;
      const alreadyExists = (existingAlerts ?? []).some(
        a => a.type === "contenu_problematique" && (a as any).exercise_id === q.exercise_id
      );
      if (alreadyExists) continue;
      alertsToInsert.push({
        exercise_id: q.exercise_id,
        type: "contenu_problematique", alert_category: "contenu",
        message: isAbandon && isScoreBas
          ? `Exercice problématique : abandon ${Math.round((q.abandon_rate ?? 0) * 100)}% ET score ${Math.round(q.avg_score_normalized ?? 0)}%.`
          : isAbandon
            ? `Taux d'abandon élevé : ${Math.round((q.abandon_rate ?? 0) * 100)}% sur ${q.total_attempts} tentatives.`
            : `Score moyen très bas : ${Math.round(q.avg_score_normalized ?? 0)}% sur ${q.total_attempts} tentatives.`,
        recommandation: isAbandon && isScoreBas
          ? "Retirer cet exercice et le retravailler entièrement."
          : isAbandon
            ? "Revoir la formulation des consignes."
            : "Vérifier le niveau de difficulté.",
        created_at: now,
      });
    }

    if (alertsToInsert.length > 0) {
      const { error } = await supabase.from("alertes").insert(alertsToInsert);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: alertsToInsert.length,
        apprenant: alertsToInsert.filter(a => a.alert_category === "apprenant").length,
        contenu: alertsToInsert.filter(a => a.alert_category === "contenu").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
