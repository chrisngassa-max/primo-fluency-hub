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
    notes: "Support riche : points de vue, argumentation, fait/opinion/hypothèse.",
    facts: [
      makeFact("fact_01", "Alice dit que les attentats ont marqué sa jeunesse.", { fact_kind: "viewpoint", speaker: "alice", viewpoint: "alice" }),
      makeFact("fact_02", "Bruno estime que le confinement a été plus déterminant.", { fact_kind: "viewpoint", speaker: "bruno", viewpoint: "bruno" }),
      makeFact("fact_03", "Parce que les priorités professionnelles ont changé.", { fact_kind: "argument", justified: true }),
      makeFact("fact_04", "À mon avis, la solidarité a augmenté.", { fact_kind: "opinion", justified: true, speaker: "alice" }),
      makeFact("fact_05", "Peut-être que ces événements resteront dans les manuels.", { fact_kind: "hypothesis", epistemic: "hypothesis" }),
      makeFact("fact_06", "Le 13 novembre est une date citée explicitement.", { fact_kind: "fact", epistemic: "fact" }),
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
});
