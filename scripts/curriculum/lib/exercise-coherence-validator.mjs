import coherenceContract from "../../../supabase/functions/_shared/referential/exercise_coherence_rules_v1.json" with { type: "json" };

const severityByRule = new Map(coherenceContract.rules.map((rule) => [rule.rule_id, rule.severity]));
const closedFormats = new Set(coherenceContract.closed_formats);
const optionFormats = new Set(coherenceContract.option_formats);
const openFormats = new Set(coherenceContract.open_formats);

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();
}

function questionOf(item) {
  return String(item?.question ?? item?.enonce ?? item?.texte ?? "").trim();
}

function countGaps(value) {
  return (String(value ?? "").match(/_{2,}|\(\.{4,}\)|\[\.{3,}\]/g) ?? []).length;
}

function sameValue(left, right) {
  return normalized(left) === normalized(right);
}

function rule(ruleId, errors = [], evidence = []) {
  const severity = severityByRule.get(ruleId) ?? "blocking";
  return {
    rule_id: ruleId,
    severity,
    status: errors.length === 0 ? "pass" : severity === "blocking" ? "fail" : "warning",
    scope: "exercise_coherence",
    errors,
    evidence,
  };
}

function declaredCounts(consigne) {
  const numbers = {
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
    six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  };
  const text = normalized(consigne);
  const matches = [...text.matchAll(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(espaces?|trous?|questions?|items?)\b/g)];
  return matches.map((match) => ({
    count: /^\d+$/.test(match[1]) ? Number(match[1]) : numbers[match[1]],
    unit: match[2],
    text: match[0],
  }));
}

