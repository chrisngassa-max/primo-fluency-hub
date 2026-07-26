import { describe, expect, it } from "vitest";
import {
  assignClusterVariant,
  deriveFormatsForCluster,
  formatReferentialPromptBlock,
  formatDifferentiationTransformationPrompt,
  getDifferentiationTransformationRule,
  getDifferentiationTransformationRules,
  getClusterVariantRules,
  getDemarcheWeights,
  getDominantPilierFromErrors,
  getErrorRemediation,
  getExerciseScoringRules,
  getEnrichedSession,
  getIntraSessionRules,
  getOptionalModuleSessions,
  getSessionBlockRules,
  getSessionMinimumsForDuration,
  getDifferentiatedDurationMinimums,
  getStructuresSwitchRules,
  getThemeTemplate,
  inferThemeFromText,
  isCiviqueVisible,
  isOptionalModuleActive,
  mapStructuresCompetence,
  matchSwitchRule,
  normalizePlanCadreFormat,
  normalizeDifferentiationLevel,
  niveauToBand,
  resolveFormatAlias,
  resolveFormatForGenerator,
  resolvePlanCadreThemeId,
  scoreExerciseCandidate,
  validateDifferentiationVariantContract,
} from "../../supabase/functions/_shared/referential-loader.ts";

describe("referential-loader", () => {
  it("loads referential data", () => {
    expect(getStructuresSwitchRules().length).toBeGreaterThanOrEqual(24);
    expect(getErrorRemediation("PHONO", "A0_A1")).not.toBeNull();
    expect(getIntraSessionRules().length).toBe(12);
  });

  it("returns demarche weights for titre_sejour and naturalisation", () => {
    const titre = getDemarcheWeights("titre_sejour");
    expect(titre.CO).toBe(0.35);
    expect(titre.CE).toBe(0.35);
    expect(titre.EE).toBe(0.15);
    expect(titre.EO).toBe(0.15);
    expect(titre.niveau_cible).toBe("B1");

    const nat = getDemarcheWeights("naturalisation");
    expect(nat.CO).toBe(0.25);
    expect(nat.niveau_cible).toBe("B2");
  });

  it("maps niveau to band", () => {
    expect(niveauToBand("A0")).toBe("A0_A1");
    expect(niveauToBand("A2")).toBe("A2_B1");
    expect(niveauToBand("B2")).toBe("B2");
  });

  it("resolves format aliases including discrimination_audio", () => {
    const alias = resolveFormatAlias("discrimination_audio");
    expect(alias?.generateur).toBe("qcm");
    expect(alias?.options).toContain("support_audio");
    expect(resolveFormatForGenerator("discrimination_audio")).toBe("qcm");
  });

  it("matches PHONO switch rule when error rate exceeds threshold", () => {
    const rule = matchSwitchRule({
      niveauCecrl: "A1",
      errorCounts: { PHONO: 3, GRAM_ACCORD: 1 },
      totalErrors: 4,
      competenceScores: { EO: 45 },
    });

    expect(rule?.id).toBe("SW-EO-PHON-01");
    expect(rule?.pilier_cible).toBe("phonetique");
  });

  it("derives dominant pilier from error counts", () => {
    const pilier = getDominantPilierFromErrors(
      { PHONO: 5, GRAM_ACCORD: 1 },
      "A0_A1",
    );
    expect(pilier).toBe("phonetique");
  });

  it("loads theme templates by id", () => {
    const theme = getThemeTemplate("ADMIN_CAF_01");
    expect(theme?.label).toContain("CAF");
    expect(theme?.phases).toHaveLength(4);
    expect(theme?.phases[0].competences).toContain("Structures");
    expect(theme?.phases[0].pilier).toBe("vocabulaire");
    expect(theme?.competences_prioritaires?.titre_sejour).toEqual(["CO", "CE", "EO", "EE"]);
    expect(theme?.competences_prioritaires?.naturalisation).toEqual(["CO", "CE", "EO", "EE"]);
  });

  it("infers theme from session title keywords", () => {
    const theme = inferThemeFromText("Rendez-vous à la CAF pour les allocataires");
    expect(theme?.theme_id).toBe("ADMIN_CAF_01");
  });

  it("maps Structures_* competence to Structures + pilier", () => {
    expect(mapStructuresCompetence("Structures_Vocabulaire")).toEqual({
      competence: "Structures",
      pilier: "vocabulaire",
    });
    expect(mapStructuresCompetence("Structures_Phonetique")).toEqual({
      competence: "Structures",
      pilier: "phonetique",
    });
  });

  it("assigns cluster variants with normalized niveau_variante", () => {
    const rules = getClusterVariantRules();
    expect(rules.max_clusters_per_session).toBe(4);
    expect(rules.clusters).toHaveLength(3);

    const bas = assignClusterVariant("A0", "bas");
    expect(bas?.id).toBe("bas");
    expect(bas?.etayage_default).toBe("fort");
  });

  it("loads the 12 differentiation transformations", () => {
    const rules = getDifferentiationTransformationRules();
    expect(Object.keys(rules.transformations)).toHaveLength(12);
    expect(getDifferentiationTransformationRule("A2", "B2")?.id).toBe("A2_TO_B2");
    expect(getDifferentiationTransformationRule("A2", "A2")?.id).toBe("IDENTITY");
    expect(normalizeDifferentiationLevel("A0")).toBe("A1");
    expect(normalizeDifferentiationLevel("B2+")).toBe("B2");
  });

  it("formats a binding differentiation prompt", () => {
    const block = formatDifferentiationTransformationPrompt("A2", "B1", "CE");
    expect(block).toContain("A2_TO_B1");
    expect(block).toContain("competence_invariante: CE");
    expect(block).toContain("Ne jamais changer la competence");
  });

  it("rejects a generated variant that changes competence", () => {
    const result = validateDifferentiationVariantContract({
      sourceLevel: "A2",
      targetLevel: "B1",
      competence: "CE",
      variant: {
        differentiation_contract: { transformation_id: "A2_TO_B1" },
        tronc_commun: { competence: "CE" },
        exercice: { competence: "EE" },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DIFF_COMPETENCE_CHANGED");
  });

  it("accepts a same-competence declared transformation", () => {
    const result = validateDifferentiationVariantContract({
      sourceLevel: "B1",
      targetLevel: "A1",
      competence: "CO",
      variant: {
        differentiation_contract: { transformation_id: "B1_TO_A1" },
        tronc_commun: { competence: "CO" },
        exercice: { competence: "CO" },
      },
    });
    expect(result).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("scores exercise candidates and applies hard filters", () => {
    const scoring = getExerciseScoringRules();
    expect(scoring.scoring_rules.length).toBeGreaterThanOrEqual(15);
    expect(scoring.hard_filters.length).toBeGreaterThanOrEqual(10);

    const aligned = scoreExerciseCandidate({
      exercise: {
        theme_id: "ADMIN_CAF_01",
        domaine_irn: "admin",
        niveau_cecrl: "A1",
        competence: "CO",
        format: "qcm",
        etayage: "fort",
      },
      session: {
        theme_id: "ADMIN_CAF_01",
        domaine_irn: "admin",
        current_phase_competence: "CO",
        lexique_noyau: ["allocataire", "guichet"],
      },
      student: {
        niveau_cecrl: "A1",
        mode: "remediation",
        niveau_variante: "bas",
      },
      matrix: { formats_autorises: ["qcm", "vrai_faux"] },
    });

    expect(aligned.excluded).toBe(false);
    expect(aligned.score).toBeGreaterThan(0);
    expect(aligned.matchedRules).toContain("SCORE_01");

    const excluded = scoreExerciseCandidate({
      exercise: { theme_id: "LOG_FUITE_01", format: "qcm", niveau_cecrl: "A1" },
      session: { theme_id: "ADMIN_CAF_01" },
      student: { niveau_cecrl: "A1", mode: "demarrage" },
    });
    expect(excluded.excluded).toBe(true);
    expect(excluded.exclusionReason).toContain("tronc commun");
  });

  it("derives formats per cluster from pedagogical rules", () => {
    const derived = deriveFormatsForCluster("A1", "bas", "CO", "remediation");
    expect(derived.formats.length).toBeGreaterThan(0);
    expect(derived.rule?.competence).toBe("CO");
  });

  it("loads session block rules and minimums", () => {
    const rules = getSessionBlockRules();
    expect(rules.minimums_seance).toBeDefined();
    const mins60 = getSessionMinimumsForDuration(60);
    expect(mins60?.CO).toBe(2);
    expect(mins60?.EE).toBe(1);
    const differentiated60 = getDifferentiatedDurationMinimums(60);
    expect(differentiated60?.mode).toBe("warning");
    expect(differentiated60?.minimum_coverage_minutes).toBe(55);
    expect(differentiated60?.minimum_items_by_level).toEqual(
      expect.objectContaining({ A1: 8, B2: 4 }),
    );
  });

  it("formats referential prompt block with theme and invariants", () => {
    const theme = getThemeTemplate("SANTE_MED_01");
    const block = formatReferentialPromptBlock({
      theme,
      dureeMinutes: 60,
      clusterVariants: ["bas", "standard"],
    });
    expect(block).toContain("SANTE_MED_01");
    expect(block).toContain("INVARIANTS OBLIGATOIRES");
    expect(block).toContain("lexique_noyau");
  });

  it("loads enriched plan cadre sessions S8-S20", () => {
    expect(getEnrichedSession(7)).toBeNull();
    expect(getEnrichedSession(21)).toBeNull();

    const s8 = getEnrichedSession(8);
    expect(s8?.numero).toBe(8);
    expect(s8?.theme_id).toBe("SANTE_SYMPT_01");
    expect(resolvePlanCadreThemeId(s8!)).toBe("SANTE_MED_01");

    const s20 = getEnrichedSession(20);
    expect(s20?.theme_id).toBe("EVAL_TCF_IRN_FINALE");
    expect(getEnrichedSession(8)?.numero).toBe(8);
  });

  it("loads optional module sessions S21-S30", () => {
    const sessions = getOptionalModuleSessions();
    expect(sessions).toHaveLength(10);
    expect(sessions[0]?.numero).toBe(21);
    expect(sessions[9]?.numero).toBe(30);
  });

  it("activates optional module only when civique flags are set", () => {
    expect(isOptionalModuleActive({})).toBe(false);
    expect(isOptionalModuleActive({ re_signature_civique: true })).toBe(false);
    expect(
      isOptionalModuleActive({
        re_signature_civique: true,
        examen_civique_obligatoire: true,
      }),
    ).toBe(true);
  });

  it("routes civique visibility by student profile", () => {
    const s8 = getEnrichedSession(8)!;
    expect(isCiviqueVisible(s8, { type_demarche: "titre_sejour" })).toBe(false);
    expect(isCiviqueVisible(s8, { type_demarche: "naturalisation" })).toBe(true);
    expect(isCiviqueVisible(s8, { mention: "NAT" })).toBe(true);
    expect(isCiviqueVisible(s8, { premiere_demande_CSP: true })).toBe(true);

    const s10 = getEnrichedSession(10)!;
    expect(isCiviqueVisible(s10, { type_demarche: "naturalisation" })).toBe(false);
  });

  it("normalizes domain exercise formats via alias map", () => {
    expect(normalizePlanCadreFormat("comprehension_orale", "qcm")).toBe("qcm");
    expect(normalizePlanCadreFormat("comprehension_orale")).toBe("qcm");
    expect(normalizePlanCadreFormat("expression_ecrite")).toBe("production_ecrite");
    expect(normalizePlanCadreFormat("discrimination_audio")).toBe("qcm");

    const s8 = getEnrichedSession(8)!;
    const coBas = (s8.phases as Record<string, unknown>)?.CO as Record<string, unknown>;
    const variant = (coBas?.variants_cluster as Record<string, unknown>)?.bas as Record<string, unknown>;
    expect(variant?.format_domain).toBe("comprehension_orale");
    expect(variant?.format).toBe("qcm");
  });
});
