import type { DifferentiationFamilySliceV1 } from "./differentiation/types.ts";

/**
 * Référence STABLE à la source audio originale, embarquée dans
 * `exercices.contenu.audio`. Ne contient JAMAIS de bucket/chemin Storage :
 * le résolveur (`resolve-exercise-audio`) relit `pedagogical_sources` côté
 * serveur à partir de `source_id` pour récupérer ces coordonnées au moment
 * de signer l'URL. `source_content_hash` sert de référence de cohérence
 * (triple comparaison dans le résolveur : contenu.audio = family = source).
 */
export interface ExerciseAudioRef {
  source_id: string;
  source_content_hash: string;
  mime_type: string | null;
}

export function familyVariantToExerciceRow(
  family: DifferentiationFamilySliceV1,
  formateurId: string,
  audioScript: string,
  pointAMaitriserId: string,
  audioRef: ExerciseAudioRef | null = null,
) {
  const variant = family.variants.A2;
  return {
    formateur_id: formateurId,
    point_a_maitriser_id: pointAMaitriserId,
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
      ...(audioRef ? { audio: audioRef } : {}),
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
