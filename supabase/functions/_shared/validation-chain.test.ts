import { describe, expect, it } from "vitest";
import { validateExercise } from "./exercise-validator.ts";
import {
  decideValidationStatus,
  hasBlockingChainIssue,
  runLayerL1Structure,
  runLayerL2UsableContent,
  runLayerL3FormatCompetence,
  runLayerL4Niveau,
  runLayerL5Theme,
  runLayerL6Pedagogie,
  runLayerL7Correction,
  runValidationChain,
  type ChainIssue,
} from "./validation-chain.ts";

const VALID_CE_QCM = {
  id: "1",
  titre: "Lecture banque",
  consigne: "Lisez le texte.",
  competence: "CE",
  format: "qcm",
  niveau_vise: "A1",
  theme: "banque",
  contexte_irn: "banque",
  contenu: {
    texte: "Marie va à la banque pour ouvrir un compte bancaire.",
    items: [
      {
        question: "Où va Marie ?",
        options: ["À la banque", "À l'école", "Au travail"],
        bonne_reponse: "À la banque",
      },
    ],
  },
};

describe("validation-chain L1 structure", () => {
  it("T1: missing_title → error, layer L1", () => {
    const issues = runLayerL1Structure({ ...VALID_CE_QCM, titre: "" });
    const hit = issues.find((i) => i.code === "missing_title");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("error");
    expect(hit?.layer).toBe("L1_structure");
  });

  it("T2: QCM bonne_reponse hors options → error", () => {
    const issues = runLayerL1Structure({
      ...VALID_CE_QCM,
      contenu: {
        ...VALID_CE_QCM.contenu,
        items: [
          {
            question: "Q ?",
            options: ["a", "b"],
            bonne_reponse: "c",
          },
        ],
      },
    });
    expect(issues.some((i) => i.code === "qcm_answer_not_in_options")).toBe(true);
  });
});

describe("validation-chain L2 usable content", () => {
  it("T3: QCM sans items → not_usable_content error", () => {
    const issues = runLayerL2UsableContent({
      ...VALID_CE_QCM,
      contenu: { texte: VALID_CE_QCM.contenu.texte, items: [] },
    });
    expect(issues.some((i) => i.code === "not_usable_content" && i.severity === "error")).toBe(true);
  });

  it("T4: production_ecrite sans items → passed L2", () => {
    const issues = runLayerL2UsableContent({
      id: "x",
      consigne: "Écrivez un texte court.",
      format: "production_ecrite",
      competence: "EE",
      contenu: {},
    });
    expect(issues.filter((i) => i.code === "not_usable_content")).toHaveLength(0);
  });
});

describe("validation-chain L3 format/competence", () => {
  it("T5: EE + production_orale → EXCL_02_format_competence", () => {
    const issues = runLayerL3FormatCompetence({
      ...VALID_CE_QCM,
      competence: "EE",
      format: "production_orale",
    });
    expect(issues.some((i) => i.code === "EXCL_02_format_competence")).toBe(true);
  });
});

describe("validation-chain L4 niveau", () => {
  it("T6: niveau_vise invalide → error", () => {
    const issues = runLayerL4Niveau({ ...VALID_CE_QCM, niveau_vise: "C1" });
    expect(issues.some((i) => i.code === "invalid_niveau_vise")).toBe(true);
  });

  it("T7: A0 + production_ecrite → EXCL_04 error", () => {
    const issues = runLayerL4Niveau({
      id: "x",
      competence: "EE",
      format: "production_ecrite",
      niveau_vise: "A0",
    });
    expect(issues.some((i) => i.code === "EXCL_04_a0_production_ecrite")).toBe(true);
  });

  it("T8: cible B2, exercice A0 → level_doubtful warning", () => {
    const issues = runLayerL4Niveau(
      { ...VALID_CE_QCM, niveau_vise: "A0" },
      { targetNiveauVise: "B2" },
    );
    expect(issues.some((i) => i.code === "level_doubtful" && i.severity === "warning")).toBe(true);
  });
});

