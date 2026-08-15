import { describe, expect, it } from "vitest";
import {
  CURRENT_CO_REFERENTIAL_VERSION,
  LEGACY_CO_A2_REFERENTIAL_VERSION,
  SLICE_SCHEMA_VERSION,
  calculateFactsHash,
  getCoA2LevelContract,
  getCoLevelContract,
  validateDifferentiationFamilySlice,
  type DifferentiationFact,
  type DifferentiationFamilySliceV1,
  type SliceLevel,
} from "../../supabase/functions/_shared/differentiation/index.ts";

function baseFact(id = "fact_01"): DifferentiationFact {
  return {
    fact_id: id,
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
  };
}

async function familyFor(
  level: SliceLevel,
  facts: DifferentiationFact[],
  options: { referentialVersion?: string; itemCount?: number } = {},
): Promise<DifferentiationFamilySliceV1> {
  const { contract } = getCoLevelContract(level);
  const count = options.itemCount ?? contract.volume_items_min;
  const factsHash = await calculateFactsHash(facts);
  return {
    schema_version: SLICE_SCHEMA_VERSION,
    family_id: `${level}CO_VER_001`,
    version: 1,
    status: "draft",
    competence: "CO",
    subcompetence: "comprehension_orale",
    objective: contract.objectives?.[0] ?? `Objectif ${level}`,
    core_task: "Répondre après écoute.",
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
          title: `Activité ${level}`,
          instruction: "Écoutez puis répondez.",
          format: "qcm",
          steps: ["Écouter", "Répondre"],
          items: Array.from({ length: count }, (_, index) => ({
            id: `item_${index + 1}`,
            type: "qcm" as const,
            instruction: "Quelle information est entendue ?",
            choices: [
              { id: "a", text: "17h00", is_correct: true },
              { id: "b", text: "16h00", is_correct: false, distractor_category: "confusion_temporelle" },
              ...(level === "A1" ? [] : [{ id: "c", text: "18h00", is_correct: false, distractor_category: "confusion_temporelle" }]),
            ],
            fact_refs: level === "A1" || level === "A2" ? ["fact_01"] : ["fact_01", "fact_02"],
            justification: "Information explicite du support.",
          })),
          expected_output: "Réponses",
        },
        scaffolding: {},
        success_criteria: [`Réussir ${level}.`],
      },
    },
    generation: {
      target_level: level,
      referential_version: options.referentialVersion ?? CURRENT_CO_REFERENTIAL_VERSION,
    },
    validation_report: { status: "not_run", blocking: [], warnings: [], requires_human_review: [] },
  };
}

describe("referential versioning multi-level", () => {
  it("keeps schema_version slice-1.0 and bumps referential to 1.1", () => {
    expect(SLICE_SCHEMA_VERSION).toBe("slice-1.0");
    expect(CURRENT_CO_REFERENTIAL_VERSION).toBe("1.1");
    expect(LEGACY_CO_A2_REFERENTIAL_VERSION).toBe("1.0");
    expect(getCoLevelContract("A2").version).toBe("1.1");
  });

  it("keeps old A2 family interpretable without rewrite", async () => {
    const legacyContract = structuredClone(getCoA2LevelContract().contract);
    // Simule un contrat A2 1.0 embarqué (sans champs 1.1 optionnels).
    delete (legacyContract as any).qcm_max_choices;
    delete (legacyContract as any).objectives;
    const facts = [baseFact()];
    const family = await familyFor("A2", facts, { referentialVersion: LEGACY_CO_A2_REFERENTIAL_VERSION });
    family.level_contracts.A2 = legacyContract;
    family.generation = {
      target_level: "A2",
      referential_version: LEGACY_CO_A2_REFERENTIAL_VERSION,
      prompt_version: "a2-audio-v1",
    };

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_SLICE_SCHEMA_INVALID");
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_LEVEL_MISMATCH");
    expect(family.schema_version).toBe("slice-1.0");
    expect(family.generation?.referential_version).toBe("1.0");
  });

  it.each(["A1", "B1", "B2"] as const)("accepts new %s family with referential 1.1 recorded", async (level) => {
    const facts = level === "B2"
      ? [
        baseFact("fact_01"),
        { ...baseFact("fact_02"), semantic_qualifiers: { fact_kind: "viewpoint", speaker: "a", viewpoint: "a" } },
        { ...baseFact("fact_03"), semantic_qualifiers: { fact_kind: "viewpoint", speaker: "b", viewpoint: "b" } },
        { ...baseFact("fact_04"), semantic_qualifiers: { fact_kind: "argument", justified: true } },
        { ...baseFact("fact_05"), semantic_qualifiers: { fact_kind: "hypothesis", epistemic: "hypothesis" } },
      ]
      : level === "B1"
        ? [
          { ...baseFact("fact_01"), semantic_qualifiers: { fact_kind: "main_idea" } },
          { ...baseFact("fact_02"), semantic_qualifiers: { fact_kind: "chronology" } },
          { ...baseFact("fact_03"), semantic_qualifiers: { fact_kind: "opinion" } },
        ]
        : [baseFact()];
    const family = await familyFor(level, facts);
    expect(family.generation?.referential_version).toBe("1.1");
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_LEVEL_TRIPLET_MISMATCH");
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_TRANSFORMATION_NOT_SUPPORTED");
  });
});
