import { diffAgainstBaseline } from "./s01-snapshot-diff.mjs";
import { validateExerciseIndices } from "./indice-validator.mjs";
import {
  DIFFERENTIATION_LEVELS,
  getDifferentiationTransformationRules,
} from "./differentiation-referential.mjs";

const LEVELS = new Set(DIFFERENTIATION_LEVELS);
const COMPETENCES = new Set(["CE", "CO", "EE", "EO", "Structures"]);
const CLOSED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"]);
const GLOBAL_BLOCKING_CODES = new Set([
  "DIFF_SCHEMA_INVALID",
  "DIFF_CORPUS_VOLUME_CHANGED",
  "DIFF_METADATA_CODE_DUPLICATED",
]);

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function exerciseFamilyKey(entry) {
  const parts = String(entry?.metadata_code ?? "").split(":");
  return parts.length >= 5 ? parts.slice(0, -1).join(":") : String(entry?.metadata_code ?? "");
}

function canonicalPedagogicalCore(entry) {
  return JSON.stringify({
    competence: entry.competence,
    format: entry.format,
    consigne: normalized(entry.consigne),
    items: (entry.contenu?.items ?? []).map((item) => ({
      question: normalized(item.question ?? item.enonce ?? item.texte),
      options: Array.isArray(item.options) ? item.options.map(normalized) : null,
      indice: normalized(item.indice),
      banque_mots: Array.isArray(item.banque_mots) ? item.banque_mots.map(normalized) : null,
      justification_prompt: normalized(item.justification_prompt),
      justification_required: Boolean(item.justification_required),
      assisted_retrieval: Boolean(item.assisted_retrieval),
    })),
  });
}

function resolveAppliedPath(entry, appliedTo) {
  const match = /^items\[(\d+)]\.([A-Za-z0-9_]+)$/.exec(String(appliedTo ?? ""));
  if (!match) return undefined;
  return entry.contenu?.items?.[Number(match[1])]?.[match[2]];
}

