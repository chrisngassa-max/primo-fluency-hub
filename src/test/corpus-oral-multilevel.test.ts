/**
 * Corpus pédagogique — fixtures dérivées de :
 * D:\sites\tcf pro\docs\fichiers oral\{A2,B2}\*.mp3
 *
 * Ces tests n'appellent pas Gemini : ils évaluent la compatibilité support
 * et la validation déterministe sur des faits représentatifs du corpus.
 */
import { describe, expect, it } from "vitest";
import {
  calculateFactsHash,
  evaluateSupportCompatibility,
  getCoLevelContract,
  validateDifferentiationFamilySlice,
  type DifferentiationFact,
  type DifferentiationFamilySliceV1,
  type SliceLevel,
} from "../../supabase/functions/_shared/differentiation/index.ts";

type CorpusCase = {
  id: string;
  file: string;
  accepted: SliceLevel[];
  refused: SliceLevel[];
  facts: DifferentiationFact[];
  notes: string;
};

function makeFact(
  id: string,
  quote: string,
  qualifiers: Record<string, unknown>,
  segment = "seg-1",
  chunk = "chunk-1",
): DifferentiationFact {
  return {
    fact_id: id,
    subject: "locuteur",
    predicate: "indique",
    object: quote,
    semantic_qualifiers: qualifiers,
    provenance: {
      source_id: "corpus-source",
      transcription_id: "corpus-tr",
      segment_refs: [segment],
      chunk_refs: [chunk],
      quote,
    },
    required_for_task: true,
  };
}

const CORPUS: CorpusCase[] = [
  {
    id: "simple-a2-handball",
    file: "A2/handball.mp3",
    accepted: ["A1", "A2"],
    refused: ["B2"],
    notes: "Support simple : sport, jour, lieu — explicite uniquement.",
    facts: [
      makeFact("fact_01", "Il joue au handball.", { fact_kind: "explicit_info" }),
      makeFact("fact_02", "Le match a lieu samedi.", { fact_kind: "explicit_info" }),
      makeFact("fact_03", "Le club est à Remalard.", { fact_kind: "explicit_info" }),
    ],
  },
  {
    id: "b1-apres-confinement",
    file: "A2/l_apres_confinement.mp3",
    accepted: ["A1", "A2", "B1"],
    refused: ["B2"],
    notes: "Chronologie + opinion explicite, sans vraie confrontation de points de vue.",
    facts: [
      makeFact("fact_01", "Le thème est la vie après le confinement.", { fact_kind: "main_idea" }),
      makeFact("fact_02", "D'abord le confinement, ensuite la reprise progressive.", { fact_kind: "chronology" }),
      makeFact("fact_03", "Je pense que c'était difficile pour les étudiants.", { fact_kind: "opinion", speaker: "louise", justified: false }),
      makeFact("fact_04", "Elle veut reprendre la musique en ville.", { fact_kind: "intention", speaker: "louise" }),
    ],
  },
  {
    id: "b2-actualites",
    file: "B2/les_actualites_qui_ont_marque_ma_vie.mp3",
    accepted: ["A1", "A2", "B1", "B2"],
    refused: [],
    notes: "Support riche réel : opinion justifiée, points de vue rapportés, cause/conséquence, implicite étayé.",
    facts: [
      makeFact(
        "fact_01",
        "je considère quand même que j'ai beaucoup de chance parce que je n'ai pas connu contrairement à mes grands-parents",
        {
          fact_kind: "opinion",
          speaker: "Laure",
          viewpoint: "Laure",
          epistemic: "opinion",
          justified: true,
          relation_type: "justification",
          support_fact_ids: ["fact_02", "fact_03"],
        },
      ),
      makeFact(
        "fact_02",
        "eux ont pu le vivre la Seconde Guerre mondiale",
        { fact_kind: "viewpoint", speaker: "Laure", viewpoint: "grands-parents", epistemic: "fact", relation_type: "contrast" },
      ),
      makeFact(
        "fact_03",
        "pour ma grand-mère qui avait dû fuir l'avancée des Allemands en Seine-et-Marne",
        { fact_kind: "cause", speaker: "Laure", epistemic: "fact", relation_type: "cause" },
      ),
      makeFact(
        "fact_04",
        "l'événement qui m'a le plus fait peur quand j'étais plus jeune, c'était en 1987 avec l'explosion de la centrale nucléaire de Tchernobyl",
        { fact_kind: "attitude", speaker: "Laure", epistemic: "opinion", justified: true, support_fact_ids: ["fact_05"] },
      ),
      makeFact(
        "fact_05",
        "cette ambiance un petit peu de crainte et l'inquiétude des gens aussi dans la rue",
        { fact_kind: "consequence", speaker: "Laure", viewpoint: "les gens", epistemic: "fact", relation_type: "consequence" },
      ),
      makeFact(
        "fact_06",
        "je n'ai pas connu le traumatisme de la mort d'Elvis Presley puisque j'étais dans le ventre de ma mère",
        { fact_kind: "explicit_info", speaker: "Laure", epistemic: "fact" },
      ),
    ],
  },
  {
    id: "too-simple-for-b2-geocaching",
    file: "A2/elisa_geocaching.mp3",
    accepted: ["A1", "A2"],
    refused: ["B2"],
    notes: "Refus B2 honnête attendu : récit simple d'activité de loisir.",
    facts: [
      makeFact("fact_01", "Elisa fait du géocaching.", { fact_kind: "explicit_info" }),
      makeFact("fact_02", "Elle cherche des caches en forêt.", { fact_kind: "explicit_info" }),
      makeFact("fact_03", "L'activité dure deux heures.", { fact_kind: "explicit_info" }),
    ],
  },
];

