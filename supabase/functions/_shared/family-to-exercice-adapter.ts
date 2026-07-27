import type { DifferentiationFamilySliceV1 } from "./differentiation/types.ts";

export function familyVariantToExerciceRow(
  family: DifferentiationFamilySliceV1,
  formateurId: string,
  audioScript: string,
) {
  const variant = family.variants.A2;
  return {
    formateur_id: formateurId,
    titre: variant.exercise.title,
    consigne: variant.exercise.instruction,
    competence: "CO",
    format: variant.exercise.format === "mixed" ? "qcm" : variant.exercise.format,
    difficulte: 2,
    niveau_vise: "A2",
    is_ai_generated: true,
    contenu: {
      items: variant.exercise.items,
      script_audio: audioScript,
      metadata: {
        differentiation_family_id: family.family_id,
        schema_version: family.schema_version,
        source_document_id: family.source_document.source_document_id,
        source_content_hash: family.source_document.content_hash,
        facts_hash: family.facts.facts_hash,
        traceability: {
          facts: family.facts.required.map((fact) => ({
            fact_id: fact.fact_id,
            segment_refs: fact.provenance.segment_refs,
            chunk_refs: fact.provenance.chunk_refs,
          })),
        },
      },
    },
  };
}
