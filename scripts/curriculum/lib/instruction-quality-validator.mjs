import instructionRules from "../../../supabase/functions/_shared/referential/instruction_quality_rules_v1.json" with { type: "json" };

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsExpression(value, expression) {
  return ` ${normalized(value)} `.includes(` ${normalized(expression)} `);
}

function learnerFields(entry) {
  const fields = [{ path: "consigne", value: entry.consigne ?? "" }];
  (entry.contenu?.items ?? []).forEach((item, index) => {
    fields.push({ path: `items[${index}].question`, value: item.question ?? item.enonce ?? item.texte ?? "", item });
    fields.push({ path: `items[${index}].justification_prompt`, value: item.justification_prompt ?? "", item });
    fields.push({ path: `items[${index}].indice`, value: item.indice ?? "", item });
  });
  return fields.filter((field) => String(field.value).trim().length > 0);
}

function result(ruleId, status, { evidence = [], errors = [], suggestedRewrite = null } = {}) {
  return {
    rule_id: ruleId,
    status,
    scope: "instruction",
    evidence,
    errors,
    suggested_rewrite: suggestedRewrite,
  };
}

function hasAction(text, verbs = instructionRules.required_action_verbs) {
  return verbs.some((verb) => containsExpression(text, verb));
}

function answerLeaksIntoField(entry, field) {
  if (!field.item) return false;
  const answer = normalized(field.item.bonne_reponse);
  if (answer.length < 4 || ["vrai", "faux", "oui", "non"].includes(answer)) return false;
  if (field.path.endsWith(".question") && /_{2,}|…/.test(String(field.value))) return false;
  const mentionedOptions = (field.item.options ?? []).filter((option) => containsExpression(field.value, option));
  if (mentionedOptions.length >= 2) return false;
  if (field.path.endsWith(".indice") && field.item.assisted_retrieval === true) return false;
  return containsExpression(field.value, field.item.bonne_reponse);
}

export function validateInstructionQuality(entry) {
  const rules = [];
  const fields = learnerFields(entry);
  const consigne = String(entry.consigne ?? "");

  const jargon = [];
  for (const field of fields) {
    for (const forbidden of instructionRules.forbidden_learner_jargon) {
      if (containsExpression(field.value, forbidden.term)) {
        jargon.push({ field: field.path, term: forbidden.term, rewrite: forbidden.suggested_rewrite });
      }
    }
  }
  rules.push(result("INSTRUCTION_JARGON_UNEXPLAINED", jargon.length ? "fail" : "pass", {
    evidence: jargon.map((hit) => `${hit.field}: ${hit.term}`),
    errors: jargon.map((hit) => `Terme technique ou ambigu destiné à l'apprenant : « ${hit.term} ».`),
    suggestedRewrite: jargon[0]?.rewrite ?? null,
  }));

  const actionPresent = hasAction(consigne) || instructionRules.question_action_forms.some((word) => normalized(consigne).startsWith(normalized(word)));
  rules.push(result("INSTRUCTION_ACTION_MISSING", actionPresent ? "pass" : "fail", {
    errors: actionPresent ? [] : ["La consigne ne contient aucune action observable."],
  }));

  const objectTerms = ["phrase", "phrases", "texte", "question", "questions", "reponse", "reponses", "mot", "mots", "document", "audio", "enregistrement", "image", "tableau", "proposition", "propositions", "element", "elements", "dialogue", "information", "informations", "fiche", "fiches", "schema", "theme", "themes", "carte", "terme", "termes", "definition", "definitions", "pronom", "verbe", "transcription", "corrige", "amorce", "amorces", "connecteur"];
  const outputClear = objectTerms.some((term) => containsExpression(consigne, term));
  rules.push(result("INSTRUCTION_OUTPUT_UNCLEAR", outputClear ? "pass" : "fail", {
    errors: outputClear ? [] : ["La consigne ne précise pas clairement l'objet sur lequel agir ou la réponse attendue."],
  }));

  const verbsFound = instructionRules.required_action_verbs.filter((verb) => containsExpression(consigne, verb));
  const hasStepMarker = instructionRules.multi_step_markers.some((marker) => normalized(consigne).includes(normalized(marker)));
  const multistepUnmarked = verbsFound.length > 1 && !hasStepMarker;
  rules.push(result("INSTRUCTION_MULTISTEP_UNMARKED", multistepUnmarked ? "warning" : "pass", {
    evidence: multistepUnmarked ? verbsFound : [],
    errors: multistepUnmarked ? ["Plusieurs actions sont demandées sans ordre explicite."] : [],
  }));

  const allowedFormatActions = instructionRules.format_action_contracts[entry.format] ?? [];
  const formatMatches = allowedFormatActions.length === 0 || hasAction(consigne, allowedFormatActions);
  rules.push(result("INSTRUCTION_FORMAT_MISMATCH", formatMatches ? "pass" : "fail", {
    evidence: allowedFormatActions,
    errors: formatMatches ? [] : [`La consigne ne décrit pas une action compatible avec le format ${entry.format}.`],
  }));

  const leaks = fields.filter((field) => answerLeaksIntoField(entry, field));
  rules.push(result("INSTRUCTION_ANSWER_LEAK", leaks.length ? "fail" : "pass", {
    evidence: leaks.map((field) => field.path),
    errors: leaks.map((field) => `${field.path}: la bonne réponse apparaît dans un texte affiché avant validation.`),
  }));

  const maxLength = instructionRules.max_instruction_characters[entry.niveau_vise] ?? 280;
  const tooLong = consigne.length > maxLength;
  rules.push(result("INSTRUCTION_TOO_COMPLEX", tooLong ? "warning" : "pass", {
    evidence: [`${consigne.length}/${maxLength} caractères`],
    errors: tooLong ? ["La consigne dépasse le plafond de lisibilité mobile du niveau."] : [],
  }));

  const titleMismatch = containsExpression(entry.titre, "definition")
    && containsExpression(consigne, "phrase")
    && !containsExpression(consigne, "definition");
  rules.push(result("INSTRUCTION_TITLE_MISMATCH", titleMismatch ? "warning" : "pass", {
    evidence: titleMismatch ? [`titre: ${entry.titre}`, `consigne: ${consigne}`] : [],
    errors: titleMismatch ? ["Le titre et la tâche décrivent deux opérations différentes."] : [],
  }));

  return {
    schema_version: instructionRules.schema_version,
    valid: !rules.some((rule) => rule.status === "fail"),
    rules,
  };
}

export function getInstructionQualityRules() {
  return instructionRules;
}