export function validateExerciseCoherence(entry) {
  const items = Array.isArray(entry?.contenu?.items) ? entry.contenu.items : [];
  const rules = [];

  rules.push(rule(
    "COHERENCE_ITEMS_PRESENT",
    items.length > 0 ? [] : ["contenu.items est vide ou absent"],
    items.length > 0 ? [`${items.length} item(s)`] : [],
  ));

  const missingQuestions = items.flatMap((item, index) => questionOf(item) ? [] : [`items[${index}]: question absente`]);
  rules.push(rule("COHERENCE_QUESTION_PRESENT", missingQuestions));

  const seenQuestions = new Map();
  items.forEach((item, index) => {
    const key = normalized(questionOf(item));
    if (!key) return;
    if (!seenQuestions.has(key)) seenQuestions.set(key, []);
    seenQuestions.get(key).push(index);
  });
  const duplicateQuestions = [...seenQuestions.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([question, indexes]) => `question dupliquee aux items ${indexes.map((index) => index + 1).join(", ")}: ${question}`);
  rules.push(rule("COHERENCE_DUPLICATE_QUESTION", duplicateQuestions));

  const missingAnswers = closedFormats.has(entry?.format)
    ? items.flatMap((item, index) => String(item?.bonne_reponse ?? "").trim() ? [] : [`items[${index}]: bonne_reponse absente`])
    : [];
  rules.push(rule("COHERENCE_CLOSED_ANSWER_PRESENT", missingAnswers));

  const optionErrors = [];
  const duplicateOptionErrors = [];
  const answerOptionErrors = [];
  const distractorWarnings = [];
  if (optionFormats.has(entry?.format)) {
    items.forEach((item, index) => {
      const options = Array.isArray(item?.options) ? item.options.map((option) => String(option).trim()) : [];
      const minimum = coherenceContract.minimum_options[entry.format] ?? 2;
      if (options.length < minimum || options.some((option) => !option)) {
        optionErrors.push(`items[${index}]: ${entry.format} exige au moins ${minimum} options non vides`);
        return;
      }
      const unique = new Set(options.map(normalized));
      if (unique.size !== options.length) duplicateOptionErrors.push(`items[${index}]: options dupliquees`);
      if (!options.some((option) => sameValue(option, item?.bonne_reponse))) {
        answerOptionErrors.push(`items[${index}]: bonne_reponse absente des options`);
      }
      const recommended = coherenceContract.recommended_options[entry.format];
      if (recommended && options.length < recommended) {
        distractorWarnings.push(`items[${index}]: ${options.length - 1} distracteur(s), ${recommended - 1} recommandes`);
      }
    });
  }
  rules.push(rule("COHERENCE_OPTIONS_REQUIRED", optionErrors));
  rules.push(rule("COHERENCE_OPTIONS_UNIQUE", duplicateOptionErrors));
  rules.push(rule("COHERENCE_ANSWER_IN_OPTIONS", answerOptionErrors));
  rules.push(rule("COHERENCE_DISTRACTOR_COUNT", distractorWarnings));

  const trueFalseErrors = [];
  if (entry?.format === "vrai_faux") {
    items.forEach((item, index) => {
      if (!["vrai", "faux", "true", "false"].includes(normalized(item?.bonne_reponse))) {
        trueFalseErrors.push(`items[${index}]: reponse attendue differente de vrai/faux`);
      }
    });
  }
  rules.push(rule("COHERENCE_TRUE_FALSE_DOMAIN", trueFalseErrors));

  const gapErrors = [];
  const gapLeakErrors = [];
  const wordBankErrors = [];
  if (entry?.format === "texte_lacunaire") {
    items.forEach((item, index) => {
      const question = questionOf(item);
      const gaps = countGaps(question);
      if (gaps !== 1) gapErrors.push(`items[${index}]: ${gaps} trou(s) visible(s), exactement 1 attendu par item`);
      const inlineChoices = [...question.matchAll(/\(([^)]+\/[^)]+)\)/g)]
        .flatMap((match) => match[1].split("/").map((choice) => choice.trim()));
      const answerIsDisplayedChoice = inlineChoices.length >= 2
        && inlineChoices.some((choice) => sameValue(choice, item?.bonne_reponse));
      if (!answerIsDisplayedChoice && normalized(question).includes(normalized(item?.bonne_reponse)) && String(item?.bonne_reponse ?? "").trim().length >= 3) {
        gapLeakErrors.push(`items[${index}]: la reponse apparait dans la phrase avant validation`);
      }
      if (item?.banque_mots !== undefined) {
        const bank = Array.isArray(item.banque_mots) ? item.banque_mots.map((word) => String(word).trim()) : [];
        const unique = new Set(bank.map(normalized));
        if (bank.length < 2 || unique.size !== bank.length || !bank.some((word) => sameValue(word, item?.bonne_reponse))) {
          wordBankErrors.push(`items[${index}]: banque_mots invalide, dupliquee ou sans la bonne reponse`);
        }
      }
    });
  }
  rules.push(rule("COHERENCE_GAP_COUNT", gapErrors));
  rules.push(rule("COHERENCE_GAP_ANSWER_HIDDEN", gapLeakErrors));
  rules.push(rule("COHERENCE_WORD_BANK", wordBankErrors));

  const declaredCountErrors = [];
  for (const declaration of declaredCounts(entry?.consigne)) {
    if (/^(questions?|items?)$/.test(declaration.unit) && declaration.count !== items.length) {
      declaredCountErrors.push(`consigne: ${declaration.text}, mais ${items.length} item(s) sont fournis`);
    }
    if (/^(espaces?|trous?)$/.test(declaration.unit)) {
      const gapCounts = items.map((item) => countGaps(questionOf(item)));
      if (gapCounts.some((count) => count !== declaration.count)) {
        declaredCountErrors.push(`consigne: ${declaration.text}, mais les items affichent ${[...new Set(gapCounts)].join("/")} trou(s)`);
      }
    }
  }
  rules.push(rule("COHERENCE_DECLARED_COUNT_MATCH", declaredCountErrors));

  const justificationErrors = [];
  items.forEach((item, index) => {
    if (item?.justification_required && !String(item?.justification_prompt ?? "").trim()) {
      justificationErrors.push(`items[${index}]: justification obligatoire sans demande affichee`);
    }
    if (item?.justification_prompt) {
      const openCorrection = item?.correction?.justification_ouverte;
      if (!Array.isArray(openCorrection?.elements_attendus) || openCorrection.elements_attendus.length === 0) {
        justificationErrors.push(`items[${index}]: justification sans elements_attendus dans la correction`);
      }
      if (!Array.isArray(openCorrection?.criteres_evaluation) || openCorrection.criteres_evaluation.length === 0) {
        justificationErrors.push(`items[${index}]: justification sans criteres_evaluation`);
      }
    }
  });
  rules.push(rule("COHERENCE_JUSTIFICATION_CONTRACT", justificationErrors));

  const correctionErrors = [];
  if (closedFormats.has(entry?.format)) {
    items.forEach((item, index) => {
      const correction = item?.correction;
      if (!correction || typeof correction !== "object") {
        correctionErrors.push(`items[${index}]: correction structuree absente`);
        return;
      }
      if (!sameValue(correction.bonne_reponse, item?.bonne_reponse)) correctionErrors.push(`items[${index}]: correction.bonne_reponse incoherente`);
      if (!String(correction.preuve_support ?? "").trim()) correctionErrors.push(`items[${index}]: preuve_support absente`);
      if (!String(correction.remediation ?? "").trim()) correctionErrors.push(`items[${index}]: remediation absente`);
      if (Array.isArray(item?.options) && item.options.length > 1) {
        const explanations = Array.isArray(correction.explication_distracteurs) ? correction.explication_distracteurs : [];
        if (explanations.length < item.options.length - 1) correctionErrors.push(`items[${index}]: explication de chaque autre option incomplete`);
      }
    });
  }
  rules.push(rule("COHERENCE_CORRECTION_COMPLETE", correctionErrors));

  const openRubricErrors = [];
  if (openFormats.has(entry?.format)) {
    items.forEach((item, index) => {
      const criteria = item?.correction?.justification_ouverte?.criteres_evaluation ?? item?.criteres_evaluation;
      const hasCriteria = Array.isArray(criteria) ? criteria.length > 0 : String(criteria ?? "").trim().length > 0;
      const hasModel = [item?.bonne_reponse, item?.corrige_modele, item?.explication]
        .some((value) => String(value ?? "").trim().length > 0);
      if (!hasCriteria && !hasModel) openRubricErrors.push(`items[${index}]: production sans modele ni criteres de correction`);
    });
  }
  rules.push(rule("COHERENCE_OPEN_RUBRIC", openRubricErrors));

  return {
    schema_version: coherenceContract.schema_version,
    valid: !rules.some((entryRule) => entryRule.status === "fail"),
    warning_count: rules.filter((entryRule) => entryRule.status === "warning").length,
    rules,
  };
}

export function getExerciseCoherenceContract() {
  return coherenceContract;
}