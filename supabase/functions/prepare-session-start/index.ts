import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { calibrateRetrospective, determineBlocksToLaunch, BlockType } from "./logic.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifie" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authData } = await userClient.auth.getUser();
    const user = authData.user;
    if (!user) return json({ error: "Session invalide" }, 401);

    const { session_id: sessionId, block_type: requestedBlock } = await req.json();
    if (!sessionId) return json({ error: "session_id requis" }, 400);

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("*, group:groups(id, formateur_id, type_demarche)")
      .eq("id", sessionId)
      .single();
    if (sessionError || !session) return json({ error: "Seance introuvable" }, 404);
    if (session.group?.formateur_id !== user.id) return json({ error: "Acces refuse" }, 403);

    const { blocks, automatic } = determineBlocksToLaunch(
      session.generation_automatique_activee,
      requestedBlock
    );

    if (blocks.length === 0) {
      return json({ launched: [], automatic: false });
    }

    const launched: BlockType[] = [];

    for (const block of blocks) {
      const { data: claimed, error } = await admin.rpc("claim_session_block", {
        p_session_id: sessionId,
        p_block_type: block,
      });
      if (error) throw error;
      if (!claimed) continue;
      launched.push(block);
      EdgeRuntime.waitUntil(runBlock(admin, supabaseUrl, serviceKey, session, block));
    }

    return json({ launched, automatic }, 202);
  } catch (error) {
    console.error("prepare-session-start", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});

async function runBlock(admin: any, supabaseUrl: string, serviceKey: string, session: any, block: BlockType) {
  try {
    let warningMessage: string | null = null;
    if (block === "diagnostic") {
      const { data: existing } = await admin
        .from("bilan_tests").select("id").eq("session_id", session.id).in("statut", ["pret", "envoye"]).limit(1);
      if (!existing?.length) {
        await invokeFunction(supabaseUrl, serviceKey, "generate-diagnostic-test", {
          sessionId: session.id,
          groupId: session.group_id,
          competences: session.competences_autorisees?.length
            ? session.competences_autorisees
            : session.competences_cibles ?? ["CO", "CE"],
          niveau: session.niveau_cible,
          nbQuestions: session.nb_questions_diagnostic,
          statut: "envoye",
        });
      }
    } else if (block === "retrospective") {
      warningMessage = await prepareRetrospective(admin, supabaseUrl, serviceKey, session);
    } else {
      await generateAndAttach(admin, supabaseUrl, serviceKey, session, {
        block: "core",
        count: session.nb_exercices_souhaite,
        pointName: session.objectifs || session.titre,
      });
    }
    await admin.from("session_blocks").update({
      status: "ready",
      error_message: null,
      warning_message: warningMessage,
      updated_at: new Date().toISOString(),
    }).eq("session_id", session.id).eq("block_type", block);
  } catch (error) {
    console.error(`prepare-session-start:${block}`, error);
    await admin.from("session_blocks").update({
      status: "failed",
      error_message: error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue",
      updated_at: new Date().toISOString(),
    }).eq("session_id", session.id).eq("block_type", block);
  }
}

async function prepareRetrospective(admin: any, supabaseUrl: string, serviceKey: string, session: any) {
  const { data: previous } = await admin.from("sessions").select("id, titre, objectifs")
    .eq("group_id", session.group_id).lt("date_seance", session.date_seance)
    .order("date_seance", { ascending: false }).limit(1).maybeSingle();
  if (!previous) return null;

  const { data: reported } = await admin.from("session_exercices")
    .select("exercice_id, ordre").eq("session_id", previous.id).eq("statut", "reporte");
  for (const item of reported ?? []) {
    const { error } = await admin.from("session_exercices").insert({
      session_id: session.id, exercice_id: item.exercice_id, ordre: item.ordre,
      statut: "planifie", bloc: "retrospective",
    });
    if (error && error.code !== "23505") throw error;
  }

  const calibration = calibrateRetrospective(
    session.nb_exercices_retrospective,
    session.duree_retrospective
  );
  const { data: previousLinks } = await admin.from("session_exercices")
    .select("exercice_id, exercice:exercices(competence)")
    .eq("session_id", previous.id);
  const previousExerciseIds = (previousLinks ?? []).map((link: any) => link.exercice_id);
  const { data: results } = previousExerciseIds.length
    ? await admin.from("resultats").select("exercice_id, score").in("exercice_id", previousExerciseIds)
    : { data: [] };
  const scoresByCompetence = new Map<string, number[]>();
  for (const link of previousLinks ?? []) {
    const competence = (link as any).exercice?.competence;
    if (!competence) continue;
    const scores = (results ?? []).filter((result: any) => result.exercice_id === link.exercice_id)
      .map((result: any) => Number(result.score));
    if (scores.length) scoresByCompetence.set(competence, [...(scoresByCompetence.get(competence) ?? []), ...scores]);
  }
  const weakCompetences = [...scoresByCompetence.entries()]
    .filter(([, scores]) => scores.reduce((sum, score) => sum + score, 0) / scores.length < 80)
    .map(([competence]) => competence);
  await generateAndAttach(admin, supabaseUrl, serviceKey, session, {
    block: "retrospective",
    count: calibration.count,
    pointName: `Revision de ${previous.titre}. ${previous.objectifs ?? ""}. Points faibles: ${weakCompetences.join(", ") || "consolidation generale"}`.trim(),
    competences: weakCompetences.length ? weakCompetences : undefined,
    targetDurationMinutes: Math.max(1, Math.floor(calibration.durationMinutes / calibration.count)),
  });
  return calibration.warning;
}

