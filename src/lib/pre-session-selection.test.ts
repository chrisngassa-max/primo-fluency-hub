import { describe, expect, it } from "vitest";
import {
  classifyNrTier,
  NR_MAX_RATIO,
  preSessionSelectExercises,
  type PreSessionCandidate,
} from "./pre-session-selection.ts";

function baseCandidate(overrides: Partial<PreSessionCandidate> = {}): PreSessionCandidate {
  return {
    id: "ex-default",
    titre: "Exercice test",
    consigne: "Lisez et répondez.",
    competence: "CE",
    niveau_vise: "A1",
    format: "qcm",
    contenu: { items: [{ question: "Q?", bonne_reponse: "a" }] },
    validation_status: "validated_auto",
    validation_issues: [],
    search_score: 85,
    fresh: true,
    ...overrides,
  };
}

describe("classifyNrTier", () => {
  it("classifie vert pour warnings L6 seuls", () => {
    expect(
      classifyNrTier(
        [
          { code: "consigne_too_long", severity: "warning", layer: "L6_pedagogie" },
          { code: "feedback_too_long", severity: "warning", layer: "L7_correction" },
        ],
        null,
      ),
    ).toBe("vert");
  });

  it("classifie orange pour missing_audio_script avec ≤2 warnings", () => {
    expect(
      classifyNrTier([{ code: "missing_audio_script", severity: "warning" }], null),
    ).toBe("orange");
  });

  it("classifie rouge pour ambiguous_correction", () => {
    expect(
      classifyNrTier([{ code: "ambiguous_correction", severity: "warning" }], null),
    ).toBe("rouge");
  });
});