async function buildFamily(
  level: SliceLevel,
  facts: DifferentiationFact[],
  itemCount: number,
  itemFactory: (index: number) => DifferentiationFamilySliceV1["variants"][SliceLevel] extends infer V
    ? V extends { exercise: { items: Array<infer I> } } ? I : never
    : never,
): Promise<DifferentiationFamilySliceV1> {
  const { contract } = getCoLevelContract(level);
  const factsHash = await calculateFactsHash(facts);
  const items = Array.from({ length: itemCount }, (_, index) => itemFactory(index));
  const transformationId = level === "A2" ? "IDENTITY" : `A2_TO_${level}`;
  return {
    schema_version: "slice-1.0",
    family_id: `${level}CO_CORPUS01`,
    version: 1,
    status: "draft",
    competence: "CO",
    subcompetence: "comprehension_orale",
    objective: contract.objectives?.[0] ?? `Objectif ${level}`,
    core_task: "Répondre après écoute.",
    source_level: "A2",
    generated_levels: [level],
    source_document: {
      source_document_id: "corpus-source",
      uri: "pedagogical-sources/corpus/source.mp3",
      content_hash: `sha256:${"c".repeat(64)}`,
      immutable: true,
      provenance: { type: "authored", version: 1 },
    },
    facts: { required: facts, facts_hash: factsHash },
    level_contracts: { [level]: contract },
    variants: {
      [level]: {
        target_level: level,
        competence: "CO",
        transformation_id: transformationId as any,
        support_mode: "source",
        support_ref: "corpus-tr",
        applied_transformations: [],
        exercise: {
          title: `Corpus ${level}`,
          instruction: "Écoutez puis répondez.",
          format: "qcm",
          steps: ["Écouter", "Répondre"],
          items,
          expected_output: "Réponses",
        },
        scaffolding: {},
        success_criteria: [`Réussir l'activité ${level}.`],
      },
    },
    generation: {
      target_level: level,
      support_compatibility: evaluateSupportCompatibility(level, facts),
    },
    validation_report: { status: "not_run", blocking: [], warnings: [], requires_human_review: [] },
  };
}

