// Lot 2.1 — un indice A1 doit orienter vers la zone/l'opération à réaliser,
// jamais fournir littéralement la bonne réponse (sauf exception explicite
// et déclarée : un support d'observation, où lire la réponse dans le
// support EST la tâche elle-même — statut "assisted_retrieval").

function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[«»"'.,;:!?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function indiceContainsAnswer(indice, bonneReponse) {
  const normIndice = normalize(indice);
  const normReponse = normalize(bonneReponse);
  if (!normIndice || !normReponse) return false;
  return normIndice.includes(normReponse);
}

export function fieldsAreIdentical(a, b) {
  if (!a || !b) return false;
  return normalize(a) === normalize(b);
}

/**
 * Valide un item portant un `indice`. `assistedRetrieval: true` déclare
 * explicitement un support d'observation (repérage direct légitime) :
 * seule cette exception autorise l'indice à contenir la réponse ou à
 * être identique à preuve_support. Une identité avec l'explication ou la
 * correction reste TOUJOURS une violation, exception ou non (ce ne sont
 * jamais des aides, mais des données de corrigé).
 */
export function validateIndice({
  itemId,
  indice,
  bonneReponse,
  preuveSupport,
  explication,
  assistedRetrieval = false,
}) {
  if (!indice) return { itemId, valid: true, status: null, violations: [] };

  const violations = [];
  const containsAnswer = indiceContainsAnswer(indice, bonneReponse);
  const equalsPreuve = fieldsAreIdentical(indice, preuveSupport);
  const equalsExplication = fieldsAreIdentical(indice, explication);

  if (containsAnswer && !assistedRetrieval) {
    violations.push({
      code: "INDICE_CONTAINS_ANSWER",
      itemId,
      detail: `L'indice contient littéralement la bonne réponse (« ${bonneReponse} »).`,
    });
  }
  if (equalsPreuve && !assistedRetrieval) {
    violations.push({ itemId, code: "INDICE_EQUALS_PREUVE_SUPPORT", detail: "L'indice est identique à preuve_support." });
  }
  if (equalsExplication) {
    violations.push({ itemId, code: "INDICE_EQUALS_EXPLICATION", detail: "L'indice est identique à l'explication (donnée de corrigé)." });
  }

  const status = assistedRetrieval
    ? "assisted_retrieval"
    : violations.length > 0
      ? "leak"
      : "pedagogical_hint";

  return { itemId, valid: violations.length === 0, status, violations };
}

/**
 * Valide tous les items d'un exercice généré (contenu.items) portant un
 * indice, en s'appuyant sur item.correction (jamais transmis au client)
 * pour comparer preuve_support/explication. `assistedRetrieval(item)` est
 * une fonction : certains items d'un même exercice peuvent être des
 * supports d'observation, d'autres non.
 */
export function validateExerciseIndices(exercise, { assistedRetrieval = () => false } = {}) {
  const results = (exercise.contenu?.items ?? [])
    .map((item, index) => {
      if (!item.indice) return null;
      return validateIndice({
        itemId: `${exercise.metadata_code}#items[${index}]`,
        indice: item.indice,
        bonneReponse: item.bonne_reponse,
        preuveSupport: item.correction?.preuve_support,
        explication: item.explication,
        assistedRetrieval: assistedRetrieval(item, index),
      });
    })
    .filter(Boolean);

  const violations = results.flatMap((r) => r.violations);
  return { valid: violations.length === 0, results, violations };
}
