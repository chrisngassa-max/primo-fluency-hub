import { describe, expect, it } from "vitest";
import {
  CURRENT_CO_REFERENTIAL_VERSION,
  calculateFactsHash,
  getCoLevelContract,
  validateDifferentiationFamilySlice,
  type DifferentiationFamilySliceV1,
} from "../../supabase/functions/_shared/differentiation/index.ts";
import { getDifferentiationTransformationRule } from "../../supabase/functions/_shared/referential-loader.ts";
import { familyVariantToExerciceRow } from "../../supabase/functions/_shared/family-to-exercice-adapter.ts";

/**
 * Non-régression du contrat historique frontend/backend A2 :
 * body = { sourceId, force_regenerate? } sans target_level => A2.
 */
describe("A2 historical compatibility", () => {
  it("defaults absent target_level to A2 and uses IDENTITY", () => {
    const absentTargetLevel = undefined as string | undefined;
    const resolved = (absentTargetLevel ?? "A2").toUpperCase();
    expect(resolved).toBe("A2");
    expect(getDifferentiationTransformationRule("A2", "A2")?.id).toBe("IDENTITY");
    expect(getDifferentiationTransformationRule("A2", "A1")?.id).toBe("A2_TO_A1");
    expect(getDifferentiationTransformationRule("A2", "B1")?.id).toBe("A2_TO_B1");
    expect(getDifferentiationTransformationRule("A2", "B2")?.id).toBe("A2_TO_B2");
  });

  it("keeps generated_levels / contracts / variants on the same single key", async () => {
    const { contract } = getCoLevelContract("A2");
    const facts = [{
      fact_id: "fact_01",
      subject: "annonce",
      predicate: "dit",
      object: "17h",
      semantic_qualifiers: {},
      provenance: {
        source_id: "source-1",
        transcription_id: "tr-1",
        segment_refs: ["segment-1"],
        chunk_refs: ["chunk-1"],
        quote: "Le train part à 17h.",
      },
      required_for_task: true,
    }];
    const family: DifferentiationFamilySliceV1 = {
      schema_version: "slice-1.0",
      family_id: "A2CO_COMPAT01",
      version: 1,
      status: "draft",
      competence: "CO",
      subcompetence: "comprehension_orale",
      objective: "Comprendre une info explicite.",
      core_task: "Répondre après écoute.",
      source_level: "A2",
      generated_levels: ["A2"],
      source_document: {
        source_document_id: "source-1",
        uri: "bucket/path.mp3",
        content_hash: `sha256:${"a".repeat(64)}`,
        immutable: true,
        provenance: { type: "authored", version: 1 },
      },
      facts: { required: facts, facts_hash: await calculateFactsHash(facts) },
      level_contracts: { A2: contract },
      variants: {
        A2: {
          target_level: "A2",
          competence: "CO",
          transformation_id: "IDENTITY",
          support_mode: "source",
          support_ref: "tr-1",
          applied_transformations: [],
          exercise: {
            title: "Annonce",
            instruction: "Écoutez.",
            format: "qcm",
            steps: ["Écouter", "Répondre"],
            items: Array.from({ length: 4 }, (_, index) => ({
              id: `item_${index + 1}`,
              type: "qcm" as const,
              instruction: "À quelle heure ?",
              choices: [
                { id: "a", text: "17h", is_correct: true },
                { id: "b", text: "16h", is_correct: false, distractor_category: "confusion_temporelle" },
              ],
              fact_refs: ["fact_01"],
              justification: "Explicite.",
            })),
            expected_output: "Réponses",
          },
          scaffolding: {},
          success_criteria: ["Réussir"],
        },
      },
      generation: {
        target_level: "A2",
        referential_version: CURRENT_CO_REFERENTIAL_VERSION,
      },
      validation_report: { status: "not_run", blocking: [], warnings: [], requires_human_review: [] },
    };

    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(report.blocking.map((issue) => issue.code)).not.toContain("DIFF_LEVEL_TRIPLET_MISMATCH");

    const diverged = structuredClone(family);
    diverged.variants = {
      B1: {
        ...family.variants.A2!,
        target_level: "B1",
        transformation_id: "A2_TO_B1",
      },
    } as any;
    diverged.generated_levels = ["A2"];
    const bad = await validateDifferentiationFamilySlice(diverged, {
      sourceContentHash: family.source_document.content_hash,
      segmentIds: ["segment-1"],
      chunkIds: ["chunk-1"],
      chunkSegmentPairs: ["chunk-1:segment-1"],
    });
    expect(bad.blocking.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DIFF_LEVEL_MISMATCH", "DIFF_LEVEL_TRIPLET_MISMATCH"]),
    );

    const row = familyVariantToExerciceRow(family, "trainer", "script", "point", {
      source_id: "source-1",
      source_content_hash: family.source_document.content_hash,
      mime_type: "audio/mpeg",
    }, CURRENT_CO_REFERENTIAL_VERSION);
    expect(row.niveau_vise).toBe("A2");
    expect(row.contenu.metadata).toMatchObject({
      family_id: "A2CO_COMPAT01",
      source_id: "source-1",
      source_content_hash: family.source_document.content_hash,
      facts_hash: family.facts.facts_hash,
      target_level: "A2",
      referential_version: CURRENT_CO_REFERENTIAL_VERSION,
    });
    expect(row.contenu.audio).toEqual({
      source_id: "source-1",
      source_content_hash: family.source_document.content_hash,
      mime_type: "audio/mpeg",
    });
  });
});
