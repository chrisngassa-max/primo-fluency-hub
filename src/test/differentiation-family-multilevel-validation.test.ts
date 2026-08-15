import { describe, expect, it } from "vitest";
import {
  calculateFactsHash,
  getCoLevelContract,
  validateDifferentiationFamilySlice,
  type DifferentiationFact,
  type DifferentiationFamilySliceV1,
  type SliceLevel,
} from "../../supabase/functions/_shared/differentiation/index.ts";

function baseFact(overrides: Partial<DifferentiationFact> = {}): DifferentiationFact {
  return {
    fact_id: "fact_01",
    subject: "le train",
    predicate: "partir",
    object: "17h00",
    semantic_qualifiers: { fact_kind: "explicit_info" },
    provenance: {
      source_id: "source-1",
      transcription_id: "transcription-1",
      segment_refs: ["segment-1"],
      chunk_refs: ["chunk-1"],
      quote: "Le train part à dix-sept heures.",
    },
    required_for_task: true,
    ...overrides,
  };
}

async function familyFor(
  level: SliceLevel,
  facts: DifferentiationFact[],
  itemCount?: number,
  customize?: (family: DifferentiationFamilySliceV1) => void,
): Promise<DifferentiationFamilySliceV1> {
  const { contract } = getCoLevelContract(level);
  const count = itemCount ?? contract.volume_items_min;
  const factsHash = await calculateFactsHash(facts);
  const family: DifferentiationFamilySliceV1 = {
    schema_version: "slice-1.0",
    family_id: `${level}CO_TRAIN_001`,
    version: 1,
    status: "draft",
    competence: "CO",
    subcompetence: "identifier une information horaire",
    objective: contract.objectives?.[0] ?? "Comprendre une information.",
    core_task: "Identifier l'information annoncée.",
    source_level: "A2",
    generated_levels: [level],
    source_document: {
      source_document_id: "source-1",
      uri: "pedagogical-sources/user/source.mp3",
      content_hash: `sha256:${"a".repeat(64)}`,
      immutable: true,
      provenance: { type: "authored", version: 1 },
    },
    facts: { required: facts, facts_hash: factsHash },
    level_contracts: { [level]: contract },
    variants: {
      [level]: {
        target_level: level,
        competence: "CO",
        transformation_id: level === "A2" ? "IDENTITY" : `A2_TO_${level}` as any,
        support_mode: "source",
        support_ref: "source-1",
        applied_transformations: [],
        exercise: {
          title: `Comprendre une annonce ${level}`,
          instruction: "Écoutez puis choisissez la bonne réponse.",
          format: "qcm",
          steps: ["Écouter", "Répondre"],
          items: Array.from({ length: count }, (_, index) => ({
            id: `item_${index + 1}`,
            type: "qcm" as const,
            instruction: "À quelle heure part le train ?",
            choices: [
              {
                id: `choice_${index + 1}_1`,
                text: "16h00",
                is_correct: false,
                distractor_category: "confusion_temporelle",
              },
              {
                id: `choice_${index + 1}_2`,
                text: "17h00",
                is_correct: true,
              },
              ...(level === "A1"
                ? []
                : [{
                  id: `choice_${index + 1}_3`,
                  text: "18h00",
                  is_correct: false,
                  distractor_category: "confusion_temporelle",
                }]),
            ],
            fact_refs: level === "B2" || level === "B1" ? ["fact_01", "fact_02"] : ["fact_01"],
            justification: "L'heure est explicitement annoncée.",
          })),
          expected_output: "Une réponse par question.",
        },
        scaffolding: {},
        success_criteria: ["Répondre correctement."],
      },
    },
    validation_report: { status: "not_run", blocking: [], warnings: [], requires_human_review: [] },
  };
  customize?.(family);
  return family;
}

const richFacts = (): DifferentiationFact[] => ([
  baseFact({ fact_id: "fact_01", semantic_qualifiers: { fact_kind: "viewpoint", speaker: "a", viewpoint: "a" } }),
  baseFact({ fact_id: "fact_02", semantic_qualifiers: { fact_kind: "viewpoint", speaker: "b", viewpoint: "b" }, provenance: { ...baseFact().provenance, quote: "Autre point de vue." } }),
  baseFact({ fact_id: "fact_03", semantic_qualifiers: { fact_kind: "argument", justified: true }, provenance: { ...baseFact().provenance, quote: "Parce que..." } }),
  baseFact({ fact_id: "fact_04", semantic_qualifiers: { fact_kind: "opinion", justified: true }, provenance: { ...baseFact().provenance, quote: "À mon avis..." } }),
  baseFact({ fact_id: "fact_05", semantic_qualifiers: { fact_kind: "hypothesis", epistemic: "hypothesis" }, provenance: { ...baseFact().provenance, quote: "Peut-être..." } }),
]);

