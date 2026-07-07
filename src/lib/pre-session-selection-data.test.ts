import { describe, expect, it } from "vitest";
import {
  mapBankRowToPreSessionCandidate,
  normalizeValidationIssues,
  PRE_SESSION_BANK_VALIDATION_STATUSES,
} from "./pre-session-selection-data";

describe("normalizeValidationIssues", () => {
  it("retourne un tableau vide pour entrées invalides", () => {
    expect(normalizeValidationIssues(null)).toEqual([]);
    expect(normalizeValidationIssues("x")).toEqual([]);
  });

  it("mappe code, severity et layer", () => {
    expect(
      normalizeValidationIssues([
        { code: "consigne_too_long", severity: "warning", layer: "L6_pedagogie" },
        { code: "qcm_no_options", severity: "error" },
        { foo: "bar" },
      ]),
    ).toEqual([
      { code: "consigne_too_long", severity: "warning", layer: "L6_pedagogie" },
      { code: "qcm_no_options", severity: "error", layer: undefined },
    ]);
  });
});

describe("mapBankRowToPreSessionCandidate", () => {
  it("mappe les champs scoring et validation", () => {
    const candidate = mapBankRowToPreSessionCandidate(
      {
        id: "ex-1",
        titre: "Test CE",
        consigne: "Lisez.",
        competence: "CE",
        niveau_vise: "A1",
        format: "qcm",
        contenu: { items: [{ question: "Q?", bonne_reponse: "a" }] },
        theme: "logement",
        contexte_irn: "vie_quotidienne",
        validation_status: "validated_auto",
        validation_issues: [{ code: "correction_not_in_text", severity: "warning" }],
        validation_score: 88,
      },
      { fresh: false, recent_occurrences: 2 },
    );

    expect(candidate.id).toBe("ex-1");
    expect(candidate.validation_status).toBe("validated_auto");
    expect(candidate.validation_issues).toHaveLength(1);
    expect(candidate.validation_score).toBe(88);
    expect(candidate.fresh).toBe(false);
    expect(candidate.recent_occurrences).toBe(2);
    expect(candidate.theme).toBe("logement");
  });
});

describe("PRE_SESSION_BANK_VALIDATION_STATUSES", () => {
  it("exclut draft et inclut rejected pour le rapport d'exclusions", () => {
    expect(PRE_SESSION_BANK_VALIDATION_STATUSES).toContain("validated_auto");
    expect(PRE_SESSION_BANK_VALIDATION_STATUSES).toContain("rejected");
    expect(PRE_SESSION_BANK_VALIDATION_STATUSES).not.toContain("draft");
  });
});
