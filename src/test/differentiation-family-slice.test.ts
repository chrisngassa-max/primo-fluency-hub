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
          ins<�h��춻�q�^t   }
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
