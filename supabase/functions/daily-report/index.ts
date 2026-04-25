// Génère un rapport quotidien des signalements pour chaque formateur (matin/soir)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const kind = (url.searchParams.get("kind") ?? "morning") as "morning" | "evening";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const today = new Date();
    const reportDate = today.toISOString().slice(0, 10);
    // Fenêtre : 24h pour morning (veille), journée en cours pour evening
    const since = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Récupère tous les formateurs ayant des signalements dans la fenêtre
    const { data: reports } = await supabase
      .from("exercise_reports")
      .select("*")
      .gte("created_at", since);

    const byFormateur = new Map<string, any[]>();
    for (const r of reports ?? []) {
      if (!r.formateur_id) continue;
      if (!byFormateur.has(r.formateur_id)) byFormateur.set(r.formateur_id, []);
      byFormateur.get(r.formateur_id)!.push(r);
    }

    let count = 0;
    for (const [formateurId, list] of byFormateur) {
      const total = list.length;
      const auto = list.filter((r) => r.ai_auto_applied).length;
      const pending = list.filter(
        (r) => r.ai_processed_at && !r.ai_auto_applied && r.formateur_decision === "pending"
      ).length;
      const byType: Record<string, number> = {};
      for (const r of list) {
        const t = r.ai_problem_type ?? "non_analyse";
        byType[t] = (byType[t] ?? 0) + 1;
      }

      const summary = {
        kind,
        window_hours: 24,
        by_type: byType,
        sample: list.slice(0, 5).map((r) => ({
          id: r.id,
          context: r.context,
          problem: r.ai_analysis?.problem_description ?? r.comment ?? "(non analysé)",
          confidence: r.ai_confidence,
          auto_applied: r.ai_auto_applied,
        })),
      };

      const { error: upErr } = await supabase
        .from("daily_reports")
        .upsert(
          {
            formateur_id: formateurId,
            report_date: reportDate,
            kind,
            summary,
            total_reports: total,
            auto_applied: auto,
            pending_validation: pending,
            is_read: false,
          },
          { onConflict: "formateur_id,report_date,kind" }
        );
      if (upErr) {
        console.warn("daily_report upsert error", upErr);
        continue;
      }

      // Notification in-app
      const titre =
        kind === "morning"
          ? `📊 Rapport du jour : ${total} signalement(s)`
          : `🌙 Récap du soir : ${total} signalement(s)`;
      const msg = `${auto} correction(s) appliquée(s) automatiquement, ${pending} à valider.`;
      await supabase.from("notifications").insert({
        user_id: formateurId,
        titre,
        message: msg,
        link: "/#/formateur/signalements",
      });
      count++;
    }

    return new Response(
      JSON.stringify({ ok: true, kind, generated: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("daily-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
