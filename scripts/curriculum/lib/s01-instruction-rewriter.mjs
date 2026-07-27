const POLICY_VERSION = "instruction-quality-v1";
const HUMAN_VALIDATION_STATUS = "pending_pedagogical_owner";

const INSTRUCTIONS = {
  "lexique-association": {
    A1: "Associez chaque mot à sa définition. Utilisez l’indice si vous avez besoin d’aide.",
    A2: "Associez chaque mot de la séance à la définition qui lui correspond.",
    B1: "Dans chaque phrase, un mot manque. Choisissez parmi les quatre propositions le mot qui complète correctement la phrase.",
    B2: "Dans chaque phrase, un mot manque. Choisissez parmi les quatre propositions le mot qui complète correctement la phrase. Ensuite, expliquez quels éléments de la phrase vous ont aidé et pourquoi une autre proposition ne convient pas.",
  },
  "lexique-texte-lacunaire": {
    A1: "Dans chaque phrase, un mot manque. Complétez l’espace avec le mot correct.",
    A2: "Dans chaque phrase, un mot manque. Complétez l’espace avec le mot qui convient.",
    B1: "Dans chaque phrase, un mot manque. Complétez l’espace avec le mot qui rend la phrase cohérente.",
    B2: "Dans chaque phrase, un mot manque. Complétez l’espace avec le mot précis qui rend la phrase cohérente.",
  },
  "lexique-reemploi-oral": {
    A1: "Enregistrez une phrase pour dire pourquoi vous suivez ce parcours. Utilisez « objectif » ou « démarche ».",
    A2: "Enregistrez une phrase complète pour expliquer pourquoi vous suivez ce parcours. Utilisez « objectif » ou « démarche ».",
    B1: "Enregistrez une réponse claire pour expliquer votre objectif dans ce parcours. Utilisez « objectif » ou « démarche ».",
    B2: "Enregistrez une réponse précise pour expliquer votre objectif et votre démarche dans ce parcours.",
  },
  "support-visuel": {
    A1: "Observez le schéma. Ensuite, complétez chaque réponse avec un mot ou un nombre présent dans le document.",
    A2: "Observez le schéma. Ensuite, complétez chaque réponse avec une information du document.",
    B1: "Observez le schéma. Ensuite, complétez chaque réponse avec les informations précises du document.",
    B2: "Observez l’organisation du schéma. Ensuite, complétez chaque réponse avec les informations précises du document.",
  },
  "support-visuel-ouvert": {
    A1: "Observez le schéma. Ensuite, écrivez une phrase courte pour répondre à chaque question.",
    A2: "Observez le schéma. Ensuite, répondez à chaque question par une phrase complète.",
    B1: "Observez le schéma. Ensuite, répondez à chaque question par une phrase et justifiez-la avec un élément du document.",
    B2: "Observez le schéma. Ensuite, rédigez une réponse précise à chaque question et justifiez-la avec les informations du document.",
  },
  "co-dialogue": {
    A1: "Écoutez le dialogue. Ensuite, choisissez la bonne réponse pour chaque question.",
    A2: "Écoutez le dialogue. Ensuite, choisissez la réponse qui correspond aux informations entendues.",
    B1: "Écoutez le dialogue. Choisissez chaque réponse. Ensuite, justifiez votre choix avec un mot ou une phrase entendue.",
    B2: "Écoutez le dialogue. Choisissez chaque réponse. Ensuite, justifiez précisément votre choix à partir des informations entendues.",
  },
  "co-comprehension": {
    A1: "Écoutez le dialogue. Ensuite, complétez chaque réponse avec un mot ou une phrase courte.",
    A2: "Écoutez le dialogue. Ensuite, complétez chaque réponse par une phrase courte et précise.",
    B1: "Écoutez le dialogue. Ensuite, complétez chaque réponse en reformulant précisément les informations entendues.",
    B2: "Écoutez le dialogue. Ensuite, complétez chaque réponse avec une reformulation précise et complète des informations entendues.",
  },
  "co-approfondissement": {
    A2: "Écoutez le dialogue. Ensuite, répondez à chaque question avec vos propres mots, en une ou deux phrases.",
    B1: "Écoutez le dialogue. Ensuite, rédigez une ou deux phrases pour reformuler et justifier chaque réponse.",
    B2: "Écoutez le dialogue. Ensuite, rédigez une réponse précise et nuancée à chaque question, uniquement à partir des informations entendues.",
  },
  "atelier-1": {
    A1: "Écoutez la phrase. Ensuite, choisissez l’écriture correcte du nom de famille.",
    A2: "Lisez le texte. Ensuite, complétez chaque espace avec le mot proposé qui convient.",
    B1: "Lisez le document. Ensuite, choisissez la réponse exacte pour chaque question.",
    B2: "Lisez le paragraphe. Ensuite, choisissez la réponse la plus précise pour chaque question.",
  },
  "atelier-2": {
    A1: "Lisez chaque question. Ensuite, choisissez la réponse qui convient.",
    A2: "Lisez les deux fiches. Ensuite, choisissez la réponse exacte pour chaque question.",
    B1: "Lisez les explications de Mme Rossi. Ensuite, associez chaque terme à sa définition.",
  },
  "atelier-3": {
    A1: "Lisez la carte d’identité. Ensuite, indiquez si chaque phrase est vraie ou fausse.",
    A2: "Lisez le dialogue. Ensuite, choisissez la réponse qui correspond aux informations du texte.",
  },
  "atelier-4": {
    A1: "Lisez le début du dialogue. Ensuite, indiquez si chaque phrase est vraie ou fausse.",
  },
  structures: {
    A1: "Lisez chaque phrase. Ensuite, complétez-la avec le pronom ou la forme du verbe être qui convient.",
    A2: "Lisez chaque phrase. Ensuite, complétez-la avec « mon », « ma » ou « mes », puis terminez le texte de présentation.",
    B1: "Lisez le modèle. Ensuite, transformez chaque phrase au discours rapporté.",
    B2: "Lisez chaque phrase. Ensuite, transformez-la avec une nominalisation ou complétez-la avec le connecteur demandé.",
  },
  eo: {
    A1: "Lisez la question. Ensuite, enregistrez une réponse courte. Après l’exercice, vous pourrez écouter et lire la correction.",
    A2: "Lisez la question. Ensuite, enregistrez une réponse complète. Après l’exercice, vous pourrez écouter et lire la correction.",
    B1: "Lisez la question. Ensuite, enregistrez une réponse développée et organisée. Après l’exercice, vous pourrez écouter et lire la correction.",
    B2: "Lisez la question. Ensuite, enregistrez une réponse précise, structurée et nuancée. Après l’exercice, vous pourrez écouter et lire la correction.",
  },
  civique: {
    A1: "Lisez chaque situation. Ensuite, choisissez la réponse indiquée par la règle présentée.",
    A2: "Lisez chaque situation. Ensuite, choisissez la réponse qui correspond à la règle présentée.",
    B1: "Lisez chaque situation. Choisissez une réponse. Ensuite, justifiez votre choix uniquement avec la règle présentée.",
    B2: "Lisez chaque situation. Choisissez une réponse. Ensuite, justifiez votre choix et expliquez pourquoi une autre réponse ne convient pas, uniquement à partir de la règle présentée.",
  },
  "ee-guidee-1": {
    A1: "Lisez le texte de présentation. Ensuite, complétez chaque espace avec la forme verbale correcte.",
    A2: "Lisez le texte de présentation. Ensuite, complétez chaque espace avec la forme verbale qui convient.",
  },
  "ee-guidee-2": {
    A2: "Lisez la fiche d’identité. Ensuite, rédigez cinq phrases complètes pour présenter Awa.",
    B1: "Lisez la fiche d’identité. Ensuite, rédigez cinq phrases liées et précises pour présenter Awa.",
  },
  "ee-autonome": {
    B1: "Rédigez au moins huit phrases pour présenter votre parcours et votre objectif administratif. Utilisez les amorces proposées.",
    B2: "Rédigez au moins dix phrases structurées pour présenter votre parcours et votre objectif administratif. Utilisez au moins un connecteur pour expliquer votre démarche.",
  },
};

function codeFromMetadata(metadataCode) {
  return String(metadataCode ?? "").split(":").at(-2) ?? "";
}

export function getS01RewrittenInstruction(entry) {
  const code = codeFromMetadata(entry?.metadata_code);
  const level = entry?.niveau_vise;
  const instruction = INSTRUCTIONS[code]?.[level];
  if (!instruction) {
    throw new Error(`S01 instruction missing for ${entry?.metadata_code ?? `${code}:${level}`}`);
  }
  return instruction;
}

export function rewriteS01Instructions(exercises) {
  return exercises.map((entry) => ({
    ...entry,
    consigne: getS01RewrittenInstruction(entry),
    contenu: {
      ...entry.contenu,
      metadata: {
        ...entry.contenu?.metadata,
        instruction_policy_version: POLICY_VERSION,
        instruction_human_validation_status: HUMAN_VALIDATION_STATUS,
      },
    },
  }));
}

export function getS01InstructionPolicyStatus() {
  return {
    policy_version: POLICY_VERSION,
    human_validation_status: HUMAN_VALIDATION_STATUS,
  };
}