describe("preSessionSelectExercises", () => {
  it("A1 normal — assez de validated_auto, quota couvert sans NR", () => {
    const candidates: PreSessionCandidate[] = Array.from({ length: 6 }, (_, i) =>
      baseCandidate({
        id: `va-${i}`,
        titre: `VA ${i}`,
        validation_status: "validated_auto",
        search_score: 90 - i,
      }),
    );

    const report = preSessionSelectExercises(candidates, {
      niveauVise: "A1",
      competence: "CE",
      quota: 5,
    });

    expect(report.retained).toHaveLength(5);
    expect(report.retained.every((r) => r.selection_tier === "P1_validated")).toBe(true);
    expect(report.retained.every((r) => r.validation_status === "validated_auto")).toBe(true);
    expect(report.remaining_gaps[0].gap).toBe(0);
    expect(report.generation_need.required).toBe(false);
    expect(report.human_review_items.filter((h) => h.type === "NR_REPLI_USED")).toHaveLength(0);
  });

  it("A2 — needs_review plafonné à 30 % du quota", () => {
    const candidates: PreSessionCandidate[] = [
      ...Array.from({ length: 2 }, (_, i) =>
        baseCandidate({
          id: `va-${i}`,
          competence: "CO",
          niveau_vise: "A2",
          format: "qcm",
          validation_status: "validated_auto",
          search_score: 88,
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        baseCandidate({
          id: `nr-vert-${i}`,
          competence: "CO",
          niveau_vise: "A2",
          format: "qcm",
          validation_status: "needs_review",
          validation_issues: [{ code: "consigne_too_long", severity: "warning" }],
          search_score: 82,
        }),
      ),
    ];

    const quota = 5;
    const report = preSessionSelectExercises(candidates, {
      niveauVise: "A2",
      competence: "CO",
      quota,
    });

    const nrRetained = report.retained.filter((r) => r.source === "banque_needs_review");
    const maxNr = Math.floor(quota * NR_MAX_RATIO);

    expect(report.retained.length).toBeLessThanOrEqual(quota);
    expect(nrRetained.length).toBeLessThanOrEqual(maxNr);
    expect(nrRetained.length).toBe(1);
    expect(report.retained.filter((r) => r.selection_tier === "P1_validated")).toHaveLength(2);
    expect(report.remaining_gaps[0].gap).toBe(2);
    expect(report.generation_need.required).toBe(true);
    expect(report.human_review_items.some((h) => h.type === "NR_REPLI_USED")).toBe(true);
  });

  it("B1/B2 prefecture — pas de repli NR automatique", () => {
    const candidates: PreSessionCandidate[] = [
      baseCandidate({
        id: "nr-pref",
        competence: "CO",
        niveau_vise: "B1",
        format: "qcm",
        theme: "prefecture",
        validation_status: "needs_review",
        validation_issues: [{ code: "consigne_too_long", severity: "warning" }],
        search_score: 85,
      }),
      baseCandidate({
        id: "nr-pref-b2",
        competence: "CO",
        niveau_vise: "B2",
        format: "qcm",
        theme: "prefecture",
        validation_status: "needs_review",
        validation_issues: [{ code: "consigne_too_long", severity: "warning" }],
        search_score: 85,
      }),
    ];

    for (const niveau of ["B1", "B2"] as const) {
      const report = preSessionSelectExercises(
        candidates.filter((c) => c.niveau_vise === niveau),
        {
          niveauVise: niveau,
          competence: "CO",
          themeId: "prefecture",
          quota: 5,
        },
      );

      expect(report.retained).toHaveLength(0);
      expect(report.meta.nr_fallback_allowed).toBe(false);
      expect(report.retained.filter((r) => r.source === "banque_needs_review")).toHaveLength(0);
      expect(report.generation_need.required).toBe(true);
      expect(report.human_review_items.some((h) => h.type === "SENSITIVE_THEME_GAP")).toBe(true);
    }
  });

  it("B2 CE cellule P0 — 0 retenu, generation_need intégral", () => {
    const candidates: PreSessionCandidate[] = [
      baseCandidate({
        id: "rej-b2-ce",
        competence: "CE",
        niveau_vise: "B2",
        validation_status: "rejected",
        validation_issues: [{ code: "qcm_no_options", severity: "error" }],
      }),
    ];

    const report = preSessionSelectExercises(candidates, {
      niveauVise: "B2",
      competence: "CE",
      quota: 5,
    });

    expect(report.retained).toHaveLength(0);
    expect(report.generation_need.required).toBe(true);
    expect(report.generation_need.defer_to_lot8_p0).toBe(true);
    expect(report.generation_need.estimated_generation_count).toBe(5);
    expect(report.remaining_gaps[0].severity).toBe("critical");
    expect(report.human_review_items.some((h) => h.type === "P0_BLOCKING")).toBe(true);
  });

  it("rejected toujours exclus de retained", () => {
    const candidates: PreSessionCandidate[] = [
      baseCandidate({ id: "rej-1", validation_status: "rejected" }),
      baseCandidate({ id: "rej-2", validation_status: "rejected", search_score: 99 }),
      baseCandidate({ id: "va-ok", validation_status: "validated_auto", search_score: 90 }),
    ];

    const report = preSessionSelectExercises(candidates, {
      niveauVise: "A1",
      competence: "CE",
      quota: 3,
    });

    expect(report.retained.every((r) => r.validation_status !== "rejected")).toBe(true);
    expect(report.excluded.counts.EXCL_VALIDATION_REJECTED).toBe(2);
    expect(report.retained).toHaveLength(1);
  });

  it("generation_need=true quand quota insuffisant", () => {
    const candidates: PreSessionCandidate[] = [
      baseCandidate({
        id: "only-one",
        validation_status: "validated_auto",
        search_score: 88,
      }),
    ];

    const report = preSessionSelectExercises(candidates, {
      niveauVise: "A1",
      competence: "CE",
      quota: 5,
    });

    expect(report.retained).toHaveLength(1);
    expect(report.generation_need.required).toBe(true);
    expect(report.generation_need.total_gap).toBe(4);
    expect(report.remaining_gaps[0].gap).toBe(4);
  });
});