describe("validation-chain L5 theme", () => {
  it("T9: theme = foo → invalid_theme error", () => {
    const { issues } = runLayerL5Theme({ ...VALID_CE_QCM, theme: "foo" });
    expect(issues.some((i) => i.code === "invalid_theme")).toBe(true);
  });

  it("T10: theme ≠ contexte_irn canonique → warning mismatch", () => {
    const { issues } = runLayerL5Theme({
      ...VALID_CE_QCM,
      theme: "banque",
      contexte_irn: "logement",
    });
    expect(issues.some((i) => i.code === "theme_context_mismatch")).toBe(true);
  });

  it("T11: prefecture → flag sensitive_admin", () => {
    const { flags } = runLayerL5Theme({ ...VALID_CE_QCM, theme: "prefecture" });
    expect(flags).toContain("sensitive_admin");
  });
});

describe("validation-chain L6 pédagogie", () => {
  it("T12: consigne > 12 mots → warning (useAI: false)", async () => {
    const longConsigne =
      "Lisez attentivement le texte suivant puis choisissez la bonne réponse parmi les options proposées ci-dessous.";
    const issues = await runLayerL6Pedagogie({ ...VALID_CE_QCM, consigne: longConsigne });
    expect(
      issues.some(
        (i) =>
          i.code === "consigne_too_long_for_directives" && i.severity === "warning",
      ),
    ).toBe(true);
  });
});

describe("validation-chain L7 correction", () => {
  it("T13: CE réponse absente du texte → error", () => {
    const issues = runLayerL7Correction({
      ...VALID_CE_QCM,
      contenu: {
        texte: "Marie va à la banque pour ouvrir un compte.",
        items: [
          {
            question: "Où ?",
            options: ["À l'école", "Au travail", "À la banque"],
            bonne_reponse: "À l'école",
          },
        ],
      },
    });
    expect(issues.some((i) => i.code === "correction_not_in_text")).toBe(true);
  });

  it("T14: QCM ambigu → ambiguous_correction warning", () => {
    const issues = runLayerL7Correction({
      ...VALID_CE_QCM,
      competence: "Structures",
      contenu: {
        items: [
          {
            question: "Choisissez",
            options: ["banque", "la banque", "école"],
            bonne_reponse: "banque",
          },
        ],
      },
    });
    expect(issues.some((i) => i.code === "ambiguous_correction")).toBe(true);
  });
});

describe("validation-chain runValidationChain", () => {
  it("T15: fixture valide CE → validated_auto, ok: true", async () => {
    const result = await runValidationChain(VALID_CE_QCM, {
      targetNiveauVise: VALID_CE_QCM.niveau_vise,
      targetThemeId: VALID_CE_QCM.theme,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("validated_auto");
  });

  it("T16: fixture invalide → rejected", async () => {
    const result = await runValidationChain({ ...VALID_CE_QCM, titre: "" });
    expect(result.status).toBe("rejected");
    expect(result.ok).toBe(false);
  });

  it("T17: warnings zone grise → needs_review", async () => {
    const result = await runValidationChain(
      {
        ...VALID_CE_QCM,
        niveau_vise: "A0",
        theme: "prefecture",
        contexte_irn: "logement",
      },
      { targetNiveauVise: "B2", targetThemeId: "prefecture" },
    );
    expect(result.status).toBe("needs_review");
  });
});

describe("validation-chain decideValidationStatus", () => {
  it("T18: ≥ 3 warnings distincts → needs_review", () => {
    const issues: ChainIssue[] = [
      { code: "w1", severity: "warning", message: "a", layer: "L1_structure" },
      { code: "w2", severity: "warning", message: "b", layer: "L2_usable_content" },
      { code: "w3", severity: "warning", message: "c", layer: "L3_format_competence" },
    ];
    expect(decideValidationStatus(issues, [])).toBe("needs_review");
  });
});

describe("validation-chain helpers", () => {
  it("T19: hasBlockingChainIssue — error → true, warnings seuls → false", () => {
    expect(
      hasBlockingChainIssue([
        { code: "e", severity: "error", message: "x", layer: "L1_structure" },
      ]),
    ).toBe(true);
    expect(
      hasBlockingChainIssue([
        { code: "w", severity: "warning", message: "x", layer: "L1_structure" },
      ]),
    ).toBe(false);
  });

  it("T20: validateExercise inchangé — même résultat via L1 wrapper", () => {
    const direct = validateExercise(VALID_CE_QCM);
    const viaL1 = runLayerL1Structure(VALID_CE_QCM);
    expect(viaL1.map((i) => i.code).sort()).toEqual(direct.issues.map((i) => i.code).sort());
    expect(viaL1.every((i) => i.layer === "L1_structure")).toBe(true);
  });
});
