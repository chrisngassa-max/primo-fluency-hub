import { calculateFactsHash } from "./fact-hashing.ts";
import { getCoLevelContract, isKnownCoLevel } from "./co-level-contract-loader.ts";
import { evaluateSupportCompatibility } from "./support-compatibility.ts";
import type {
  DifferentiationFamilySliceV1,
  HumanReviewDimension,
  SliceLevel,
  SliceValidationReport,
  ValidationContext,
  ValidationIssue,
} from "./types.ts";
import { getSliceContract, getSliceTargetLevel, getSliceVariant, SLICE_LEVELS } from "./types.ts";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/i;
const HUMAN_REVIEW: HumanReviewDimension[] = [
  "distractor_ambiguity",
  "instruction_cefr_fit",
  "overall_difficulty",
  "pedagogical_relevance",
  "justification_quality",
  "fact_selection",
];

const IMPLICATURE_TOKENS = [
  "implicite",
  "implicature",
  "sous-entendu",
  "sous entendu",
  "deviner",
  "supposer",
  "entre les lignes",
];

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function instructionLooksLikeImplicature(text: string): boolean {
  const normalized = text.toLowerCase();
  return IMPLICATURE_TOKENS.some((token) => normalized.includes(token));
}

function transformationFor(level: SliceLevel): string {
  if (level === "A2") return "IDENTITY";
  return `A2_TO_${level}`;
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
    const unverifiedIssue = issue(
      "DIFF_TRANSCRIPTION_TIMESTAMPS_UNVERIFIED",
      "facts.required[].provenance",
      "Repères temporels approximatifs : la navigation vers un extrait exact n'est pas fiable ; écoutez l'audio original complet.",
    );
    const allowAsWarning = context.transcriptionReviewed === true
      && context.sourceAnalyzed === true
      && context.sourceReviewApproved === true
      && context.sourceHashPresent === true
      && context.sourceHashCoherent === true
      && context.originalMp3Available === true
      && context.factualProvenancePresent === true;
    if (allowAsWarning) warnings.push(unverifiedIssue);
    else blocking.push(unverifiedIssue);
  }

  if (family.schema_version !== "slice-1.0") {
    blocking.push(issue("DIFF_SLICE_SCHEMA_INVALID", "schema_version", "Le contrat attendu est slice-1.0."));
  }
  if (family.competence !== "CO") {
    blocking.push(issue("DIFF_COMPETENCE_MISMATCH", "competence", "Le Vertical Slice ne supporte que CO."));
  }
  if (family.source_level !== "A2") {
    blocking.push(issue("DIFF_SOURCE_LEVEL_MISMATCH", "source_level", "Le pivot source attendu est A2."));
  }

  const targetLevel = getSliceTargetLevel(family);
  if (!isKnownCoLevel(targetLevel)) {
    blocking.push(issue("DIFF_LEVEL_UNSUPPORTED", "generated_levels", `Niveau non supporté : ${targetLevel}.`));
    return { status: "fail", blocking, warnings, requires_human_review: HUMAN_REVIEW };
  }
  if (!family.generated_levels || family.generated_levels.length !== 1 || family.generated_levels[0] !== targetLevel) {
    blocking.push(issue("DIFF_GENERATED_LEVELS_INVALID", "generated_levels", "Une famille slice doit contenir exactement un niveau cible."));
  }

  const variantKeys = SLICE_LEVELS.filter((level) => Boolean(family.variants?.[level]));
  const contractKeys = SLICE_LEVELS.filter((level) => Boolean(family.level_contracts?.[level]));
  const tripletAligned = variantKeys.length === 1
    && contractKeys.length === 1
    && family.generated_levels?.length === 1
    && variantKeys[0] === targetLevel
    && contractKeys[0] === targetLevel
    && family.generated_levels[0] === targetLevel;
  if (!tripletAligned) {
    blocking.push(issue(
      "DIFF_LEVEL_TRIPLET_MISMATCH",
      "generated_levels|level_contracts|variants",
      "generated_levels, level_contracts et variants doivent partager exactement la même clé de niveau.",
    ));
  }
  if (variantKeys.length !== 1 || variantKeys[0] !== targetLevel) {
    blocking.push(issue("DIFF_LEVEL_MISMATCH", `variants.${targetLevel}`, `La variante attendue est ${targetLevel}.`));
  }
  if (contractKeys.length !== 1 || contractKeys[0] !== targetLevel) {
    blocking.push(issue("DIFF_LEVEL_CONTRACT_MISSING", `level_contracts.${targetLevel}`, `Le contrat attendu est ${targetLevel}.`));
  }

  let contract;
  let variant;
  try {
    contract = getSliceContract(family);
    variant = getSliceVariant(family);
  } catch {
    blocking.push(issue("DIFF_LEVEL_MISMATCH", "variants", "Variante ou contrat manquant pour le niveau cible."));
    return { status: "fail", blocking, warnings, requires_human_review: HUMAN_REVIEW };
  }

  if (variant.target_level !== targetLevel) {
    blocking.push(issue("DIFF_LEVEL_MISMATCH", `variants.${targetLevel}.target_level`, `Le niveau attendu est ${targetLevel}.`));
  }
  if (contract.target_level !== targetLevel) {
    blocking.push(issue("DIFF_LEVEL_CONTRACT_MISMATCH", `level_contracts.${targetLevel}.target_level`, `Le contrat ne correspond pas à ${targetLevel}.`));
  }

  // Comparaison soft au référentiel courant : les familles legacy 1.0 restent interprétables.
  const expectedContract = getCoLevelContract(targetLevel).contract;
  if (JSON.stringify(contract.allowed_formats) !== JSON.stringify(expectedContract.allowed_formats)) {
    warnings.push(issue("DIFF_LEVEL_CONTRACT_MISMATCH", `level_contracts.${targetLevel}`, "Le contrat embarqué diffère du référentiel courant."));
  }

  const expectedTransformation = transformationFor(targetLevel);
  if (variant.transformation_id !== expectedTransformation) {
    blocking.push(issue(
      "DIFF_TRANSFORMATION_UNDECLARED",
      `variants.${targetLevel}.transformation_id`,
      `Transformation attendue : ${expectedTransformation}.`,
    ));
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

  const compatibility = evaluateSupportCompatibility(targetLevel, facts);
  if (!compatibility.supported) {
    blocking.push(issue(
      "DIFF_TRANSFORMATION_NOT_SUPPORTED",
      "generation.support_compatibility",
      compatibility.message,
    ));
  }

  if (!contract.allowed_formats.includes(variant.exercise.format) && variant.exercise.format !== "mixed") {
    blocking.push(issue("DIFF_FORMAT_FORBIDDEN", `variants.${targetLevel}.exercise.format`, `Le format n'est pas autorisé par le contrat ${targetLevel}.`));
  }
  if (
    variant.exercise.items.length < contract.volume_items_min ||
    variant.exercise.items.length > contract.volume_items_max
  ) {
    blocking.push(issue("DIFF_ITEM_COUNT_OUT_OF_RANGE", `variants.${targetLevel}.exercise.items`, `Le nombre d'items est hors des bornes ${targetLevel}.`));
  }

  const factUsage = new Map<string, number>();
  for (const [index, item] of variant.exercise.items.entries()) {
    const path = `variants.${targetLevel}.exercise.items[${index}]`;
    if (!contract.allowed_formats.includes(item.type)) {
      blocking.push(issue("DIFF_FORMAT_FORBIDDEN", `${path}.type`, `Le format d'item n'est pas autorisé en ${targetLevel}.`));
    }
    if (contract.forbidden_formats.includes(item.type)) {
      blocking.push(issue("DIFF_FORMAT_FORBIDDEN", `${path}.type`, `Le format d'item est interdit en ${targetLevel}.`));
    }
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

    if (targetLevel === "A1" && instructionLooksLikeImplicature(item.instruction)) {
      blocking.push(issue("DIFF_A1_IMPLICATURE_FORBIDDEN", `${path}.instruction`, "L'implicature est interdite en A1."));
    }
    if (targetLevel === "A1" && (item.fact_refs?.length ?? 0) > 1) {
      warnings.push(issue("DIFF_A1_MULTI_FACT", `${path}.fact_refs`, "A1 privilégie une information explicite unique par question."));
    }
    if (targetLevel === "B1" && instructionLooksLikeImplicature(item.instruction) && (item.fact_refs?.length ?? 0) < 2) {
      blocking.push(issue(
        "DIFF_B1_INFERENCE_UNSUPPORTED",
        `${path}.fact_refs`,
        "Une inférence B1 doit s'appuyer sur plusieurs faits vérifiables.",
      ));
    }
    if (targetLevel === "B2" && (item.fact_refs?.length ?? 0) < 2 && instructionLooksLikeImplicature(item.instruction)) {
      blocking.push(issue(
        "DIFF_B2_SUPPORT_INSUFFICIENT",
        `${path}.fact_refs`,
        "Une question B2 d'implicature doit s'appuyer sur plusieurs faits.",
      ));
    }
    if (targetLevel === "B2" && (item.fact_refs?.length ?? 0) < 1) {
      blocking.push(issue("DIFF_ITEM_FACT_REF_MISSING", `${path}.fact_refs`, "Une question B2 doit référencer des faits."));
    }

    if (item.type === "qcm" || item.type === "vrai_faux") {
      const choices = item.choices ?? [];
      const correctAnswers = choices.filter((choice) => choice.is_correct).length;
      if (correctAnswers === 0) {
        blocking.push(issue("DIFF_NO_CORRECT_ANSWER", `${path}.choices`, "Aucune réponse correcte n'est déclarée."));
      } else if (correctAnswers > 1) {
        blocking.push(issue("DIFF_MULTIPLE_CORRECT_ANSWERS", `${path}.choices`, "Plusieurs réponses correctes sont déclarées."));
      }
      if (item.type === "qcm") {
        const maxChoices = contract.qcm_max_choices ?? 4;
        if (choices.length > maxChoices) {
          blocking.push(issue(
            "DIFF_QCM_CHOICES_OUT_OF_RANGE",
            `${path}.choices`,
            `Un QCM ${targetLevel} accepte au plus ${maxChoices} choix.`,
          ));
        }
        if (targetLevel === "A1" && choices.length > 3) {
          blocking.push(issue("DIFF_A1_QCM_TOO_MANY_CHOICES", `${path}.choices`, "Un QCM A1 accepte au plus 3 choix."));
        }
      }
      for (const [choiceIndex, choice] of choices.entries()) {
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
      warnings.push(issue("DIFF_FACT_USED_REPEATEDLY", `variants.${targetLevel}.exercise.items`, `Le fait ${factId} est utilisé ${count} fois.`));
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
