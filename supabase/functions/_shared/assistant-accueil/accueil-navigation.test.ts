import { describe, expect, it, vi } from "vitest";
import {
  CONTRACT_VERSION,
  MODE_TOOL_MATRIX,
  RETENTION_POLICY,
} from "./contract-v1";
import {
  assembleSnapshotFromRlsRows,
  buildGeminiPayload,
  orchestrateAccueil,
  type RlsRows,
  type ServerSnapshot,
} from "./orchestrate";

const AUTH = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DEVOIR = "33333333-3333-4333-8333-333333333333";
const CORRECTION = "CORRECTION_SENTINELLE_EVAL";
const ANSWER_KEY = "CLE_REPONSE_SENTINELLE";
const HINT_SECRET = "INDICE_SECRET_NIVEAU_2_MERCREDI";
const TRANSCRIPT = "TRANSCRIPTION_REVELATRICE_AUDIO";
const EMAIL = "eleve.fictif@example.test";
const NOM = "NomFictifSentinelle";
const PRENOM = "PrenomFictifSentinelle";

function snapshot(overrides: Partial<ServerSnapshot> = {}): ServerSnapshot {
  return {
    ownerUserId: AUTH,
    email: EMAIL,
    nom: NOM,
    prenom: PRENOM,
    mode: "entrainement",
    modeProven: true,
    niveau: "A2",
    currentDevoirId: DEVOIR,
    devoirSubmitted: false,
    devoirReplayAllowed: false,
    evaluationRoute: null,
    exerciceReplayAllowed: true,
    sessionCodes: ["S01"],
    validatedHints: [
      "Relis le verbe de la consigne.",
      HINT_SECRET,
      "Compare les deux idées du texte, sans choisir à ma place.",
    ],
    correction: CORRECTION,
    answerKey: ANSWER_KEY,
    transcript: TRANSCRIPT,
    devoirs: [
      { id: DEVOIR, titre: "Devoir logement", statut: "en_attente", eleveId: AUTH },
    ],
    prochaineSeance: { code: "S02", titre: "Santé", date: "2026-09-28" },
    activiteCourante: { titre: "Dialogue accueil", route: "/eleve/seances/S01" },
    qcm: {
      options: ["le train de mardi", "le bus de mercredi", "la voiture rouge", "le metro du soir"],
      correctIndex: 1,
    },
    ...overrides,
  };
}

function orchestrate(
  overrides: Partial<Parameters<typeof orchestrateAccueil>[0]> = {},
) {
  const invokeModel = vi.fn(() => {
    throw new Error("model_must_not_be_called");
  });
  return {
    invokeModel,
    result: orchestrateAccueil({
      authUserId: AUTH,
      snapshot: snapshot(),
      question: "Que dois-je faire aujourd'hui ?",
      realAiAllowed: false,
      invokeModel,
      ...overrides,
    }),
  };
}

describe("contrat accueil-navigation-v1", () => {
  it("fixe la matrice mode × outil", () => {
    expect(CONTRACT_VERSION).toBe("accueil-navigation-v1");
    expect(MODE_TOOL_MATRIX.entrainement.deliver_validated_hint).toEqual({
      allowed: true,
      maxLevel: 3,
    });
    expect(MODE_TOOL_MATRIX.entrainement.open_route.scope).toBe("whitelist_entrainement");
    expect(MODE_TOOL_MATRIX.entrainement.replay_audio_segment.rule).toBe("exercice");
    expect(MODE_TOOL_MATRIX.entrainement.recommend_next_activity.allowed).toBe(true);
    expect(MODE_TOOL_MATRIX.entrainement.flag_help_needed.kind).toBe("pedagogique");

    expect(MODE_TOOL_MATRIX.devoir.open_route.scope).toBe("devoir_courant");
    expect(MODE_TOOL_MATRIX.devoir.deliver_validated_hint.maxLevel).toBe(1);
    expect(MODE_TOOL_MATRIX.devoir.replay_audio_segment.rule).toBe("contrat_devoir");
    expect(MODE_TOOL_MATRIX.devoir.recommend_next_activity.rule).toBe("apres_remise");
    expect(MODE_TOOL_MATRIX.devoir.flag_help_needed.kind).toBe("pedagogique");

    expect(MODE_TOOL_MATRIX.evaluation.open_route.scope).toBe("ecrans_evaluation");
    expect(MODE_TOOL_MATRIX.evaluation.deliver_validated_hint.allowed).toBe(false);
    expect(MODE_TOOL_MATRIX.evaluation.replay_audio_segment.allowed).toBe(false);
    expect(MODE_TOOL_MATRIX.evaluation.recommend_next_activity.allowed).toBe(false);
    expect(MODE_TOOL_MATRIX.evaluation.flag_help_needed.kind).toBe("technique");

    expect(RETENTION_POLICY.conversation_ordinaire.storeText).toBe(false);
    expect(RETENTION_POLICY.flag_help_needed).toMatchObject({ days: 30 });
    expect(RETENTION_POLICY.error).toMatchObject({ days: 7 });
    expect(RETENTION_POLICY.metrics.storeText).toBe(false);
  });
});

