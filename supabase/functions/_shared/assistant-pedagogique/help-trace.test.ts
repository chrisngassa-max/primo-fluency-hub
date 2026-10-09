import { describe, expect, it } from "vitest";
import {
  classifyAttemptAutonomy,
  filterHelpEventsForLearner,
  HINT_TRACE_SCHEMA,
  isDuplicatePresentedHint,
  PRESENTED_HINT_KIND,
  recordPresentedHint,
  resolveTrustedHintTrace,
} from "./help-trace.ts";

const LEARNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000099";
const EXERCISE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0101";
const ATTEMPT = "40000000-0000-4000-8000-000000000001";
const SESSION = "20000000-0000-4000-8000-000000000001";

const baseInput = {
  authUserId: LEARNER,
  eleveId: LEARNER,
  exerciseId: EXERCISE,
  attemptId: ATTEMPT,
  itemId: "item_01",
  sessionId: SESSION,
  sousCompetence: "reperer_info_explicite",
  mode: "entrainement" as const,
  niveau: "A1",
  niveauAide: 1,
  origine: "banque" as const,
  contenuVersion: "sha256:" + "a".repeat(64),
  presentedAt: "2026-10-06T12:00:00.000Z",
};

describe("Lot 3 — traçabilité des aides et verrou évaluation", () => {
  it("une aide présentée est liée à la tentative, avec niveau et origine", () => {
    const recorded = recordPresentedHint(baseInput);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.event.event_type).toBe("aide_demandee");
    expect(recorded.event.eleve_id).toBe(LEARNER);
    expect(recorded.event.session_id).toBe(SESSION);
    expect(recorded.event.payload.kind).toBe(PRESENTED_HINT_KIND);
    expect(recorded.event.payload.exercice_id).toBe(EXERCISE);
    expect(recorded.event.payload.tentative_id).toBe(ATTEMPT);
    expect(recorded.event.payload.devoir_id).toBeNull();
    expect(recorded.event.payload.sous_competence).toBe("reperer_info_explicite");
    expect(recorded.event.payload.niveau_aide).toBe(1);
    expect(recorded.event.payload.origine).toBe("banque");
    expect(recorded.event.payload.mode).toBe("entrainement");
    expect(recorded.event.payload.contenu_version).toBe(baseInput.contenuVersion);
    expect(recorded.event.payload.presented_at).toBe(baseInput.presentedAt);
  });

  it("lie l’indice présenté au devoir attribué quand devoirId est fourni", () => {
    const devoirId = "30000000-0000-4000-8000-000000000001";
    const recorded = recordPresentedHint({ ...baseInput, devoirId });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.storage).toBe("session_live_events");
    expect(recorded.event.payload.devoir_id).toBe(devoirId);
    expect(recorded.event.payload.exercice_id).toBe(EXERCISE);
    expect(recorded.event.eleve_id).toBe(LEARNER);
  });

  it("devoir sans session : ancre presented_help_events, jamais session_requise", () => {
    const devoirId = "30000000-0000-4000-8000-000000000001";
    const recorded = recordPresentedHint({ ...baseInput, sessionId: null, devoirId });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.storage).toBe("presented_help_events");
    expect(recorded.event.session_id).toBeNull();
    expect(recorded.row?.devoir_id).toBe(devoirId);
    expect(recorded.row?.session_id).toBeNull();
  });

  it("sans séance ni devoir : refus trace_anchor_requise", () => {
    const recorded = recordPresentedHint({ ...baseInput, sessionId: null, devoirId: null });
    expect(recorded.ok).toBe(false);
    if (recorded.ok) return;
    expect(recorded.reason).toBe("trace_anchor_requise");
  });

  it("ne crée pas d’événement niveau 0", () => {
    const recorded = recordPresentedHint({ ...baseInput, niveauAide: 0 });
    expect(recorded.ok).toBe(false);
    if (recorded.ok) return;
    expect(recorded.reason).toBe("niveau_invalide");
  });

  it("tentative sans aide : autonome seulement si le suivi est actif et complet", () => {
    const verdict = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: {
        0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
        1: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
      },
      helpEvents: [],
    });
    expect(verdict.status).toBe("autonome");
  });

  it("tentative ancienne ou mal tracée : non mesurable, jamais autonome", () => {
    const legacy = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: {
        0: { hint_used: false, correct: true, answer_correct: true },
      },
      helpEvents: [],
    });
    expect(legacy.status).toBe("non_mesurable");
    expect(legacy.status).not.toBe("autonome");
    const partial = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: {
        0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
        1: { hint_used: false },
      },
      helpEvents: [],
    });
    expect(partial.status).toBe("non_mesurable");
  });

  it("le résultat de tentative n’est pas dupliqué dans l’événement d’aide", () => {
    const recorded = recordPresentedHint(baseInput);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const payload = JSON.stringify(recorded.event.payload);
    expect(payload).not.toMatch(/answer_correct|score_normalized|bonne_reponse|reponse_donnee|item_results/);
    expect(recorded.event.payload).not.toHaveProperty("score");
    expect(recorded.event.payload).not.toHaveProperty("correct");
  });

  it("en évaluation : aucun indice, aucun événement présenté, aucun modèle", () => {
    const recorded = recordPresentedHint({ ...baseInput, mode: "evaluation", niveauAide: 1 });
    expect(recorded.ok).toBe(false);
    if (recorded.ok) return;
    expect(recorded.reason).toBe("evaluation");
    expect(recorded.event).toBeUndefined();
  });

  it("accès : un autre élève ne lit ni n’écrit les événements", () => {
    const denied = recordPresentedHint({ ...baseInput, authUserId: OTHER });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.reason).toBe("acces_refuse");
    const recorded = recordPresentedHint(baseInput);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const visible = filterHelpEventsForLearner([recorded.event, {
      ...recorded.event,
      eleve_id: OTHER,
      payload: { ...recorded.event.payload, tentative_id: "secret-autre" },
    }], LEARNER);
    expect(visible).toHaveLength(1);
    expect(JSON.stringify(visible)).not.toContain("secret-autre");
    expect(JSON.stringify(visible)).not.toContain(OTHER);
  });

  it("aide présentée → tentative aidée, sans inventer une réussite autonome", () => {
    const recorded = recordPresentedHint(baseInput);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const verdict = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: {
        0: { hint_used: true, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: true } },
      },
      helpEvents: [recorded.event],
    });
    expect(verdict.status).toBe("aidee");
  });

  it("Lot 5 : indice client non journalisé possible → jamais autonome", () => {
    const withoutFlag = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: {
        0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
      },
      helpEvents: [],
    });
    expect(withoutFlag.status).toBe("autonome");

    const withClientPath = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: {
        0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
      },
      helpEvents: [],
      unloggedClientHintPossible: true,
    });
    expect(withClientPath.status).toBe("non_mesurable");
    expect(withClientPath.status).not.toBe("autonome");
  });

  it("Lot 5 : hint_used=false historique sans hint_trace → non_mesurable, pas autonome", () => {
    const verdict = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: { 0: { hint_used: false, correct: true } },
      helpEvents: [],
    });
    expect(verdict.status).toBe("non_mesurable");
  });
});