function questionLeaksAnswer(item) {
  const lexical = (value) => normalized(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const rawQuestion = String(item?.question ?? item?.enonce ?? item?.texte ?? "");
  const answer = lexical(item?.bonne_reponse);
  if (answer.length < 4 || /_{2,}|…/.test(rawQuestion)) return false;
  const question = lexical(rawQuestion);
  return ` ${question} `.includes(` ${answer} `);
}

function makeRule(ruleId, status, { scope = "global", metadataCode = null, evidence = [], errors = [] } = {}) {
  return { rule_id: ruleId, status, scope, metadata_code: metadataCode, evidence, errors };
}

function isFailure(rule) {
  return rule.status === "fail";
}

export function validateS01DifferentiationPayload(payload, { baseline = null } = {}) {
  const rules = [];
  const exercises = Array.isArray(payload?.exercises) ? payload.exercises : [];
  const byExerciseRules = new Map(exercises.map((entry) => [entry.metadata_code, []]));

  const addGlobal = (rule) => rules.push(rule);
  const addExercise = (metadataCode, rule) => {
    rules.push(rule);
    if (!byExerciseRules.has(metadataCode)) byExerciseRules.set(metadataCode, []);
    byExerciseRules.get(metadataCode).push(rule);
  };

  const schemaErrors = [];
  if (!payload || typeof payload !== "object") schemaErrors.push("payload absent");
  if (!Array.isArray(payload?.exercises)) schemaErrors.push("exercises doit etre un tableau");
  if (!payload?.playlists || typeof payload.playlists !== "object") schemaErrors.push("playlists absent");
  exercises.forEach((entry, index) => {
    if (!entry?.metadata_code) schemaErrors.push(`exercises[${index}].metadata_code absent`);
    if (!LEVELS.has(entry?.niveau_vise)) schemaErrors.push(`${entry?.metadata_code ?? index}: niveau invalide`);
    if (!COMPETENCES.has(entry?.competence)) schemaErrors.push(`${entry?.metadata_code ?? index}: competence invalide`);
    if (!Array.isArray(entry?.contenu?.items)) schemaErrors.push(`${entry?.metadata_code ?? index}: contenu.items absent`);
  });
  addGlobal(makeRule("DIFF_SCHEMA_INVALID", schemaErrors.length ? "fail" : "pass", { errors: schemaErrors }));

  const codes = exercises.map((entry) => entry.metadata_code);
  const duplicates = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];
  addGlobal(makeRule("DIFF_METADATA_CODE_DUPLICATED", duplicates.length ? "fail" : "pass", {
    evidence: duplicates,
    errors: duplicates.map((code) => `metadata_code duplique: ${code}`),
  }));

  if (baseline) {
    const volumeDiff = diffAgainstBaseline(baseline, payload);
    addGlobal(makeRule("DIFF_CORPUS_VOLUME_CHANGED", volumeDiff.length ? "fail" : "pass", {
      evidence: volumeDiff.length ? [] : [`${exercises.length} exercices conformes au snapshot`],
      errors: volumeDiff,
    }));
  } else {
    addGlobal(makeRule("DIFF_CORPUS_VOLUME_CHANGED", "warning", {
      evidence: ["snapshot non fourni au validateur"],
    }));
  }

  const transformationRules = getDifferentiationTransformationRules();
  const validTransformationIds = new Set(["IDENTITY", ...Object.keys(transformationRules.transformations ?? {})]);

  for (const entry of exercises) {
    const code = entry.metadata_code;
    const metadata = entry.contenu?.metadata ?? {};
    const items = entry.contenu?.items ?? [];
    const applied = Array.isArray(metadata.applied_transformations) ? metadata.applied_transformations : [];

    if (metadata.needs_content_review) {
      addExercise(code, makeRule("DIFF_CONTENT_REVIEW_REQUIRED", "fail", {
        scope: "exercise", metadataCode: code,
        evidence: [`${code}: needs_content_review=true`],
        errors: ["exercice non publiable avant revue"],
      }));
    } else {
      addExercise(code, makeRule("DIFF_CONTENT_REVIEW_REQUIRED", "pass", { scope: "exercise", metadataCode: code }));
    }

    const transformationId = metadata.transformation_id;
    const transformationValid = validTransformationIds.has(transformationId);
    addExercise(code, makeRule("DIFF_TRANSFORMATION_UNDECLARED", transformationValid ? "pass" : "fail", {
      scope: "exercise", metadataCode: code,
      evidence: transformationValid ? [transformationId] : [],
      errors: transformationValid ? [] : [`transformation_id invalide ou absent: ${transformationId}`],
    }));

    const unsupported = applied.filter((item) => item?.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED");
    addExercise(code, makeRule("DIFF_TRANSFORMATION_NOT_SUPPORTED", unsupported.length ? "fail" : "pass", {
      scope: "exercise", metadataCode: code,
      evidence: unsupported.map((item) => `${item.applied_to}: ${item.evidence ?? "preuve absente"}`),
      errors: unsupported.length ? ["au moins une transformation demandee n'est pas supportee par le support"] : [],
    }));

    const invalidApplied = applied.filter((item) => {
      if (item?.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED") return false;
      if (!validTransformationIds.has(item?.rule_id)) return true;
      if (!item?.evidence || !item?.applied_to) return true;
      return resolveAppliedPath(entry, item.applied_to) === undefined;
    });
    addExercise(code, makeRule("DIFF_COGNITIVE_OPERATION_NOT_REALIZED", invalidApplied.length ? "fail" : "pass", {
      scope: "exercise", metadataCode: code,
      evidence: applied.filter((item) => !invalidApplied.includes(item)).map((item) => `${item.rule_id}:${item.applied_to}`),
      errors: invalidApplied.map((item) => `preuve invalide: ${item?.rule_id ?? "sans regle"} -> ${item?.applied_to ?? "sans chemin"}`),
    }));

    const correctionErrors = [];
    const coherenceErrors = [];
    const answerLeakErrors = [];
    items.forEach((item, index) => {
      const question = item?.question ?? item?.enonce ?? item?.texte;
      const answer = item?.bonne_reponse;
      const isOpenProduction = entry.format === "production_orale" || entry.format === "production_ecrite";
      const hasOpenCorrection = Boolean(
        item?.explication
        || item?.correction
        || item?.criteres_evaluation
        || item?.corrige_modele,
      );
      if (!question || (!isOpenProduction && (answer === undefined || answer === null || String(answer).trim() === ""))) {
        correctionErrors.push(`items[${index}]: question ou bonne_reponse absente`);
      } else if (isOpenProduction && !hasOpenCorrection && String(answer ?? "").trim() === "") {
        correctionErrors.push(`items[${index}]: modele ou criteres de correction absents`);
      }
      if (Array.isArray(item?.options) && item.options.length > 0 && !item.options.includes(answer)) {
        coherenceErrors.push(`items[${index}]: bonne_reponse absente des options`);
      }
      if (questionLeaksAnswer(item)) {
        answerLeakErrors.push(`items[${index}]: bonne_reponse recopiee dans la question`);
      }
      if (item?.justification_prompt) {
        const correction = item?.correction?.justification_ouverte;
        if (!Array.isArray(correction?.elements_attendus) || correction.elements_attendus.length === 0) {
          correctionErrors.push(`items[${index}]: elements_attendus de justification absents`);
        }
      }
      if (CLOSED_FORMATS.has(entry.format) && item?.correction && !item.correction.preuve_support) {
        correctionErrors.push(`items[${index}]: preuve_support absente de la correction riche`);
      }
    });
    addExercise(code, makeRule("DIFF_CORRECTION_MISSING", correctionErrors.length ? "fail" : "pass", {
      scope: "exercise", metadataCode: code, errors: correctionErrors,
    }));
    addExercise(code, makeRule("DIFF_INSTRUCTION_CORRECTION_MISMATCH", coherenceErrors.length ? "fail" : "pass", {
      scope: "exercise", metadataCode: code, errors: coherenceErrors,
    }));
    addExercise(code, makeRule("DIFF_ANSWER_LEAK_IN_QUESTION", answerLeakErrors.length ? "fail" : "pass", {
      scope: "exercise", metadataCode: code, errors: answerLeakErrors,
    }));

    const indiceValidation = validateExerciseIndices(entry, {
      assistedRetrieval: (item) => Boolean(item?.assisted_retrieval),
    });
    addExercise(code, makeRule("DIFF_HINT_LEAK", indiceValidation.valid ? "pass" : "fail", {
      scope: "exercise", metadataCode: code,
      evidence: indiceValidation.results.map((result) => `${result.itemId}:${result.status}`),
      errors: indiceValidation.violations.map((violation) => `${violation.code}:${violation.itemId}`),
    }));

    const civicInvalid = entry.civic_content && items.some((item) => item?.needs_review);
    addExercise(code, makeRule("DIFF_CIVIC_FACT_NOT_VALIDATED", civicInvalid ? "fail" : "pass", {
      scope: "exercise", metadataCode: code,
      errors: civicInvalid ? ["au moins un fait civique n'a pas de validation structuree admissible"] : [],
    }));

    const fakeReview = JSON.stringify(entry).includes("fake-content-model");
    addExercise(code, makeRule("DIFF_FAKE_REVIEW_NOT_ADMISSIBLE", fakeReview ? "fail" : "pass", {
      scope: "exercise", metadataCode: code,
      errors: fakeReview ? ["revue factice detectee"] : [],
    }));

    if (entry.family_id && entry.extension_of_family_id) {
      addExercise(code, makeRule("DIFF_EXTENSION_INSIDE_FAMILY", "fail", {
        scope: "exercise", metadataCode: code,
        errors: ["une extension ne peut pas etre une variante interne de la meme famille"],
      }));
    } else {
      addExercise(code, makeRule("DIFF_EXTENSION_INSIDE_FAMILY", "pass", { scope: "exercise", metadataCode: code }));
    }
  }

  const explicitFamilies = new Map();
  exercises.filter((entry) => entry.family_id).forEach((entry) => {
    if (!explicitFamilies.has(entry.family_id)) explicitFamilies.set(entry.family_id, []);
    explicitFamilies.get(entry.family_id).push(entry);
  });
  for (const [familyId, familyEntries] of explicitFamilies) {
    const competences = [...new Set(familyEntries.map((entry) => entry.competence))];
    if (competences.length > 1) {
      familyEntries.forEach((entry) => addExercise(entry.metadata_code, makeRule("DIFF_COMPETENCE_CHANGED", "fail", {
        scope: "family", metadataCode: entry.metadata_code,
        evidence: [`${familyId}: ${competences.join(", ")}`],
        errors: ["competence differente dans une famille explicite"],
      })));
    } else {
      familyEntries.forEach((entry) => addExercise(entry.metadata_code, makeRule("DIFF_COMPETENCE_CHANGED", "pass", {
        scope: "family", metadataCode: entry.metadata_code, evidence: [`${familyId}:${competences[0]}`],
      })));
    }
  }

  const variantGroups = new Map();
  exercises.forEach((entry) => {
    const key = exerciseFamilyKey(entry);
    if (!variantGroups.has(key)) variantGroups.set(key, []);
    variantGroups.get(key).push(entry);
  });
  for (const group of variantGroups.values()) {
    if (group.length < 2) continue;
    const byCore = new Map();
    group.forEach((entry) => {
      const core = canonicalPedagogicalCore(entry);
      if (!byCore.has(core)) byCore.set(core, []);
      byCore.get(core).push(entry);
    });
    for (const duplicatesForCore of byCore.values()) {
      if (duplicatesForCore.length < 2) continue;
      const targets = duplicatesForCore.filter((entry) => entry.niveau_vise !== "A2");
      const entriesToFail = targets.length ? targets : duplicatesForCore.slice(1);
      entriesToFail.forEach((entry) => addExercise(entry.metadata_code, makeRule("DIFF_VARIANTS_DUPLICATED", "fail", {
        scope: "family", metadataCode: entry.metadata_code,
        evidence: duplicatesForCore.map((item) => item.metadata_code),
        errors: ["variante pedagogiquement identique a un autre niveau"],
      })));
    }

    const b2 = group.find((entry) => entry.niveau_vise === "B2");
    const a2 = group.find((entry) => entry.niveau_vise === "A2");
    if (b2 && a2 && b2.contenu.items.length > a2.contenu.items.length) {
      const a2Prefix = JSON.stringify(canonicalPedagogicalCore({ ...a2, contenu: { ...a2.contenu, items: a2.contenu.items } }));
      const b2Prefix = JSON.stringify(canonicalPedagogicalCore({ ...b2, contenu: { ...b2.contenu, items: b2.contenu.items.slice(0, a2.contenu.items.length) } }));
      if (a2Prefix === b2Prefix) {
        addExercise(b2.metadata_code, makeRule("DIFF_B2_ONLY_MORE_ITEMS", "fail", {
          scope: "family", metadataCode: b2.metadata_code,
          errors: ["B2 differe uniquement par des items supplementaires"],
        }));
      }
    }

    const supportHashes = [...new Set(group.map((entry) => (
      entry.document_source_hash
      ?? entry.support_hash
      ?? entry.contenu?.metadata?.document_source_hash
      ?? entry.contenu?.metadata?.support_hash
    )).filter(Boolean))];
    if (supportHashes.length > 1) {
      group.forEach((entry) => addExercise(entry.metadata_code, makeRule("DIFF_SUPPORT_DIVERGED", "fail", {
        scope: "family", metadataCode: entry.metadata_code,
        evidence: supportHashes,
        errors: ["support source divergent entre variantes"],
      })));
    }

    const factsHashes = [...new Set(group.map((entry) => entry.contenu?.metadata?.facts_hash).filter(Boolean))];
    if (factsHashes.length > 1) {
      group.forEach((entry) => addExercise(entry.metadata_code, makeRule("DIFF_FACTS_CHANGED", "fail", {
        scope: "family", metadataCode: entry.metadata_code,
        evidence: factsHashes,
        errors: ["facts_hash divergent entre variantes"],
      })));
    } else if (factsHashes.length === 0) {
      group.forEach((entry) => addExercise(entry.metadata_code, makeRule("DIFF_FACTS_MISSING", "warning", {
        scope: "family", metadataCode: entry.metadata_code,
        evidence: ["facts_hash absent: controle limite au support et aux corrections"],
      })));
    }
  }

  const globalBlockingErrors = rules
    .filter((rule) => isFailure(rule) && GLOBAL_BLOCKING_CODES.has(rule.rule_id))
    .flatMap((rule) => rule.errors.map((error) => ({ rule_id: rule.rule_id, error })));

  const byExercise = Object.fromEntries(exercises.map((entry) => {
    const exerciseRules = byExerciseRules.get(entry.metadata_code) ?? [];
    const blockingErrors = exerciseRules
      .filter(isFailure)
      .map((rule) => ({ rule_id: rule.rule_id, errors: rule.errors, evidence: rule.evidence }));
    return [entry.metadata_code, {
      publishable: blockingErrors.length === 0 && globalBlockingErrors.length === 0,
      blocking_errors: blockingErrors,
      rules: exerciseRules,
    }];
  }));

  const publishableCount = Object.values(byExercise).filter((entry) => entry.publishable).length;
  return {
    schema_version: "1.0",
    valid: globalBlockingErrors.length === 0,
    publishable: globalBlockingErrors.length === 0 && publishableCount === exercises.length,
    publishable_count: publishableCount,
    non_publishable_count: exercises.length - publishableCount,
    global_blocking_errors: globalBlockingErrors,
    rules,
    by_exercise: byExercise,
  };
}

export function publicationDecision(validation, metadataCode) {
  const result = validation?.by_exercise?.[metadataCode];
  return {
    publishable: Boolean(validation?.valid && result?.publishable),
    blocking_errors: result?.blocking_errors ?? [],
  };
}
