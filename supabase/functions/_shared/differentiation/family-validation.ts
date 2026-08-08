import { calculateFactsHash } from "./fact-hashing.ts";
import type {
  DifferentiationFamilySliceV1,
  HumanReviewDimension,
  SliceValidationReport,
  ValidationContext,
  ValidationIssue,
} from "./types.ts";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/i;
const HUMAN_REVIEW: HumanReviewDimension[] = [
  "distractor_ambiguity",
  "instruction_cefr_fit",
  "overall_difficulty",
  "pedagogical_relevance",
  "justification_quality",
  "fact_selection",
];

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

export async function validateDifferentiationFamilySlice(
  family: DifferentiationFamilySliceV1,
  context: ValidationContext,
): Promise<SliceValidationReport> {
  const blocking: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const segmentIds = new Set(context.segmentIds);
  const chunkIds = new Set(context.chunkIds);
  const chunkSegmentPairs = new Set(context.chunkSegmentPairs ?? []);

  if (context.timestampsVerified === false) {
    blocking.push(issue("DIFF_TRANSCRIPTION_TIMESTAMPS_UNVERIFIED", "facts.required[].provenance", "Les rep\u00e8res temporels d\u00e9passent ou ne couvrent pas correctement la dur\u00e9e r\u00e9elle de l'audio."));
  }
  if (family.schema_version !== "slice-1.0") {
    blocking.push(issue("DIFF_SLICE_SCHEMA_INVALID", "schema_version", "Le contrat attendu est slice-1.0."));
  }
  if (family.competence !== "CO") {
    blocking.push(issue("DIFF_COMPETENCE_MISMATCH", "competence", "Le Vertical Slice ne supporte que CO."));
  }
  if (family.source_level !== "A2" || family.variants.A2?.target_level !== "A2") {
    blocking.push(issue("DIFF_LEVEL_MISMATCH", "variants.A2.target_level", "Le niveau attendu est A2."));
  }
  if (!HASH_PATTERN.test(family.source_document.content_hash)) {
    blocking.push(issue("DIFF_SOURCE_HASH_MISSING", "source_document.content_hash", "Le hash source est absent ou invalide."));
  } else if (family.source_document.content_hash !== context.sourceContentHash) {
    blocking.push(issue("DIFF_SOURCE_DIVERGED", "source_document.content_hash", "La source a changé depuis la génération."));
  }

  const facts = family.facts.required ?? [];
  if (facts.length === 0) {
    blocking.push(issue("DIFF_FACTS_MISSING", "facts.required", "Aucun fait vérifiable n'est disponible."));
  }
  const factIds = new Set<string>();
  for (const [index, fact] of facts.entries()) {
    const path = `facts.required[${index}]`;
    if (factIds.has(fact.fact_id)) {
      blocking.push(issue("DIFF_FACT_ID_DUPLICATE", `${path}.fact_id`, "L'identifiant de fait n'est pas unique."));
    }
    factIds.add(fact.fact_id);
    if (!fact.provenance?.segment_refs?.length || !fact.provenance?.chunk_refs?.length) {
      blocking.push(issue("DIFF_FACT_PROVENANCE_MISSING", `${path}.provenance`, "Le fait requis n'a pas de provenance complète."));
      continue;
    }
    for (const segmentId of fact.provenance.segment_refs) {
      if (!segmentIds.has(segmentId)) {
        blocking.push(issue("DIFF_SEGMENT_REF_ORPHAN", `${path}.provenance.segment_refs`, `Segment inconnu : ${segmentId}.`));
      }
    }
    for (const chunkId of fact.provenance.chunk_refs) {
      if (!chunkIds.has(chunkId)) {
        blocking.push(issue("DIFF_CHUNK_REF_ORPHAN", `${path}.provenance.chunk_refs`, `Chunk inconnu : ${chunkId}.`));
      }
    }
    if (chunkSegmentPairs.size > 0) {
      const linkedChunks = new Set<string>();
      const linkedSegments = new Set<string>();
      for (const chunkId of fact.provenance.chunk_refs) {
        for (const segmentId of fact.provenance.segment_refs) {
          if (chunkSegmentPairs.has(`${chunkId}:${segmentId}`)) {
            linkedChunks.add(chunkId);
            linkedSegments.add(segmentId);
          }
        }
      }
      const hasUnlinkedChunk = fact.provenance.chunk_refs.some((chunkId) => !linkedChunks.has(chunkId));
      const hasUnlinkedSegment = fact.provenance.segment_refs.some((segmentId) => !linkedSegments.has(segmentId));
      if (hasUnlinkedChunk || hasUnlinkedSegment) {
        blocking.push(issue(
          "DIFF_FACT_PROVENANCE_MISMATCH",
          `${path}.provenance`,
          "Chaque chunk_ref et chaque segment_ref doit avoir au moins une liaison valide; le produit cartésien n'est pas exigé.",
        ));
      }
    }
  }

  if (facts.length > 0) {
    const expectedHash = await calculateFactsHash(facts);
    if (family.facts.facts_hash !== expectedHash) {
      blocking.push(issue("DIFF_FACT_HASH_INVALID", "facts.facts_hash", "Le hash ne correspond pas à la sémantique des faits."));
    }
  }

  const contract = family.level_contracts.A2;
  const variant = family.variants.A2;
  if (!contract.allowed_formats.includes(variant.exercise.format) && variant.exercise.format !== "mixed") {
    blocking.push(issue("DIFF_FORMAT_FORBIDDEN", "variants.A2.exercise.format", "Le format n'est pas autorisé par le contrat A2."));
  }
  if (
    variant.exercise.items.length < contract.volume_items_min ||
    variant.exercise.items.length > contract.volume_items_max
  ) {
    blocking.push(issue("DIFF_ITEM_COUNT_OUT_OF_RANGE", "variants.A2.exercise.items", "Le nombre d'items est hors des bornes A2."));
  }

  const factUsage = new Map<string, number>();
  for (const [index, item] of variant.exercise.items.entries()) {
    const path = `variants.A2.exercise.items[${index}]`;
    if (!item.fact_refs?.length) {
      blocking.push(issue("DIFF_ITEM_FACT_REF_MISSING", `${path}.fact_refs`, "La question ne référence aucun fait."));
    }
    for (const factId of item.fact_refs ?? []) {
      if (!factIds.has(factId)) {
        blocking.push(issue("DIFF_ITEM_FACT_REF_ORPHAN", `${path}.fact_refs`, `Fait inconnu : ${factId}.`));
      } else {
        factUsage.set(factId, (factUsage.get(factId) ?? 0) + 1);
      }
    }
    if (!item.justification?.trim()) {
      warnings.push(issue("DIFF_JUSTIFICATION_MISSING", `${path}.justification`, "La justification est absente."));
    }
    if (item.type === "qcm" || item.type === "vrai_faux") {
      const correctAnswers = (item.choices ?? []).filter((choice) => choice.is_correct).length;
      if (correctAnswers === 0) {
        blocking.push(issue("DIFF_NO_CORRECT_ANSWER", `${path}.choices`, "Aucune réponse correcte n'est déclarée."));
      } else if (correctAnswers > 1) {
        blocking.push(issue("DIFF_MULTIPLE_CORRECT_ANSWERS", `${path}.choices`, "Plusieurs réponses correctes sont déclarées."));
      }
      for (const [choiceIndex, choice] of (item.choices ?? []).entries()) {
        if (!choice.is_correct && !choice.distractor_category) {
          warnings.push(issue(
            "DIFF_DISTRACTOR_CATEGORY_MISSING",
            `${path}.choices[${choiceIndex}]`,
            "La catégorie du distracteur est absente.",
          ));
        }
      }
    }
  }

  for (const [factId, count] of factUsage.entries()) {
    if (count > 2) {
      warnings.push(issue("DIFF_FACT_USED_REPEATEDLY", "variants.A2.exercise.items", `Le fait ${factId} est utilisé ${count} fois.`));
    }
  }
  for (const fact of facts) {
    if (fact.required_for_task && !factUsage.has(fact.fact_id)) {
      warnings.push(issue("DIFF_UNUSED_REQUIRED_FACT", "facts.required", `Le fait requis ${fact.fact_id} n'est utilisé par aucun item.`));
    }
  }

  return {
    status: blocking.length > 0 ? "fail" : warnings.length > 0 ? "warning" : "pass",
    blocking,
    warnings,
    requires_human_review: HUMAN_REVIEW,
  };
}