describe("payload Gemini et filtre de mode", () => {
  it("retire correction, clé, transcription et indices en évaluation", () => {
    const payload = buildGeminiPayload(AUTH, snapshot({
      mode: "evaluation",
      evaluationRoute: "/eleve/test-positionnement/passer/jeton-eval-1",
    }));
    expect(payload).not.toBeNull();
    const json = JSON.stringify(payload);
    expect(json).not.toContain(CORRECTION);
    expect(json).not.toContain(ANSWER_KEY);
    expect(json).not.toContain(TRANSCRIPT);
    expect(json).not.toContain(HINT_SECRET);
    expect(json).not.toContain("Relis le verbe");
    expect(payload!.hints).toEqual([]);
  });

  it("refuse le replay audio en évaluation sans appeler le modèle", () => {
    const { result, invokeModel } = orchestrate({
      snapshot: snapshot({
        mode: "evaluation",
        exerciceReplayAllowed: true,
        evaluationRoute: "/eleve/test-positionnement/passer/jeton-eval-1",
      }),
      requestedTool: { name: "replay_audio_segment", args: { segment: 1 } },
    });
    expect(result.tool?.allowed).toBe(false);
    expect(result.aiCalled).toBe(false);
    expect(invokeModel).not.toHaveBeenCalled();
    expect(JSON.stringify(result.geminiPayload)).not.toContain(TRANSCRIPT);
  });

  it("limite le devoir à l'indice 1 de la banque", () => {
    const refused = orchestrate({
      snapshot: snapshot({ mode: "devoir" }),
      question: "donne un indice",
      requestedTool: { name: "deliver_validated_hint", args: { level: 2 } },
    });
    expect(refused.result.tool?.allowed).toBe(false);
    expect(refused.invokeModel).not.toHaveBeenCalled();

    const allowed = orchestrate({
      snapshot: snapshot({ mode: "devoir" }),
      question: "donne un indice",
      requestedTool: { name: "deliver_validated_hint", args: { level: 1 } },
    });
    expect(allowed.result.tool?.allowed).toBe(true);
    expect(allowed.result.publicResponse.text).toContain("Relis le verbe");
    expect(allowed.result.publicResponse.text).not.toContain(HINT_SECRET);
    expect(allowed.invokeModel).not.toHaveBeenCalled();
  });

  it("n'envoie ni auth.uid, ni nom, ni email au payload Gemini", () => {
    const payload = buildGeminiPayload(
      AUTH,
      snapshot(),
      `Bonjour ${PRENOM} ${NOM} ${EMAIL} ${AUTH}`,
    );
    const json = JSON.stringify(payload);
    expect(json).not.toContain(AUTH);
    expect(json).not.toContain(EMAIL);
    expect(json).not.toContain(NOM);
    expect(json).not.toContain(PRENOM);
    expect(json).not.toMatch(/"email"|"nom"|"prenom"|"user_id"|"auth"/);
  });

  it("refuse une route hors liste blanche", () => {
    const foreign = orchestrate({
      requestedTool: {
        name: "open_route",
        args: { route: "/formateur/eleves/22222222-2222-4222-8222-222222222222" },
      },
    });
    expect(foreign.result.tool?.allowed).toBe(false);

    const otherDevoir = orchestrate({
      snapshot: snapshot({ mode: "devoir" }),
      requestedTool: {
        name: "open_route",
        args: { route: `/eleve/devoirs/${OTHER}` },
      },
    });
    expect(otherDevoir.result.tool?.allowed).toBe(false);

    const query = orchestrate({
      requestedTool: {
        name: "open_route",
        args: { route: "/eleve/devoirs?email=eleve.fictif@example.test" },
      },
    });
    expect(query.result.tool?.allowed).toBe(false);
  });

  it("journalise un fallback FAQ visible sans stocker le texte", () => {
    const question = "Explique-moi la grammaire du subjonctif en détail";
    const { result, invokeModel } = orchestrate({ question });
    expect(result.publicResponse.visibleFallback).toBe(true);
    expect(result.publicResponse.provider).toBe("faq_fallback");
    expect(result.journal.provider).toBe("faq_fallback");
    expect(result.journal.store_text).toBe(false);
    expect(JSON.stringify(result.journal)).not.toContain(question);
    expect(result.aiCalled).toBe(false);
    expect(invokeModel).not.toHaveBeenCalled();
  });

  it("rend les données d'un autre élève impossibles", () => {
    const mismatch = assembleSnapshotFromRlsRows(AUTH, {
      devoirs: [
        { id: DEVOIR, eleve_id: OTHER, statut: "en_attente", titre: "Devoir d'un autre" },
      ],
      sessions: [],
      evaluations: [],
    } satisfies RlsRows);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.reason).toBe("other_student");

    const { result, invokeModel } = orchestrate({
      snapshot: snapshot({
        ownerUserId: OTHER,
        devoirs: [
          { id: DEVOIR, titre: "Devoir d'un autre", statut: "en_attente", eleveId: OTHER },
        ],
      }),
    });
    expect(result.refused).toBe(true);
    expect(result.reason).toBe("other_student");
    expect(result.geminiPayload).toBeNull();
    expect(invokeModel).not.toHaveBeenCalled();
    expect(JSON.stringify(result.publicResponse)).not.toContain("Devoir d'un autre");
  });
});