describe("Lot 4.1 — fiabilité de la trace hint_trace", () => {
  it("ignore une hint_trace client forgée (logged:true / presented:false)", () => {
    const recorded = recordPresentedHint(baseInput);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const trace = resolveTrustedHintTrace({
      learnerId: LEARNER,
      exerciseId: EXERCISE,
      itemId: "item_01",
      clientHintUsed: false,
      clientHintTrace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false, forged: true },
      presentedEvents: [recorded.event],
    });
    expect(trace.logged).toBe(true);
    expect(trace.presented).toBe(true);
    expect(trace.origin).toBe("banque");
    expect(trace).not.toHaveProperty("forged");
  });

  it("ne laisse pas le client déclarer à tort qu’aucune aide n’a été présentée", () => {
    const recorded = recordPresentedHint(baseInput);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const trace = resolveTrustedHintTrace({
      learnerId: LEARNER,
      exerciseId: EXERCISE,
      itemId: "item_01",
      clientHintUsed: false,
      clientHintTrace: undefined,
      presentedEvents: [recorded.event],
    });
    expect(trace.presented).toBe(true);
    const autonomy = classifyAttemptAutonomy({
      learnerId: LEARNER,
      attemptId: ATTEMPT,
      itemResults: { 0: { hint_used: false, hint_trace: trace } },
      helpEvents: [recorded.event],
    });
    expect(autonomy.status).toBe("aidee");
    expect(autonomy.status).not.toBe("autonome");
  });

  it("sans événement serveur, ne valide pas une autonomie sur une trace client seule", () => {
    const forgedLogged = resolveTrustedHintTrace({
      learnerId: LEARNER,
      exerciseId: EXERCISE,
      itemId: "item_01",
      clientHintUsed: false,
      clientHintTrace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false },
      presentedEvents: [],
    });
    // Trace serveur : presented faux, mais logged reste une construction serveur
    // (jamais une copie du payload client). Autonomie seulement via classify + events.
    expect(forgedLogged.presented).toBe(false);
    expect(JSON.stringify(forgedLogged)).not.toContain("forged");
  });

  it("une relance réseau (même présentation) est un doublon", () => {
    const first = recordPresentedHint(baseInput);
    const second = recordPresentedHint({
      ...baseInput,
      presentedAt: "2026-10-06T12:00:01.000Z",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(isDuplicatePresentedHint([first.event], second.event)).toBe(true);
  });

  it("une nouvelle présentation (autre niveau) n’est pas un doublon", () => {
    const first = recordPresentedHint(baseInput);
    const nextLevel = recordPresentedHint({ ...baseInput, niveauAide: 2 });
    expect(first.ok && nextLevel.ok).toBe(true);
    if (!first.ok || !nextLevel.ok) return;
    expect(isDuplicatePresentedHint([first.event], nextLevel.event)).toBe(false);
  });
});
