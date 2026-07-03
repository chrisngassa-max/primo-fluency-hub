import { describe, expect, it } from "vitest";
import { buildLiveEventsToInsert } from "./classifyAndEmitEventsBuilder";
import { TAXONOMIE_COURTE } from "./taxonomieCourte";

describe("buildLiveEventsToInsert", () => {
  it("sets competence column on every session_live_events row", () => {
    const events = buildLiveEventsToInsert({
      sessionId: "sess-1",
      eleveId: "eleve-1",
      exerciceId: "ex-1",
      competence: "EE",
      score: 60,
      incorrect: [
        { idx: 0, question: "Q1", reponse: "mauvaise", bonne: "bonne" },
      ],
      classifications: new Map([[0, "GRAM_TEMPS"]]),
      correctCount: 1,
    });

    expect(events).toHaveLength(2);
    for (const ev of events) {
      expect(ev.competence).toBe("EE");
    }
    expect(events[0].event_type).toBe("reponse_incorrecte");
    expect(events[0].type_erreur_id).toBe("GRAM_TEMPS");
    expect(events[1].event_type).toBe("reponse_correcte");
  });
});

describe("TAXONOMIE_COURTE", () => {
  it("lists 16 error types for Sprint 3", () => {
    const types = [
      "LEX_CONFUSION", "CONSIGNE_NC", "GRAM_ACCORD", "GRAM_TEMPS", "HORS_SUJET",
      "INTERPRETATION", "JUSTIFICATION", "PHONO", "PRODUCTION_COURTE", "REGISTRE",
      "COHERENCE_ADMIN", "CO_DISCRIMINATION", "METHODO_REPERAGE", "STRUCT_CONJ",
      "STRUCT_MORPHO", "STRUCT_CONNECTEURS",
    ];
    for (const t of types) {
      expect(TAXONOMIE_COURTE).toContain(t);
    }
  });
});
