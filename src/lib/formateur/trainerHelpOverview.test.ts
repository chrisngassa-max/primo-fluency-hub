import { describe, expect, it } from "vitest";
import {
  HINT_TRACE_SCHEMA,
  PRESENTED_HINT_KIND,
  type HelpLiveEvent,
} from "../../../supabase/functions/_shared/assistant-pedagogique/help-trace";
import {
  buildAttemptOverview,
  exerciseAllowsUnloggedClientHint,
  groupAttemptsByLearnerAndSkill,
  presentDevoirStatus,
} from "./trainerHelpOverview";

const LEARNER = "10000000-0000-4000-8000-000000000001";
const ATTEMPT = "40000000-0000-4000-8000-000000000001";
const SESSION = "20000000-0000-4000-8000-000000000001";
const EXERCISE = "62b06150-7942-4c41-bab9-fdba0a4d852c";

const helpEvent = (overrides: Partial<HelpLiveEvent["payload"]> = {}): HelpLiveEvent => ({
  event_type: "aide_demandee",
  session_id: SESSION,
  eleve_id: LEARNER,
  payload: {
    kind: PRESENTED_HINT_KIND,
    exercice_id: EXERCISE,
    item_id: "item_01",
    tentative_id: ATTEMPT,
    devoir_id: null,
    sous_competence: "reperer_info_explicite",
    mode: "entrainement",
    niveau: "A1",
    aide_type: "indice",
    origine: "banque",
    contenu_version: "sha256:" + "a".repeat(64),
    niveau_aide: 2,
    presented_at: "2026-10-06T12:00:00.000Z",
    ...overrides,
  },
});

describe("Lot 5 — vue formateur aide / autonomie", () => {
  it("devoir expiré n’est pas présenté comme actif", () => {
    expect(presentDevoirStatus("en_attente")).toEqual({
      key: "actif",
      label: "Actif",
      isActive: true,
    });
    expect(presentDevoirStatus("fait").isActive).toBe(false);
    expect(presentDevoirStatus("expire")).toEqual({
      key: "expire",
      label: "Expiré",
      isActive: false,
    });
  });

  it("tentative complète sans aide → autonome", () => {
    const row = buildAttemptOverview({
      attemptId: ATTEMPT,
      learnerId: LEARNER,
      sousCompetence: "reperer_info_explicite",
      itemResults: {
        0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
      },
      helpEvents: [],
      unloggedClientHintPossible: false,
    });
    expect(row.autonomy).toBe("autonome");
  });

  it("tentative aidée → aidée, avec niveau d’indice", () => {
    const event = helpEvent({ niveau_aide: 2 });
    const row = buildAttemptOverview({
      attemptId: ATTEMPT,
      learnerId: LEARNER,
      sousCompetence: "reperer_info_explicite",
      itemResults: {
        0: { hint_used: true, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: true } },
      },
      helpEvents: [event],
      unloggedClientHintPossible: false,
    });
    expect(row.autonomy).toBe("aidee");
    expect(row.hints).toEqual([
      { niveau_aide: 2, origine: "banque", item_id: "item_01" },
    ]);
  });

  it("trace historique / partielle → non mesurable", () => {
    const row = buildAttemptOverview({
      attemptId: ATTEMPT,
      learnerId: LEARNER,
      sousCompetence: "reperer_info_explicite",
      itemResults: { 0: { hint_used: false } },
      helpEvents: [],
      unloggedClientHintPossible: false,
    });
    expect(row.autonomy).toBe("non_mesurable");
  });

  it("indice client non journalisé possible → jamais autonome", () => {
    expect(exerciseAllowsUnloggedClientHint({
      items: [{ id: "item_01", indice: "Écoute le début." }],
    })).toBe(true);
    const row = buildAttemptOverview({
      attemptId: ATTEMPT,
      learnerId: LEARNER,
      sousCompetence: "reperer_info_explicite",
      itemResults: {
        0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
      },
      helpEvents: [],
      unloggedClientHintPossible: true,
    });
    expect(row.autonomy).toBe("non_mesurable");
  });

  it("regroupe mesurables / aidées / non mesurables par élève et sous-compétence", () => {
    const rows = [
      buildAttemptOverview({
        attemptId: "a1",
        learnerId: LEARNER,
        sousCompetence: "reperer_info_explicite",
        itemResults: {
          0: { hint_used: false, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: false } },
        },
        helpEvents: [],
        unloggedClientHintPossible: false,
      }),
      buildAttemptOverview({
        attemptId: "a2",
        learnerId: LEARNER,
        sousCompetence: "reperer_info_explicite",
        itemResults: {
          0: { hint_used: true, hint_trace: { schema: HINT_TRACE_SCHEMA, logged: true, presented: true } },
        },
        helpEvents: [helpEvent({ tentative_id: "a2" })],
        unloggedClientHintPossible: false,
      }),
      buildAttemptOverview({
        attemptId: "a3",
        learnerId: LEARNER,
        sousCompetence: "reperer_info_explicite",
        itemResults: { 0: { hint_used: false } },
        helpEvents: [],
        unloggedClientHintPossible: false,
      }),
    ];
    const grouped = groupAttemptsByLearnerAndSkill(rows);
    const bucket = grouped.get(`${LEARNER}::reperer_info_explicite`)!;
    expect(bucket.mesurables_autonomes).toHaveLength(1);
    expect(bucket.aidees).toHaveLength(1);
    expect(bucket.non_mesurables).toHaveLength(1);
  });
});