async function generateAndAttach(
  admin: any,
  supabaseUrl: string,
  serviceKey: string,
  session: any,
  options: {
    block: "retrospective" | "core";
    count: number;
    pointName: string;
    competences?: string[];
    targetDurationMinutes?: number;
  },
) {
  const configuredCompetences: string[] = session.competences_autorisees?.length
    ? session.competences_autorisees
    : session.competences_cibles?.length ? session.competences_cibles : ["CO", "CE"];
  const competences = options.competences?.filter((item) => configuredCompetences.includes(item)).length
    ? options.competences!.filter((item) => configuredCompetences.includes(item))
    : configuredCompetences;
  const { data: point } = await admin.from("points_a_maitriser").select("id").limit(1).single();
  if (!point?.id) throw new Error("Aucun point a maitriser disponible");

  const generated: any[] = [];
  for (let index = 0; index < options.count; index++) {
    const competence = competences[index % competences.length];
    let generatedExercise: any = null;
    for (let attempt = 0; attempt < 2 && !generatedExercise; attempt++) {
      const result = await invokeFunction(supabaseUrl, serviceKey, "generate-exercises", {
        pointName: options.pointName,
        competence,
        niveauVise: session.niveau_cible,
        count: 1,
        difficultyLevel: session.difficulte_par_defaut,
        targetDurationMinutes: options.targetDurationMinutes,
        groupId: session.group_id,
        type_demarche: session.group?.type_demarche,
      });
      generatedExercise = result.exercises?.[0] ?? null;
    }
    if (!generatedExercise) {
      throw new Error(`Impossible de generer l'exercice ${index + 1} sur ${options.count} apres deux tentatives`);
    }
    generated.push(generatedExercise);
  }

  if (!generated.length) throw new Error("Aucun exercice genere");
  const { data: inserted, error } = await admin.from("exercices").insert(generated.map((ex: any) => ({
    formateur_id: session.group.formateur_id,
    point_a_maitriser_id: point.id,
    competence: ex.competence,
    metadata_code: ex.metadata?.code ?? null,
    metadata_skill: ex.metadata?.skill ?? null,
    sous_competence: ex.sous_competence ?? ex.metadata?.sub_skill ?? null,
    duree_limite_secondes: ex.metadata?.time_limit_seconds ?? ex.contenu?.time_limit_seconds ?? null,
    aides_disponibles: ex.metadata?.aides_disponibles ?? ex.contenu?.aides_disponibles ?? [],
    nombre_ecoutes_max: ex.metadata?.nombre_ecoutes_max ?? ex.contenu?.nombre_ecoutes_max ?? null,
    transcription_verrouillee:
      ex.metadata?.transcription_verrouillee ?? ex.contenu?.transcription_verrouillee ?? false,
    objectif_tcf: ex.metadata?.objectif_tcf ?? ex.contenu?.objectif_tcf ?? null,
    type_differenciation:
      ex.metadata?.type_differenciation ?? (options.block === "retrospective" ? "consolidation" : "demarrage"),
    niveau_vise: ex.niveau_vise ?? session.niveau_cible,
    format: ex.format ?? "qcm",
    difficulte: ex.difficulte ?? session.difficulte_par_defaut,
    titre: ex.titre,
    consigne: ex.consigne,
    contenu: ex.contenu ?? {},
    animation_guide: ex.animation_guide ?? null,
    variante_niveau_bas: ex.variante_niveau_bas ?? null,
    variante_niveau_haut: ex.variante_niveau_haut ?? null,
    is_ai_generated: true,
  }))).select("id");
  if (error) throw error;

  const { data: lastLinks } = await admin.from("session_exercices").select("ordre")
    .eq("session_id", session.id).order("ordre", { ascending: false }).limit(1);
  const startOrder = Number(lastLinks?.[0]?.ordre ?? 0) + 1;
  const { error: linkError } = await admin.from("session_exercices").insert(
    inserted.map((ex: any, index: number) => ({
      session_id: session.id, exercice_id: ex.id, ordre: startOrder + index,
      statut: "planifie", bloc: options.block,
    })),
  );
  if (linkError) throw linkError;
}

async function invokeFunction(url: string, serviceKey: string, name: string, body: unknown) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error ?? `${name} a echoue`);
  return data;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