describe("multilevel differentiation validation", () => {
  it("accepts A1 and preserves A2 contract bounds", async () => {
    const a1 = await familyFor("A1", [baseFact()]);
    const a2 = await familyFor("A2", [baseFact(), baseFact({ fact_id: "fact_02" })]);
    for (const family of [a1, a2]) {
      const report = await validateDifferentiationFamilySlice(family, {
        sourceContentHash: family.source_document.content_hash,
        segmentIds: ["segment-1"],
        chunkIds: ["chunk-1"],
        chunkSegmentPairs: ["chunk-1:segment-1"],
      });
      expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_LEVEL_MISMATCH");
      expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_ITEM_COUNT_OUT_OF_RANGE");
    }
  });

  it("accepts B1 on compatible support and B2 on rich support", async () => {
    const b1Facts = [
      baseFact({ fact_id: "fact_01", semantic_qualifiers: { fact_kind: "main_idea" } }),
      baseFact({ fact_id: "fact_02", semantic_qualifiers: { fact_kind: "chronology" }, provenance: { ...baseFact().provenance, quote: "Puis..." } }),
      baseFact({ fact_id: "fact_03", semantic_qualifiers: { fact_kind: "opinion" }, provenance: { ...baseFact().provenance, quote: "Je pense..." } }),
    ];
    const b1 = await familyFor("B1", b1Facts);
    const b2 = await familyFor("B2", richFacts());
    for (const family of [b1, b2]) {
      const report = await validateDifferentiationFamilySlice(family, {
        sourceContentHash: family.source_document.content_hash,
        segmentIds: ["segment-1"],
        chunkIds: ["chunk-1"],
        chunkSegmentPairs: ["chunk-1:segment-1"],
      });
      expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_TRANSFORMATION_NOT_SUPPORTED");
    }
  });

  it("refuses B2 on simple support", async () => {
    const family = await familyFor("B2", [baseFact(), baseFact({ fact_id: "fact_02" })]);
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(report.blocking.map((issue) => issue.code)).toContain("DIFF_TRANSFORMATION_NOT_SUPPORTED");
  });

  it("refuses A1 implicature, forbidden format, bad item counts and orphan fact refs", async () => {
    const family = await familyFor("A1", [baseFact()], 3, (draft) => {
      draft.variants.A1!.exercise.items[0].instruction = "Que faut-il comprendre en implicite ?";
      draft.variants.A1!.exercise.items[1].type = "ordre_chronologique" as any;
      draft.variants.A1!.exercise.items[2].fact_refs = ["fact_missing"];
    });
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    const codes = report.blocking.map((issue) => issue.code);
    expect(codes).toContain("DIFF_A1_IMPLICATURE_FORBIDDEN");
    expect(codes).toContain("DIFF_FORMAT_FORBIDDEN");
    expect(codes).toContain("DIFF_ITEM_FACT_REF_ORPHAN");
  });

  it("refuses B2 implicature questions without enough facts and non-CO competence", async () => {
    const family = await familyFor("B2", richFacts(), 5, (draft) => {
      draft.competence = "CE" as any;
      draft.variants.B2!.exercise.items[0].instruction = "Quelle implicature se dégage ?";
      draft.variants.B2!.exercise.items[0].fact_refs = ["fact_01"];
    });
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    const codes = report.blocking.map((issue) => issue.code);
    expect(codes).toContain("DIFF_COMPETENCE_MISMATCH");
    expect(codes).toContain("DIFF_B2_SUPPORT_INSUFFICIENT");
  });

  it("keeps Gemini unverified timestamps as conditional warning when readiness is met", async () => {
    const family = await familyFor("A2", [baseFact(), baseFact({ fact_id: "fact_02" })]);
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
      timestampsVerified: false,
      transcriptionReviewed: true,
      sourceAnalyzed: true,
      sourceReviewApproved: true,
      sourceHashPresent: true,
      sourceHashCoherent: true,
      originalMp3Available: true,
      factualProvenancePresent: true,
    });
    expect(report.warnings.map((issue) => issue.code)).toContain("DIFF_TRANSCRIPTION_TIMESTAMPS_UNVERIFIED");
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_TRANSCRIPTION_TIMESTAMPS_UNVERIFIED");
  });

  it("refuses out-of-range item counts per level", async () => {
    const family = await familyFor("A2", [baseFact()], 2);
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(report.blocking.map((issue) => issue.code)).toContain("DIFF_ITEM_COUNT_OUT_OF_RANGE");
  });
});
