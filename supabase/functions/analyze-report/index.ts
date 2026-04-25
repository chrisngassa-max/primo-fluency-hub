// Analyse IA d'un signalement d'élève + correction automatique si possible
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTO_APPLY_THRESHOLD = 0.85;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { reportId } = await req.json();
    if (!reportId) throw new Error("reportId requis");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Charger le signalement
    const { data: report, error: rErr } = await supabase
      .from("exercise_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();
    if (rErr || !report) throw new Error("Signalement introuvable");

    // 2) Charger l'exercice associé (si exercice ou devoir)
    let exercice: any = null;
    let exerciceIdResolved: string | null = report.exercice_id ?? null;
    if (!exerciceIdResolved && report.devoir_id) {
      const { data: dev } = await supabase
        .from("devoirs")
        .select("exercice_id")
        .eq("id", report.devoir_id)
        .maybeSingle();
      exerciceIdResolved = dev?.exercice_id ?? null;
    }
    if (exerciceIdResolved) {
      const { data: ex } = await supabase
        .from("exercices")
        .select("*")
        .eq("id", exerciceIdResolved)
        .maybeSingle();
      exercice = ex;
    }

    // 3) Capture d'écran en base64 si dispo
    let imageDataUrl: string | null = null;
    if (report.screenshot_path) {
      try {
        const { data: blob } = await supabase.storage
          .from("exercise-reports")
          .download(report.screenshot_path);
        if (blob) {
          const buf = new Uint8Array(await blob.arrayBuffer());
          // base64
          let bin = "";
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
          imageDataUrl = `data:image/jpeg;base64,${btoa(bin)}`;
        }
      } catch (e) {
        console.warn("Screenshot download failed:", e);
      }
    }

    // 4) Construire le prompt + appel Gemini multimodal via Lovable AI
    const contextItem =
      exercice && report.item_index != null
        ? exercice?.contenu?.items?.[report.item_index] ?? null
        : null;

    const systemPrompt = `Tu es un assistant pédagogique expert TCF IRN (FLE A1-B1).
Un élève signale un problème sur un exercice. Tu dois :
1. Identifier le TYPE de problème : "contenu" (erreur dans la question/réponse/consigne), "technique" (bug d'affichage, audio absent), "pedagogique" (item inadapté au niveau).
2. Décrire précisément le problème.
3. Proposer une SOLUTION concrète. Pour le type "contenu", fournis l'item corrigé complet (même structure JSON que l'original).
4. Évaluer ta CONFIANCE (0.0 à 1.0).

Réponds UNIQUEMENT via l'outil report_analysis.`;

    const userTextParts: string[] = [];
    userTextParts.push(`Contexte de signalement : ${report.context}`);
    if (report.comment) userTextParts.push(`Commentaire de l'élève : "${report.comment}"`);
    else userTextParts.push(`L'élève n'a pas commenté — analyse via la capture et le contenu.`);
    if (exercice) {
      userTextParts.push(
        `Exercice : ${exercice.titre} (${exercice.competence}, ${exercice.format}, niveau ${exercice.niveau_vise})`
      );
      userTextParts.push(`Consigne : ${exercice.consigne}`);
    }
    if (contextItem) {
      userTextParts.push(
        `Item signalé (#${report.item_index! + 1}) : ${JSON.stringify(contextItem)}`
      );
    } else if (exercice?.contenu) {
      userTextParts.push(
        `Contenu complet de l'exercice : ${JSON.stringify(exercice.contenu).slice(0, 4000)}`
      );
    }

    const userContent: any[] = [{ type: "text", text: userTextParts.join("\n\n") }];
    if (imageDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: imageDataUrl } });
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_analysis",
                description: "Analyse structurée du signalement",
                parameters: {
                  type: "object",
                  properties: {
                    problem_type: {
                      type: "string",
                      enum: ["contenu", "technique", "pedagogique", "inconnu"],
                    },
                    problem_description: { type: "string" },
                    proposed_solution_text: {
                      type: "string",
                      description: "Description en français de la correction proposée",
                    },
                    corrected_item: {
                      type: "object",
                      description:
                        "Pour type=contenu uniquement : item corrigé complet (même structure JSON que l'original). Sinon null.",
                      additionalProperties: true,
                    },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                  },
                  required: [
                    "problem_type",
                    "problem_description",
                    "proposed_solution_text",
                    "confidence",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "report_analysis" } },
        }),
      }
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI gateway ${aiResp.status}: ${t}`);
    }
    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Pas de tool_call dans la réponse IA");
    const analysis = JSON.parse(toolCall.function.arguments);

    // 5) Application automatique si confiance OK + type contenu + item corrigé
    let auto_applied = false;
    let applied_at: string | null = null;
    let snapshot: any = null;
    if (
      analysis.problem_type === "contenu" &&
      analysis.confidence >= AUTO_APPLY_THRESHOLD &&
      analysis.corrected_item &&
      exercice &&
      report.item_index != null &&
      Array.isArray(exercice.contenu?.items)
    ) {
      snapshot = exercice.contenu;
      const newItems = [...exercice.contenu.items];
      newItems[report.item_index] = {
        ...newItems[report.item_index],
        ...analysis.corrected_item,
      };
      const newContenu = { ...exercice.contenu, items: newItems };
      const { error: upErr } = await supabase
        .from("exercices")
        .update({ contenu: newContenu, updated_at: new Date().toISOString() })
        .eq("id", exercice.id);
      if (!upErr) {
        auto_applied = true;
        applied_at = new Date().toISOString();
      } else {
        console.warn("Application auto échouée:", upErr);
      }
    }

    // 6) MAJ signalement
    await supabase
      .from("exercise_reports")
      .update({
        ai_analysis: analysis,
        ai_problem_type: analysis.problem_type,
        ai_proposed_solution: {
          text: analysis.proposed_solution_text,
          corrected_item: analysis.corrected_item ?? null,
        },
        ai_confidence: analysis.confidence,
        ai_processed_at: new Date().toISOString(),
        ai_auto_applied: auto_applied,
        ai_applied_at: applied_at,
        exercice_snapshot: snapshot,
        formateur_decision: auto_applied ? "pending" : "pending",
        status: auto_applied ? "en_cours" : "nouveau",
      })
      .eq("id", reportId);

    // 7) Notification in-app au formateur
    if (report.formateur_id) {
      await supabase.from("notifications").insert({
        user_id: report.formateur_id,
        titre: auto_applied
          ? "🤖 Correction IA appliquée"
          : "📝 Signalement à valider",
        message: auto_applied
          ? `Une correction automatique a été appliquée (confiance ${(analysis.confidence * 100).toFixed(0)}%). À confirmer dans Signalements.`
          : `Nouveau signalement analysé : ${analysis.problem_description.slice(0, 120)}`,
        link: "/#/formateur/signalements",
      });
    }

    return new Response(
      JSON.stringify({ ok: true, auto_applied, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("analyze-report error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