describe("corpus oral multilevel compatibility", () => {
  for (const entry of CORPUS) {
    it(`${entry.id} (${entry.file}) — niveaux acceptés/refusés`, () => {
      for (const level of entry.accepted) {
        const result = evaluateSupportCompatibility(level, entry.facts);
        expect(result.supported, `${entry.id} devrait accepter ${level}`).toBe(true);
      }
      for (const level of entry.refused) {
        const result = evaluateSupportCompatibility(level, entry.facts);
        expect(result.supported, `${entry.id} devrait refuser ${level}`).toBe(false);
        expect(result.code).toBe("DIFF_TRANSFORMATION_NOT_SUPPORTED");
      }
    });
  }

  it("produces example families per accepted level without invented facts", async () => {
    const rich = CORPUS.find((entry) => entry.id === "b2-actualites")!;
    for (const level of ["A1", "A2", "B1", "B2"] as SliceLevel[]) {
      const { contract } = getCoLevelContract(level);
      const family = await buildFamily(level, rich.facts, contract.volume_items_min, (index) => ({
        id: `item_${index + 1}`,
        type: "qcm" as const,
        instruction: level === "B2"
          ? "Quelle attitude se dégage de plusieurs faits du document ?"
          : "Quelle information est entendue ?",
        choices: [
          { id: "a", text: "Réponse A", is_correct: true },
          { id: "b", text: "Réponse B", is_correct: false, distractor_category: "information_entendue_mais_non_reponse" },
          ...(level === "A1" ? [] : [{ id: "c", text: "Réponse C", is_correct: false, distractor_category: "detail_secondaire" }]),
        ],
        fact_refs: level === "B2" || level === "B1"
          ? ["fact_01", "fact_02"]
          : ["fact_01"],
        justification: "Fondé exclusivement sur les faits sourcés.",
      }));

      const report = await validateDifferentiationFamilySlice(family, {
        sourceContentHash: family.source_document.content_hash,
        segmentIds: ["seg-1"],
        chunkIds: ["chunk-1"],
        chunkSegmentPairs: ["chunk-1:seg-1"],
        timestampsVerified: false,
        transcriptionReviewed: true,
        sourceAnalyzed: true,
        sourceReviewApproved: true,
        sourceHashPresent: true,
        sourceHashCoherent: true,
        originalMp3Available: true,
        factualProvenancePresent: true,
      });

      expect(report.status === "pass" || report.status === "warning").toBe(true);
      expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_ITEM_FACT_REF_ORPHAN");
      expect(family.facts.required.every((fact) => fact.provenance.quote.length > 0)).toBe(true);
      expect(report.warnings.map((issue) => issue.code)).toContain("DIFF_TRANSCRIPTION_TIMESTAMPS_UNVERIFIED");
    }
  });

  it("records an honest B2 refusal example on simple support", () => {
    const simple = CORPUS.find((entry) => entry.id === "too-simple-for-b2-geocaching")!;
    const refusal = evaluateSupportCompatibility("B2", simple.facts);
    expect(refusal).toMatchObject({
      supported: false,
      code: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
    });
    expect(refusal.message).toMatch(/B2 fiable/);
  });

  it("keeps B2 items between 5 and 8 with fact_refs and no outside knowledge", async () => {
    const rich = CORPUS.find((entry) => entry.id === "b2-actualites")!;
    const { contract } = getCoLevelContract("B2");
    expect(contract.volume_items_min).toBeGreaterThanOrEqual(5);
    expect(contract.volume_items_max).toBeLessThanOrEqual(8);
    const family = await buildFamily("B2", rich.facts, 6, (index) => ({
      id: `item_${index + 1}`,
      type: "qcm" as const,
      instruction: "Quelle justification Laure donne-t-elle de sa chance, d'après le document ?",
      choices: [
        { id: "a", text: "Elle n'a pas connu de tragédie durable, contrairement à ses grands-parents.", is_correct: true },
        { id: "b", text: "Elvis Presley est mort en 1977.", is_correct: false, distractor_category: "faits_exterieurs" },
        { id: "c", text: "Le confinement de 2020 a tout changé.", is_correct: false, distractor_category: "information_entendue_mais_non_reponse" },
      ],
      fact_refs: ["fact_01", "fact_02"],
      justification: "La réponse s'appuie sur l'opinion entendue et le contraste rapporté, sans date extérieure.",
    }));
    const items = family.variants.B2!.exercise.items;
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.length).toBeLessThanOrEqual(8);
    expect(items.every((item) => item.fact_refs.length >= 1)).toBe(true);
    expect(items.every((item) => item.fact_refs.every((ref) => rich.facts.some((fact) => fact.fact_id === ref)))).toBe(true);
    expect(family.facts.required.some((fact) => /1977/.test(fact.provenance.quote))).toBe(false);

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["seg-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:seg-1"],
      timestampsVerified: false,
      transcriptionReviewed: true,
      sourceAnalyzed: true,
      sourceReviewApproved: true,
      sourceHashPresent: true,
      sourceHashCoherent: true,
      originalMp3Available: true,
      factualProvenancePresent: true,
    });
    expect(report.status === "pass" || report.status === "warning").toBe(true);
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_ITEM_FACT_REF_ORPHAN");
  });
});
