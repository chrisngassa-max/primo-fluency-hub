import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import {
  publicationDecision,
  validateS01DifferentiationPayload,
} from "./s01-differentiation-validate.mjs";
import { buildPublicationPlan } from "../publish-s01-interactive.mjs";

const DATA_PATH = join(process.cwd(), "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
const BASELINE_PATH = join(process.cwd(), "content", "curriculum", "v2", "S01-v3", "__snapshots__", "s01-v3-corpus-baseline.json");

let payload;
let baseline;

function clonePayload() {
  return structuredClone(payload);
}

function failedRule(validation, ruleId, metadataCode = null) {
  return validation.rules.some((rule) => (
    rule.rule_id === ruleId
    && rule.status === "fail"
    && (metadataCode === null || rule.metadata_code === metadataCode)
  ));
}

beforeAll(async () => {
  payload = JSON.parse(await readFile(DATA_PATH, "utf8"));
  baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
});

describe("validation bloquante S01", () => {
  it("valide la structure du corpus figé et produit une décision par exercice", () => {
    const validation = validateS01DifferentiationPayload(payload, { baseline });
    expect(validation.valid).toBe(true);
    expect(Object.keys(validation.by_exercise)).toHaveLength(59);
    expect(validation.publishable_count + validation.non_publishable_count).toBe(59);
    expect(validation.non_publishable_count).toBeGreaterThan(0);
  });

  it("abandonne tout le lot avant écriture si le volume figé change", () => {
    const mutated = clonePayload();
    mutated.exercises.pop();
    const plan = buildPublicationPlan(mutated, baseline);
    expect(plan.aborted).toBe(true);
    expect(plan.differentiation_validation.global_blocking_errors.some((error) => error.rule_id === "DIFF_CORPUS_VOLUME_CHANGED")).toBe(true);
  });

  it("bloque une compétence changée dans une famille", () => {
    const mutated = clonePayload();
    const entry = mutated.exercises.find((item) => item.family_id === "S01_CO_ACCUEIL_01");
    entry.competence = "EE";
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_COMPETENCE_CHANGED", entry.metadata_code)).toBe(true);
  });

  it("bloque une variante dupliquée et un B2 seulement allongé", () => {
    const mutated = clonePayload();
    const a2 = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:co-dialogue:A2");
    const b2 = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:co-dialogue:B2");
    b2.consigne = a2.consigne;
    b2.format = a2.format;
    b2.competence = a2.competence;
    b2.contenu.items = [...structuredClone(a2.contenu.items), structuredClone(a2.contenu.items[0])];
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_B2_ONLY_MORE_ITEMS", b2.metadata_code)).toBe(true);
  });

  it("bloque les divergences de hash du support et des faits", () => {
    const mutated = clonePayload();
    const family = mutated.exercises.filter((item) => item.metadata_code.includes(":co-dialogue:"));
    family[0].support_hash = "support-v1";
    family[1].support_hash = "support-v2";
    family[0].contenu.metadata.facts_hash = "facts-v1";
    family[1].contenu.metadata.facts_hash = "facts-v2";
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_SUPPORT_DIVERGED", family[0].metadata_code)).toBe(true);
    expect(failedRule(validation, "DIFF_FACTS_CHANGED", family[0].metadata_code)).toBe(true);
  });

  it("bloque une transformation inconnue ou une preuve sans chemin réel", () => {
    const mutated = clonePayload();
    const unknown = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:co-dialogue:A2");
    unknown.contenu.metadata.transformation_id = "A2_TO_B3";
    const invalidPath = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:co-dialogue:B1");
    invalidPath.contenu.metadata.applied_transformations[0].applied_to = "items[999].justification_prompt";
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_TRANSFORMATION_UNDECLARED", unknown.metadata_code)).toBe(true);
    expect(failedRule(validation, "DIFF_COGNITIVE_OPERATION_NOT_REALIZED", invalidPath.metadata_code)).toBe(true);
  });

  it("bloque une correction incohérente, un indice révélateur et un fait civique non validé", () => {
    const mutated = clonePayload();
    const closed = mutated.exercises.find((item) => item.format === "qcm" && item.contenu.items[0]?.options?.length > 1);
    closed.contenu.items[0].bonne_reponse = "Réponse absente des options";
    closed.contenu.items[0].indice = "La réponse est Réponse absente des options";
    const civic = mutated.exercises.find((item) => item.civic_content);
    civic.contenu.items[0].needs_review = true;
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_INSTRUCTION_CORRECTION_MISMATCH", closed.metadata_code)).toBe(true);
    expect(failedRule(validation, "DIFF_HINT_LEAK", closed.metadata_code)).toBe(true);
    expect(failedRule(validation, "DIFF_CIVIC_FACT_NOT_VALIDATED", civic.metadata_code)).toBe(true);
  });

  it("bloque une réponse recopiée dans la question, sans bloquer une phrase à trou", () => {
    const mutated = clonePayload();
    const leaked = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:lexique-association:B1");
    leaked.contenu.items[0].question = `La réponse correcte est ${leaked.contenu.items[0].bonne_reponse}.`;
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_ANSWER_LEAK_IN_QUESTION", leaked.metadata_code)).toBe(true);

    const currentValidation = validateS01DifferentiationPayload(payload, { baseline });
    expect(failedRule(currentValidation, "DIFF_ANSWER_LEAK_IN_QUESTION", "cv2:S01:v3:structures:A1")).toBe(false);
    expect(failedRule(currentValidation, "DIFF_ANSWER_LEAK_IN_QUESTION", "cv2:S01:v3:lexique-association:B1")).toBe(false);
  });
  it("les variantes lexicales B1/B2 masquent le mot et B2 exige une justification", () => {
    for (const level of ["B1", "B2"]) {
      const exercise = payload.exercises.find((item) => item.metadata_code === `cv2:S01:v3:lexique-association:${level}`);
      expect(exercise.contenu.items).toHaveLength(10);
      for (const item of exercise.contenu.items) {
        expect(item.question).toContain("________");
        expect(item.question.toLocaleLowerCase("fr")).not.toContain(String(item.bonne_reponse).toLocaleLowerCase("fr"));
        if (level === "B2") expect(item.justification_required).toBe(true);
      }
    }
  });
  it("bloque une extension placée à l'intérieur d'une famille", () => {
    const mutated = clonePayload();
    const entry = mutated.exercises.find((item) => item.family_id);
    entry.extension_of_family_id = entry.family_id;
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "DIFF_EXTENSION_INSIDE_FAMILY", entry.metadata_code)).toBe(true);
  });

  it("bloque le jargon pedagogique dans une consigne apprenant", () => {
    const mutated = clonePayload();
    const exercise = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:lexique-association:B1");
    exercise.consigne = "Reperez le distracteur puis choisissez le mot approprie dans chaque exemple d'emploi.";
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "INSTRUCTION_JARGON_UNEXPLAINED", exercise.metadata_code)).toBe(true);
  });

  it("bloque une reponse revelee dans la demande de justification", () => {
    const mutated = clonePayload();
    const exercise = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:lexique-association:B2");
    const item = exercise.contenu.items[0];
    item.justification_prompt = `Expliquez pourquoi la bonne reponse est ${item.bonne_reponse}.`;
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "INSTRUCTION_ANSWER_LEAK", exercise.metadata_code)).toBe(true);
  });

  it("accepte les nouvelles consignes lexicales B1 et B2", () => {
    const validation = validateS01DifferentiationPayload(payload, { baseline });
    for (const level of ["B1", "B2"]) {
      const metadataCode = `cv2:S01:v3:lexique-association:${level}`;
      const instructionFailures = validation.by_exercise[metadataCode].rules.filter((rule) => (
        rule.rule_id.startsWith("INSTRUCTION_") && rule.status === "fail"
      ));
      expect(instructionFailures).toEqual([]);
    }
  });
  it("bloque un texte lacunaire sans trou visible et une correction incomplete", () => {
    const mutated = clonePayload();
    const gap = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:lexique-texte-lacunaire:B2");
    gap.contenu.items[0].question = "Mot manquant 1";
    delete gap.contenu.items[1].correction.remediation;
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "COHERENCE_GAP_COUNT", gap.metadata_code)).toBe(true);
    expect(failedRule(validation, "COHERENCE_CORRECTION_COMPLETE", gap.metadata_code)).toBe(true);
  });

  it("bloque une consigne qui annonce trois espaces alors qu'un seul est affiche par item", () => {
    const mutated = clonePayload();
    const gap = mutated.exercises.find((item) => item.metadata_code === "cv2:S01:v3:lexique-texte-lacunaire:B2");
    gap.consigne = "Completez les trois espaces.";
    const validation = validateS01DifferentiationPayload(mutated, { baseline });
    expect(failedRule(validation, "COHERENCE_DECLARED_COUNT_MATCH", gap.metadata_code)).toBe(true);
  });

  it("la famille lexique lacunaire reparee passe les controles de trou aux quatre niveaux", () => {
    const validation = validateS01DifferentiationPayload(payload, { baseline });
    for (const level of ["A1", "A2", "B1", "B2"]) {
      const code = `cv2:S01:v3:lexique-texte-lacunaire:${level}`;
      expect(failedRule(validation, "COHERENCE_GAP_COUNT", code)).toBe(false);
      expect(failedRule(validation, "COHERENCE_DECLARED_COUNT_MATCH", code)).toBe(false);
    }
  });

  it("le plan conserve 59 brouillons mais ne relie que les variantes conformes", () => {
    const plan = buildPublicationPlan(payload, baseline);
    expect(plan.aborted).toBe(false);
    expect(plan.drafts).toHaveLength(59);
    expect(plan.linkable).toHaveLength(plan.differentiation_validation.publishable_count);
    expect(plan.blocked_variants).toHaveLength(plan.differentiation_validation.non_publishable_count);
    for (const blocked of plan.blocked_variants) {
      expect(publicationDecision(plan.differentiation_validation, blocked.metadata_code).publishable).toBe(false);
    }
  });
});