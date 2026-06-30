/**
 * Calcul DÉTERMINISTE de la durée d'un exercice (metadata.time_limit_seconds).
 *
 * Pourquoi ce module existe :
 * Avant, la durée était soit imposée arbitrairement par un prompt IA
 * (ex: "DOIT etre fixe a 720") sans lien avec le contenu réellement généré,
 * soit absente de tout schéma (l'IA inventait une valeur), soit héritée
 * telle quelle d'un exercice de séance recyclé en devoir.
 * Résultat observé : CO2 (référence TCF ~50s) affiché avec un minuteur
 * de 12 minutes pour 3 questions.
 *
 * Ce module est volontairement une fonction PURE (aucun appel IA, aucun I/O)
 * afin d'être 100% testable et déterministe, conformément à la discipline
 * "tests-first" du projet. Elle doit être appelée en DERNIER, juste avant
 * la persistance de l'exercice (insert ou update), pour écraser toute
 * valeur de durée fournie en amont (IA, héritage, défaut codé) par une
 * valeur calculée à partir du contenu réel.
 */

// Reprend les plages officielles TCF IRN (cf. exercise-validator.ts TCF_DURATIONS)
// pour rester cohérent avec le seul autre garde-fou existant.
const TCF_DURATIONS: Record<string, [number, number]> = {
  CO1: [30, 60], CO2: [40, 70], CO3: [30, 60], CO4: [40, 70],
  CE1: [60, 100], CE2: [60, 100], CE3: [60, 100], CE4: [80, 130],
  EO1: [90, 150], EO2: [120, 220], EO3: [90, 150], EO4: [90, 150],
  EE1: [240, 360], EE2: [480, 720], EE3: [480, 720],
};

// Bornes de sécurité absolues : jamais < 20s (illisible), jamais > 20 min
// (au-delà, ce n'est plus un exercice court, c'est un bug en attente).
const ABSOLUTE_MIN_SECONDS = 20;
const ABSOLUTE_MAX_SECONDS = 1200;

const SECONDS_PER_ITEM = 45; // lecture question + options + décision, par item QCM/VF/etc.
const FIXED_MARGIN_SECONDS = 15; // marge de confort (lecture consigne, clic)
const FRENCH_TTS_WORDS_PER_SECOND = 2.2; // débit oral FLE lent (~130 mots/min)
const FRENCH_READING_WORDS_PER_SECOND = 1.6; // lecture apprenant A1/A2, plus lent qu'un natif

function countWords(text: unknown): number {
  if (typeof text !== "string" || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface DurationInput {
  competence?: string;
  format?: string;
  metadata?: { code?: string } | null;
  contenu?: {
    items?: unknown[];
    script_audio?: string;
    texte?: string;
  } | null;
  nombre_ecoutes_max?: number | null;
}

/**
 * Calcule une durée en secondes cohérente avec le contenu réellement généré.
 * Si un code TCF IRN connu est présent (ex: "CO2"), le résultat est en plus
 * borné à la plage officielle [min*0.7, max*1.3] (même tolérance que le
 * validateur), pour ne jamais s'en écarter de façon aberrante.
 */
export function computeExerciseDuration(ex: DurationInput): number {
  const competence = (ex.competence ?? "").trim();
  const items = Array.isArray(ex.contenu?.items) ? ex.contenu!.items! : [];
  const nbItems = items.length;
  const itemsTime = nbItems * SECONDS_PER_ITEM;

  let seconds: number;

  if (competence === "CO") {
    const scriptWords = countWords(ex.contenu?.script_audio);
    const ecoutes = clamp(ex.nombre_ecoutes_max ?? 2, 1, 10);
    const audioTime = scriptWords > 0 ? (scriptWords / FRENCH_TTS_WORDS_PER_SECOND) * ecoutes : 0;
    seconds = audioTime + itemsTime + FIXED_MARGIN_SECONDS;
  } else if (competence === "CE") {
    const texteWords = countWords(ex.contenu?.texte);
    const readingTime = texteWords > 0 ? texteWords / FRENCH_READING_WORDS_PER_SECOND : 0;
    seconds = readingTime + itemsTime + FIXED_MARGIN_SECONDS;
  } else if (competence === "EO") {
    // Pas d'items à lire : durée pilotée par le type de tâche (code), avec un
    // défaut raisonnable si le code est absent ou inconnu.
    seconds = 150;
  } else if (competence === "EE") {
    seconds = 360;
  } else {
    // Structures, ou compétence non reconnue : formule générique par items.
    seconds = nbItems > 0 ? itemsTime + FIXED_MARGIN_SECONDS : 60;
  }

  // Garde-fou : si un code TCF IRN connu est fourni, on ne s'en écarte jamais
  // au-delà de la même tolérance que le validateur (0.7x / 1.3x).
  const code = ex.metadata?.code;
  if (code && TCF_DURATIONS[code]) {
    const [min, max] = TCF_DURATIONS[code];
    seconds = clamp(seconds, min * 0.7, max * 1.3);
  }

  return Math.round(clamp(seconds, ABSOLUTE_MIN_SECONDS, ABSOLUTE_MAX_SECONDS));
}
