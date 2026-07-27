const B2_WORKED_EXAMPLES = {
  "lexique-association": {
    format: "appariement",
    instruction: "Dans la phrase, choisissez le groupe de mots qui peut remplacer l’expression soulignée sans changer le sens.",
    question: "Le médecin fixe une consultation pour vendredi matin.",
    highlighted_text: "une consultation",
    options: ["un rendez-vous", "un retard", "un bagage"],
    response: "un rendez-vous",
    completed_response: "Le médecin fixe un rendez-vous pour vendredi matin.",
    explanation_steps: [
      "Je repère l’expression soulignée : « une consultation ».",
      "Je cherche une expression qui désigne également une rencontre prévue.",
      "Je choisis « un rendez-vous » et je vérifie que la phrase conserve le même sens.",
    ],
  },
  "lexique-texte-lacunaire": {
    format: "texte_lacunaire",
    instruction: "Complétez la phrase avec un seul mot.",
    question: "Le train arrive avec dix minutes de ________.",
    response: "retard",
    completed_response: "Le train arrive avec dix minutes de retard.",
    explanation_steps: [
      "Je lis toute la phrase.",
      "Je repère l’expression « dix minutes de ».",
      "Le mot « retard » rend la phrase complète et cohérente.",
    ],
  },
  "lexique-reemploi-oral": {
    format: "production_orale",
    instruction: "Répondez oralement en deux phrases complètes.",
    question: "Présentez un lieu utile de votre quartier et dites pourquoi vous y allez.",
    response: "Je vais souvent à la bibliothèque de mon quartier. J’y emprunte des livres et je travaille au calme.",
    completed_response: "Le modèle nomme un lieu, puis explique clairement son utilité.",
    explanation_steps: [
      "Je nomme précisément le lieu.",
      "J’utilise un verbe d’action.",
      "J’ajoute une raison dans une deuxième phrase.",
    ],
  },
  "support-visuel": {
    format: "texte_lacunaire",
    instruction: "Observez le panneau, puis complétez la phrase avec un mot.",
    question: "La flèche verte indique la ________ du bâtiment.",
    response: "sortie",
    completed_response: "La flèche verte indique la sortie du bâtiment.",
    explanation_steps: [
      "Je repère la flèche et sa direction.",
      "J’identifie ce qu’elle signale.",
      "J’écris « sortie » dans l’espace.",
    ],
  },
  "support-visuel-ouvert": {
    format: "production_ecrite",
    instruction: "Décrivez le message du panneau en deux phrases.",
    question: "Un panneau montre une flèche verte dirigée vers une porte. Expliquez son utilité.",
    response: "Ce panneau indique le chemin vers une porte de sortie. Il aide les personnes à quitter le bâtiment rapidement.",
    completed_response: "La première phrase décrit le message ; la seconde explique son utilité.",
    explanation_steps: [
      "Je décris seulement les éléments visibles.",
      "J’explique ensuite la fonction du panneau.",
      "Je relie les deux idées dans des phrases complètes.",
    ],
  },
  "co-dialogue": {
    format: "qcm",
    instruction: "Lisez le mini-dialogue, puis choisissez l’information exacte.",
    question: "« Votre rendez-vous est jeudi à quinze heures. » Quand a lieu le rendez-vous ?",
    options: ["jeudi à 15 h", "vendredi à 15 h", "jeudi à 17 h"],
    response: "jeudi à 15 h",
    completed_response: "La réponse correcte est « jeudi à 15 h ».",
    explanation_steps: [
      "Je cherche le jour annoncé.",
      "Je repère ensuite l’heure.",
      "Je choisis l’option qui reprend les deux informations sans les modifier.",
    ],
  },
  "co-comprehension": {
    format: "texte_lacunaire",
    instruction: "Complétez la phrase avec le mot entendu dans le mini-message.",
    question: "Mini-message : « Le bureau ne reçoit personne cet après-midi. » Le bureau est ________ cet après-midi.",
    response: "fermé",
    completed_response: "Le bureau est fermé cet après-midi.",
    explanation_steps: [
      "Je repère que le bureau ne reçoit personne.",
      "Je reformule cette information avec un adjectif.",
      "J’écris « fermé ».",
    ],
  },
  "co-approfondissement": {
    format: "production_ecrite",
    instruction: "Reformulez l’idée du mini-dialogue sans reprendre exactement les mêmes mots.",
    question: "« Je ne pourrai pas venir aujourd’hui ; pouvons-nous choisir une autre date ? » Reformulez la demande.",
    response: "La personne demande de reporter la rencontre à une autre date.",
    completed_response: "La reformulation conserve l’impossibilité de venir et la demande de changement.",
    explanation_steps: [
      "Je repère les deux informations importantes.",
      "Je remplace les mots du dialogue par une formulation équivalente.",
      "Je vérifie que je n’ajoute aucune information.",
    ],
  },
  "atelier-1": {
    format: "qcm",
    instruction: "Lisez la situation, puis choisissez la réponse qui reprend exactement l’information donnée.",
    question: "Le message indique : « La réunion commence à seize heures. » À quelle heure commence-t-elle ?",
    options: ["à 16 h", "à 14 h", "à 18 h"],
    response: "à 16 h",
    completed_response: "La réponse correcte est « à 16 h ».",
    explanation_steps: [
      "Je cherche l’heure dans le message.",
      "Je compare cette heure aux trois propositions.",
      "Je sélectionne l’option identique.",
    ],
  },
  structures: {
    format: "transformation",
    instruction: "Transformez la phrase au passé composé en conservant son sens.",
    question: "Nous envoyons le formulaire aujourd’hui.",
    response: "Nous avons envoyé le formulaire hier.",
    completed_response: "Le verbe « envoyer » devient « avons envoyé » au passé composé.",
    explanation_steps: [
      "Je repère le sujet « nous ».",
      "J’utilise l’auxiliaire « avoir » : « avons ».",
      "J’ajoute le participe passé « envoyé » et j’adapte le repère temporel.",
    ],
  },
  eo: {
    format: "production_orale",
    instruction: "Donnez votre avis, puis justifiez-le avec un exemple.",
    question: "Est-il utile de préparer ses documents avant un rendez-vous ?",
    response: "Oui, c’est utile, car on évite d’oublier une pièce importante. Par exemple, je prépare une liste la veille.",
    completed_response: "Le modèle donne une opinion, une raison et un exemple concret.",
    explanation_steps: [
      "J’annonce clairement mon opinion.",
      "Je donne une raison avec « car » ou « parce que ».",
      "J’ajoute un exemple précis.",
    ],
  },
  civique: {
    format: "qcm",
    instruction: "Lisez la règle fictive, puis choisissez l’action qui la respecte.",
    question: "Dans cet exemple fictif, le règlement de l’atelier demande de garder les téléphones silencieux. Que faut-il faire ?",
    options: [
      "mettre le téléphone en mode silencieux",
      "augmenter le volume",
      "répondre à chaque appel",
    ],
    response: "mettre le téléphone en mode silencieux",
    completed_response: "La première proposition reprend directement la règle fictive.",
    explanation_steps: [
      "Je repère l’action demandée dans la règle.",
      "Je compare cette action aux propositions.",
      "Je choisis celle qui respecte exactement le texte.",
    ],
  },
  "ee-autonome": {
    format: "production_ecrite",
    instruction: "Rédigez un avis organisé avec une idée, une justification et un exemple.",
    question: "Faut-il prévoir davantage d’espaces calmes dans les bibliothèques ?",
    response: "À mon avis, il faut prévoir davantage d’espaces calmes, car ils facilitent la concentration. Par exemple, les étudiants peuvent y préparer un examen sans être dérangés.",
    completed_response: "Le modèle contient une opinion, un argument et un exemple reliés logiquement.",
    explanation_steps: [
      "Je présente mon opinion.",
      "Je la justifie avec un connecteur.",
      "Je termine par un exemple concret.",
    ],
  },
};

export function buildB2WorkedExample(code, format) {
  const example = B2_WORKED_EXAMPLES[code];
  if (!example) throw new Error(`Exemple corrigé B2 absent pour ${code}`);
  if (example.format !== format) {
    throw new Error(`Format d'exemple incohérent pour ${code}: ${example.format} au lieu de ${format}`);
  }
  return { level: "B2", ...structuredClone(example) };
}

export function getB2WorkedExampleCodes() {
  return Object.keys(B2_WORKED_EXAMPLES);
}
