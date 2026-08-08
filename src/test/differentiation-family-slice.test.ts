import { describe, expect, it } from "vitest";
import {
  calculateFactsHash,
  getCoA2LevelContract,
  validateDifferentiationFamilySlice,
  type DifferentiationFact,
  type DifferentiationFamilySliceV1,
} from "../../supabase/functions/_shared/differentiation/index.ts";

const baseFact: DifferentiationFact = {
  fact_id: "fact_01",
  subject: "le train",
  predicate: "partir",
  object: "17h00",
  semantic_qualifiers: {
    modality: "certain",
    negation: false,
    speaker: "agent",
  },
  provenance: {
    source_id: "source-1",
    transcription_id: "transcription-1",
    segment_refs: ["segment-1"],
    chunk_refs: ["chunk-1"],
    quote: "Le train part à dix-sept heures.",
    confidence: 0.96,
  },
  required_for_task: true,
};

async function validFamily(): Promise<DifferentiationFamilySliceV1> {
  const facts = [structuredClone(baseFact)];
  const factsHash = await calculateFactsHash(facts);
  const { contract } = getCoA2LevelContract();
  const items = Array.from({ length: 4 }, (_, index) => ({
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
    ],
    fact_refs: ["fact_01"],
    justification: "L'heure est explicitement annoncée.",
  }));

  return {
    schema_version: "slice-1.0",
    family_id: "CO_A2_TRAIN_001",
    version: 1,
    status: "draft",
    competence: "CO",
    subcompetence: "identifier une information horaire",
    objective: "Comprendre une information pratique explicite.",
    core_task: "Identifier l'heure de départ annoncée.",
    source_level: "A2",
    generated_levels: ["A2"],
    source_document: {
      source_document_id: "source-1",
      uri: "pedagogical-sources/user/source.mp3",
      content_hash: `sha256:${"a".repeat(64)}`,
      immutable: true,
      provenance: { type: "authored", version: 1 },
    },
    facts: { required: facts, facts_hash: factsHash },
    level_contracts: { A2: contract },
    variants: {
      A2: {
        target_level: "A2",
        competence: "CO",
        transformation_id: "IDENTITY",
        support_mode: "source",
        support_ref: "source-1",
        applied_transformations: [],
        exercise: {
          title: "Comprendre une annonce de train",
          instruction: "Écoutez puis choisissez la bonne réponse.",
          format: "qcm",
          steps: ["Écouter", "Répondre"],
          items,
          expected_output: "Une réponse par question.",
        },
        scaffolding: {},
        success_criteria: ["Au moins 65 % de réponses correctes."],
      },
    },
    validation_report: {
      status: "not_run",
      blocking: [],
      warnings: [],
      requires_human_review: [],
    },
  };
}

describe("differentiation family A2 slice", () => {
  it("loads only the versioned A2 CO contract", () => {
    const resolved = getCoA2LevelContract();
    expect(resolved.version).toBe("1.0");
    expect(resolved.status).toBe("draft_pending_pedagogical_approval");
    expect(resolved.contract.target_level).toBe("A2");
    expect(resolved.contract.allowed_formats).toContain("qcm");
    expect(resolved.contract.forbidden_formats).not.toContain("qcm");
  });

  it("keeps the facts hash stable when provenance changes", async () => {
    const first = await calculateFactsHash([baseFact]);
    const moved = structuredClone(baseFact);
    moved.provenance.segment_refs = ["segment-99"];
    moved.provenance.quote = "Même information, autre repère.";
    expect(await calculateFactsHash([moved])).toBe(first);
  });

  it("changes the facts hash when semantic qualifiers change", async () => {
    const first = await calculateFactsHash([baseFact]);
    const negated = structuredClone(baseFact);
    negated.semantic_qualifiers.negation = true;
    expect(await calculateFactsHash([negated])).not.toBe(first);
  });

  it("accepts a logically valid A2 slice while keeping human review explicit", async () => {
    const family = await validFamily();
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(report.status).toBe("warning");
    expect(report.blocking).toEqual([]);
    expect(report.warnings.map((entry) => entry.code)).toContain("DIFF_FACT_USED_REPEATEDLY");
    expect(report.requires_human_review).toContain("distractor_ambiguity");
  });

  it("rejects orphan references, divergent source and multiple correct answers", async () => {
    const family = await validFamily();
    family.variants.A2.exercise.items[0].fact_refs = ["fact_missing"];
    family.variants.A2.exercise.items[1].choices![0].is_correct = true;

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: `sha256:${"b".repeat(64)}`,
      segmentIds: [],
      chunkIds: [],
      chunkSegmentPairs: [],
    });
    const codes = report.blocking.map((entry) => entry.code);
    expect(report.status).toBe("fail");
    expect(codes).toContain("DIFF_SOURCE_DIVERGED");
    expect(codes).toContain("DIFF_SEGMENT_REF_ORPHAN");
    expect(codes).toContain("DIFF_CHUNK_REF_ORPHAN");
    expect(codes).toContain("DIFF_ITEM_FACT_REF_ORPHAN");
    expect(codes).toContain("DIFF_MULTIPLE_CORRECT_ANSWERS");
  });

  it("rejects forbidden formats and missing correct answers", async () => {
    const family = await validFamily();
    family.variants.A2.exercise.format = "production_libre" as typeof family.variants.A2.exercise.format;
    family.variants.A2.exercise.items[0].choices!.forEach((choice) => {
      choice.is_correct = false;
    });

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });

    const codes = report.blocking.map((entry) => entry.code);
    expect(report.status).toBe("fail");
    expect(codes).toContain("DIFF_FORMAT_FORBIDDEN");
    expect(codes).toContain("DIFF_NO_CORRECT_ANSWER");
  });

  it("accepts a single chunk linked to a single segment", async () => {
    const family = await validFamily();
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });

    expect(report.blocking.map((entry) => entry.code)).not.toContain("DIFF_FACT_PROVENANCE_MISMATCH");
  });

  it("accepts two chunks each linked to a different segment without requiring the cartesian product", async () => {
    const family = await validFamily();
    family.facts.required[0].provenance.chunk_refs = ["chunk-1", "chunk-2"];
    family.facts.required[0].provenance.segment_refs = ["segment-1", "segment-2"];
    family.facts.facts_hash = await calculateFactsHash(family.facts.required);

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1", "segment-2"],
      chunkIds: ["chunk-1", "chunk-2"],
      chunkSegmentPairs: ["chunk-1:segment-1", "chunk-2:segment-2"],
    });

    expect(report.blocking.map((entry) => entry.code)).not.toContain("DIFF_FACT_PROVENANCE_MISMATCH");
  });

  it("rejects facts whose chunk/segment provenance link does not exist", async () => {
    const family = await validFamily();
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-999"],
    });

    expect(report.status).toBe("fail");
    expect(report.blocking.map((entry) => entry.code)).toContain("DIFF_FACT_PROVENANCE_MISMATCH");
  });

  it("rejects a chunk or segment that has no valid link among the referenced pairs", async () => {
    const family = await validFamily();
    family.facts.required[0].provenance.chunk_refs = ["chunk-1", "chunk-orphan"];
    family.facts.required[0].provenance.segment_refs = ["segment-1"];
    family.facts.facts_hash = await calculateFactsHash(family.facts.required);

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1", "chunk-orphan"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });

    expect(report.status).toBe("fail");
    expect(report.blocking.map((entry) => entry.code)).toContain("DIFF_FACT_PROVENANCE_MISMATCH");
  });
});