describe("accueil navigation", () => {
  it("répond aux quatre demandes d'accueil sans modèle", () => {
    const today = orchestrate({ question: "Que dois-je faire aujourd'hui ?" });
    expect(today.result.publicResponse.provider).toBe("server_context");
    expect(today.result.publicResponse.text.toLowerCase()).toContain("devoir logement");
    expect(today.result.tool?.name).toBe("open_route");
    expect(today.result.tool?.allowed).toBe(true);
    expect(today.invokeModel).not.toHaveBeenCalled();

    const devoirs = orchestrate({ question: "Où sont mes devoirs ?" });
    expect(devoirs.result.tool?.route).toBe("/eleve/devoirs");

    const seance = orchestrate({ question: "Quelle est ma prochaine séance ?" });
    expect(seance.result.publicResponse.text).toContain("Santé");
    expect(seance.result.tool?.route).toBe("/eleve/ma-seance");

    const open = orchestrate({ question: "Ouvre cette activité" });
    expect(open.result.tool?.route).toBe("/eleve/seances/S01");
    expect(open.result.tool?.allowed).toBe(true);
  });

  it("ne livre pas un indice de QCM qui révèle la réponse", () => {
    const unsafe = orchestrate({
      snapshot: snapshot({
        validatedHints: ["Le mot mercredi est dans la bonne réponse."],
      }),
      requestedTool: { name: "deliver_validated_hint", args: { level: 1 } },
    });
    expect(unsafe.result.tool?.allowed).toBe(false);
    expect(unsafe.result.publicResponse.text.toLowerCase()).not.toContain("mercredi");
  });
});
