import { readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDifferentiationLevelContracts,
  getDifferentiationTransformationRule,
  getLevelContract,
  parseDifferentiationLevelStrict,
} from "./lib/differentiation-referential.mjs";
import { validateS01DifferentiationPayload } from "./lib/s01-differentiation-validate.mjs";
import { getS01InstructionPolicyStatus, rewriteS01Instructions } from "./lib/s01-instruction-rewriter.mjs";
import { buildB2WorkedExample } from "./lib/s01-worked-examples.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "s01-v3-data.json");
const OUTPUT_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
const BASELINE_PATH = join(ROOT, "content", "curriculum", "v2", "S01-v3", "__snapshots__", "s01-v3-corpus-baseline.json");
const LEVELS = ["A1", "A2", "B1", "B2"];
const SUPPORTED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "production_ecrite", "production_orale", "texte_lacunaire", "transformation"]);

// Formats autocorrigés soumis au plancher de densité de la mission
// (>= 10 items). production_ecrite/production_orale suivent une règle
// différente ("au moins deux productions" / "6 à 10 prises de parole")
// et ne sont pas comparés à ce plancher.
const AUTO_CORRECTED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"]);
const MIN_AUTO_CORRECTED_ITEMS = 10;
const MIN_ORAL_PROMPTS = 6;

async function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temporaryPath, path);
}

// Identifiants canoniques d'activité (S01.XXX), utilisés comme couche
// d'organisation "Activité X sur N" — ils référencent les exercices
// existants, ils n'inventent aucun contenu.
const ACTIVITY_DEFS = [
  { code: "S01.ACCUEIL", title: "Accueil et cinq thèmes civiques", order: 1 },
  { code: "S01.LEXIQUE", title: "Lexique de la séance", order: 2 },
  { code: "S01.CO", title: "Comprendre le dialogue d'accueil", order: 3 },
  { code: "S01.ATELIER", title: "Atelier différencié — identité", order: 4 },
  { code: "S01.STRUCTURES", title: "Structures utiles", order: 5 },
  { code: "S01.CIVIQUE", title: "Droits, devoirs et règles", order: 6 },
  { code: "S01.PRODUCTION", title: "Production orale et écrite", order: 7 },
];

function itemFrom(source) {
  return {
    question: source.question ?? source.enonce ?? source.prompt ?? "",
    options: source.options,
    bonne_reponse: source.reponse ?? source.bonne_reponse ?? "",
    explication: source.justification ?? source.criteres ?? undefined,
  };
}

// Fixe un bug de sécurité/pédagogie signalé en relecture indépendante
// (2026-07-13) : un item d'appariement avec une seule option (= la bonne
// réponse) ne demande aucun choix réel à l'apprenant. Construit un jeu
// d'options réel : la bonne définition + N distracteurs pris parmi les
// AUTRES définitions déjà rédigées dans la même liste (contenu réel, pas
// inventé — cf. rapport de référence §8 : confusion entre deux
// informations présentes est un distracteur légitime).
function buildAppariementOptions(entries, index, getLabel, distractorCount = 3) {
  const correct = getLabel(entries[index]);
  const distractors = [];
  for (let offset = 1; distractors.length < distractorCount && offset < entries.length; offset += 1) {
    const candidate = getLabel(entries[(index + offset) % entries.length]);
    if (candidate !== correct) distractors.push(candidate);
  }
  // Ordre déterministe (pas de mélange aléatoire) : la bonne réponse est
  // toujours insérée à une position dérivée de l'index pour éviter qu'elle
  // soit systématiquement en première position.
  const options = [...distractors];
  options.splice(index % (options.length + 1), 0, correct);
  return options;
}
// Masque le mot cible dans son exemple réel. B1/B2 doivent l'identifier à
// partir du contexte : recopier la réponse dans la question annulerait toute
// mesure de compréhension lexicale.
function maskLexicalTarget(example, target) {
  const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let masked = String(example).replace(new RegExp(escapeRegex(target), "giu"), "________");
  // Le lexique peut donner un infinitif alors que l'exemple emploie sa forme
  // conjuguée (progresser -> progresse). On masque alors le radical réel,
  // sans inventer une nouvelle phrase.
  if (masked === example && /er$/iu.test(String(target))) {
    const stem = String(target).slice(0, -2);
    masked = String(example).replace(new RegExp(`${escapeRegex(stem)}\\p{L}*`, "giu"), "________");
  }
  if (masked === example) {
    throw new Error(`Mot lexical absent de son exemple : ${target}`);
  }
  return masked;
}

// Corrige un bug du générateur v1 : un point de grammaire dont le
// gabarit est UNE seule phrase à plusieurs trous (items.length === 1)
// mais dont reponses.length > 1 ne produisait qu'un seul item, en
// perdant silencieusement les réponses suivantes. On expose ici un
// sous-item par trou réel, sans ajouter aucune réponse inventée.
export function expandGrammarPoint(point) {
  const questions = Array.isArray(point?.items) ? point.items : [];
  const answers = Array.isArray(point?.reponses) ? point.reponses : [];
  const isMultiGapTemplate = questions.length === 1 && answers.length > 1;

  if (!isMultiGapTemplate && questions.length !== answers.length) {
    throw new Error(
      `Structures "${point?.point ?? "sans titre"}" : ${questions.length} question(s) pour ${answers.length} reponse(s).`,
    );
  }

  if (isMultiGapTemplate) {
    return answers.map((reponse, index) => ({
      question: `${questions[0]} (trou ${index + 1} sur ${answers.length})`,
      bonne_reponse: reponse,
      explication: point.point,
    }));
  }
  return questions
    .map((question, index) => ({
      question,
      bonne_reponse: answers[index],
      explication: point.point,
    }))
    // Exclut les lignes "(modèle)" : un exemple résolu donné en énoncé,
    // pas un item gradable (cf. grammaire B1 "nationalité/pays-ville").
    .filter((entry) => entry.bonne_reponse && !/^\(.*\)$/.test(entry.bonne_reponse));
}

// ------------------------------------------------------------
// support-visuel : dérive les vraies réponses depuis
// data.visual.scene.elements (jamais de placeholder "Réponse attendue dans
// le support visuel"). Reconstruit les cinq panneaux (rect + libellés
// texte associés) dans leur ordre réel gauche->droite, et classe leur
// couleur par calcul RVB (pas un nom de couleur asserté à la main).
// ------------------------------------------------------------

function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

// Classification déterministe par dominance de canal RVB — pas une liste de
// couleurs mémorisée à la main : recalculée depuis le fill réel de chaque
// panneau.
function nameLightColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  if (r - g > 20 && Math.abs(g - b) < 10) return "rouge clair";
  if (b > r && b > g && g - r >= 10) return "bleu clair";
  if (b > r && b > g) return "violet clair";
  if (g > r && g > b) return "vert clair";
  if (r > b && g > b) return "jaune clair";
  return "couleur claire";
}

function deriveVisualThemes(scene) {
  const panels = [];
  let current = null;
  for (const element of scene.elements) {
    if (element.type === "rect") {
      current = { x: element.x, fill: element.fill, lines: [] };
      panels.push(current);
    } else if (element.type === "text" && current) {
      current.lines.push(element.text);
    }
  }
  return panels
    .sort((a, b) => a.x - b.x)
    .map((panel) => ({ x: panel.x, fill: panel.fill, color: nameLightColor(panel.fill), label: panel.lines.join(" ") }));
}

// ------------------------------------------------------------
// Différenciation réelle : garde-fous et corrections communs (Lot 2).
// ------------------------------------------------------------

// Lot 2.1, point 3 : un indice A1 pédagogique doit orienter vers la
// ZONE/l'opération à réaliser, jamais fournir littéralement la réponse.
// Dérivé MÉCANIQUEMENT de la question elle-même (jamais de la
// justification/preuve, qui contient presque toujours la réponse) : une
// question bien formée ne contient jamais sa propre réponse, donc ce
// gabarit ne peut pas fuiter par construction — vérifié par
// indice-validator.mjs, pas seulement supposé.
function orientingIndiceFromQuestion(question, locus) {
  const trimmed = String(question ?? "").replace(/[?!.]+$/, "").trim();
  const lower = trimmed.length > 0 ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
  return `Repérez, dans ${locus}, le passage qui répond à : « ${lower} ».`;
}

// Réduit un jeu d'options à `maxOptions` en GARANTISSANT que la bonne
// réponse y figure toujours (jamais un options.slice(0, n) aveugle qui
// pourrait la couper si elle n'est pas dans les n premières). Les
// distracteurs retenus sont les options réelles déjà rédigées dans la
// source (pas des inventions), dans leur ordre d'origine.
function ensureAnswerInOptions(allOptions, correctAnswer, maxOptions) {
  if (!Array.isArray(allOptions) || allOptions.length <= maxOptions) return allOptions;
  const distractors = allOptions.filter((option) => option !== correctAnswer).slice(0, Math.max(0, maxOptions - 1));
  const options = [...distractors];
  const insertAt = options.length > 0 ? allOptions.indexOf(correctAnswer) % (options.length + 1) : 0;
  options.splice(Math.max(0, insertAt), 0, correctAnswer);
  return options;
}

// Correction serveur d'un item fermé (QCM/vrai_faux/appariement/etc.) :
// jamais envoyée au client avant libération (le champ `correction` n'est
// pas dans la liste blanche du sanitizer). `preuve` est toujours une
// citation réelle déjà présente dans la source (justification/explication
// du gabarit d'origine) — jamais un texte inventé au cas par cas.
function closedItemCorrection({ options, bonneReponse, preuve }) {
  const distracteurs = (options ?? []).filter((option) => option !== bonneReponse);
  return {
    bonne_reponse: bonneReponse,
    preuve_support: preuve ?? null,
    explication_distracteurs: preuve
      ? distracteurs.map((option) => `« ${option} » ne correspond pas à ce qu'indique le support : « ${preuve} ».`)
      : [],
    // Catégorie générique honnête (mécanique, pas une analyse bespoke par
    // distracteur) : ces distracteurs proviennent tous d'une confusion
    // possible entre deux informations présentes dans le support — cf.
    // rapport de référence §8.
    erreur_diagnostiquee: "confusion_information_presente",
    remediation: preuve
      ? `Relisez la phrase du support : « ${preuve} » puis répondez à nouveau.`
      : "Relisez le support puis répondez à nouveau.",
  };
}

// Correction serveur d'une justification ouverte (companion B1/B2) :
// dérivée mécaniquement de la même preuve réelle que closedItemCorrection
// (pas d'analyse pédagogique bespoke par item — limite documentée dans le
// rapport de mission).
function openJustificationCorrection(preuve) {
  return {
    elements_attendus: preuve ? [preuve] : [],
    formulations_acceptables: preuve ? [preuve] : [],
    exemple_non_exclusif: preuve ?? null,
    erreurs_frequentes: ["justification absente ou trop vague", "justification sans lien avec le passage cité"],
    remediation: preuve
      ? `Citez ou reformulez précisément : « ${preuve} ».`
      : "Citez un passage précis du support pour justifier votre réponse.",
    criteres_evaluation: [
      "cite ou reformule fidèlement un élément réel du support",
      "relie explicitement la citation à la réponse donnée",
    ],
  };
}

function exercise({
  code, title, competence, format, level, instruction, items, source,
  duration = 420, familyId = null, extensionOf = null, activityCode = null,
  civicContent = false, civicFactIds = [], appliedTransformations = [],
  sourceLevel = "A2", forceNeedsContentReview = false,
}) {
  const strictLevel = parseDifferentiationLevelStrict(level);
  if (!SUPPORTED_FORMATS.has(format)) throw new Error(`Format non supporté: ${format}`);
  // Lot 2.1, point 7 : toute transformation déclarée non supportée
  // (DIFF_TRANSFORMATION_NOT_SUPPORTED) rend AUTOMATIQUEMENT l'exercice non
  // publiable — jamais seulement un avertissement informatif. Un item
  // civique marqué needs_review (provenance non validée) a le même effet.
  // Le blocage existant (needs_content_review -> submit-seance-answer
  // refuse l'exercice) est réutilisé, pas dupliqué.
  const hasUnsupportedTransformation = appliedTransformations.some((t) => t.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED");
  const belowFloor = (AUTO_CORRECTED_FORMATS.has(format) && items.length < MIN_AUTO_CORRECTED_ITEMS)
    || forceNeedsContentReview
    || hasUnsupportedTransformation;
  const levelContract = getLevelContract(competence, strictLevel);
  const transformation = getDifferentiationTransformationRule(sourceLevel, strictLevel);
  const referential = getDifferentiationLevelContracts();
  const workedExample = strictLevel === "B2" ? buildB2WorkedExample(code, format) : null;
  return {
    metadata_code: `cv2:S01:v3:${code}:${strictLevel}`,
    titre: title,
    consigne: instruction,
    competence,
    format,
    niveau_vise: strictLevel,
    difficulte: { A1: 2, A2: 4, B1: 6, B2: 8 }[strictLevel],
    duree_limite_secondes: duration,
    source,
    family_id: familyId,
    extension_of_family_id: extensionOf,
    civic_content: civicContent,
    civic_fact_ids: civicFactIds,
    contenu: {
      items,
      ...(workedExample ? { worked_example: workedExample } : {}),
      metadata: {
        session_code: "S01",
        activity_code: activityCode,
        source_level: sourceLevel,
        target_level: strictLevel,
        competence_invariante: familyId ? competence : null,
        // Référentiel réellement consommé (Lot 1), plus la carte littérale
        // remplacée : cognitive_operations/autonomy/guidance viennent de
        // getLevelContract(competence, level), pas d'une carte figée ici.
        referential_version: referential.schema_version,
        level_contract: levelContract,
        transformation_id: transformation?.id ?? null,
        // Preuves structurées des transformations RÉELLEMENT appliquées à
        // cet exercice (champ modifié, pas une simple métadonnée déclarée) —
        // vide pour les familles où seul le branchement métadonnée a été
        // fait sans réécriture de contenu à ce lot.
        applied_transformations: appliedTransformations,
        cognitive_operations: levelContract?.cognitive_operations ?? [],
        autonomy: levelContract?.autonomy ?? null,
        guidance: levelContract?.guidance ?? null,
        trainer_preview_required: true,
        interactive: true,
        worked_example_required: strictLevel === "B2",
        // Documente honnêtement un manque de matière première réel
        // (banque/contenu source insuffisants) plutôt que de fabriquer
        // des items pour atteindre le plancher — voir rapport de mission.
        needs_content_review: belowFloor,
      },
    },
  };
}

export async function buildInteractiveS01({ writeOutput = !process.env.VITEST } = {}) {
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
  let exercises = [];

  // ------------------------------------------------------------
  // Lexique — glossaire interactif (S01.LEXIQUE). Réutilise
  // l'intégralité des 10 mots déjà rédigés dans data.lexique.mots
  // (auparavant totalement ignorés par le générateur) pour
  // l'appariement, au lieu des 3 paires isolées de
  // lexique_exercices[0] : même contenu réel, simplement complet.
  // ------------------------------------------------------------
  // Lot 2 — lexique-association : dix mots (data.lexique.mots), format
  // appariement et compétence CE conservés à tous les niveaux. « droit » et
  // « devoir » sont les deux seuls mots dont le sens est assez proche pour
  // justifier une distinction lexicale réelle (les huit autres sont
  // lexicalement distincts entre eux d'après les définitions du lexique) :
  // la justification et le forçage du distracteur voisin ne portent QUE sur
  // ces deux mots, jamais généralisés ni inventés pour les autres.
  const LEXIQUE_CLOSE_TERMS = { droit: "devoir", devoir: "droit" };

  for (const level of LEVELS) {
    const lexiqueAppliedTransformations = [];
    const reversedFormat = level === "B1" || level === "B2";
    const lexiqueItems = data.lexique.mots.map((entry, index) => {
      const closeTerm = LEXIQUE_CLOSE_TERMS[entry.mot] ?? null;

      if (reversedFormat) {
        // B1/B2 : exemple d'emploi réel -> mot approprié (relier un usage à
        // un mot, pas mémoriser une définition) — différenciation par le
        // format de la tâche, pas seulement le nombre de distracteurs.
        let options = buildAppariementOptions(data.lexique.mots, index, (m) => m.mot, 3);
        if (closeTerm && level === "B2" && !options.includes(closeTerm)) {
          // B2 uniquement : force la discrimination entre les deux termes
          // proches en incluant le mot voisin réel comme distracteur.
          options = options.filter((option) => option !== entry.mot).slice(0, 2);
          options = Array.from(new Set([...options, closeTerm, entry.mot]));
        }
        const maskedExample = maskLexicalTarget(entry.exemple, entry.mot);
        const item = {
          question: maskedExample,
          options,
          bonne_reponse: entry.mot,
          explication: entry.definition_simple,
        };
        lexiqueAppliedTransformations.push({
          rule_id: level === "B2" ? "A2_TO_B2" : "A2_TO_B1",
          applied_to: `items[${index}].question`,
          evidence: `Format inversé : le mot cible est masqué dans l'exemple réel (« ${maskedExample} ») ; la réponse doit être inférée du contexte.`,
        });
        if (level === "B2" || closeTerm) {
          item.justification_required = true;
          item.justification_type = level === "B2" ? "contextual_nuance" : "lexical_distinction";
          item.justification_prompt = level === "B2"
            ? "Expliquez quels éléments de la phrase vous ont aidé et pourquoi une autre proposition ne convient pas."
            : "Expliquez quels éléments de la phrase vous ont aidé et pourquoi une autre proposition ne convient pas.";
          lexiqueAppliedTransformations.push({
            rule_id: level === "B2" ? "A2_TO_B2" : "A2_TO_B1",
            applied_to: `items[${index}].justification_prompt`,
            evidence: level === "B2"
              ? "B2 : justification contextuelle et discrimination du distracteur le plus proche exigées pour chaque item."
              : `« ${entry.mot} » et « ${closeTerm} » sont sémantiquement proches dans le lexique réel de la séance : justification demandée, aucune nuance inventée.`,
          });
        }
        item.correction = closedItemCorrection({ options: item.options, bonneReponse: entry.mot, preuve: entry.definition_simple });
        if (item.justification_prompt) item.correction.justification_ouverte = openJustificationCorrection(entry.definition_simple);
        return item;
      }

      // A1/A2 : mot -> définition (format d'origine). A1 = 1 distracteur +
      // exemple visible en aide ; A2 = 2 distracteurs, reste le pivot.
      const distractorCount = level === "A1" ? 1 : 2;
      const options = buildAppariementOptions(data.lexique.mots, index, (m) => m.definition_simple, distractorCount);
      const item = {
        question: entry.mot,
        options,
        bonne_reponse: entry.definition_simple,
        explication: entry.exemple,
      };
      if (level === "A1") {
        // Reformulé en consigne (jamais l'exemple brut identique à
        // explication/preuve_support — Lot 2.1, point 3) : le fait réel
        // reste le même exemple, la formulation d'indice est distincte de
        // la donnée de corrigé.
        item.indice = `Cette phrase peut vous aider à choisir : « ${entry.exemple} »`;
        lexiqueAppliedTransformations.push({
          rule_id: "A2_TO_A1",
          applied_to: `items[${index}].indice`,
          evidence: `Exemple d'emploi réel affiché en aide (reformulé, distinct de explication/preuve_support) ; options réduites à ${options.length} avec bonne réponse garantie.`,
        });
      }
      item.correction = closedItemCorrection({ options, bonneReponse: entry.definition_simple, preuve: entry.exemple });
      return item;
    });

    exercises.push(exercise({
      code: "lexique-association",
      title: reversedFormat ? "Compléter des phrases avec le mot juste" : "Associer chaque mot à sa définition",
      competence: "CE",
      format: "appariement",
      level,
      instruction: level === "B2"
        ? "Dans chaque phrase, un mot manque. Choisissez parmi les quatre propositions le mot qui complète correctement la phrase. Ensuite, expliquez quels éléments de la phrase vous ont aidé et pourquoi une autre proposition ne convient pas."
        : level === "B1"
          ? "Dans chaque phrase, un mot manque. Choisissez parmi les quatre propositions le mot qui complète correctement la phrase."
          : "Associez chaque mot de la séance à sa définition simplifiée.",
      items: lexiqueItems,
      source: data.lexique.resource_id,
      duration: 420,
      activityCode: "S01.LEXIQUE",
      appliedTransformations: lexiqueAppliedTransformations,
    }));

    // Lot 2 — lexique-texte-lacunaire : mêmes trois trous (data...reponses)
    // à tous les niveaux, jamais réduits pour "simplifier" A1 ni étendus
    // pour "densifier" B2.
    const texteLacunaire = data.lexique_exercices.find((entry) => entry.type === "texte_lacunaire");
    // Ordre alphabétique déterministe (jamais l'ordre des trous dans le
    // texte) : une banque ordonnée comme les trous révélerait la réponse.
    const texteLacunaireBanque = [...texteLacunaire.reponses].sort((a, b) => a.localeCompare(b, "fr"));
    const tlAppliedTransformations = [];
    const texteLacunairePhrases = texteLacunaire.texte.split(/(?<=\.)\s+/).filter((phrase) => phrase.includes("........"));
    if (texteLacunairePhrases.length !== texteLacunaire.reponses.length) {
      throw new Error(`S01 texte lacunaire incohérent : ${texteLacunairePhrases.length} phrases pour ${texteLacunaire.reponses.length} réponses.`);
    }
    const tlItems = texteLacunaire.reponses.map((reponse, index) => {
      const phraseAvecTrou = texteLacunairePhrases[index].replace(/\(\.{4,}\)/, "________");
      const phraseCorrigee = texteLacunairePhrases[index].replace(/\(\.{4,}\)/, reponse);
      const item = { question: phraseAvecTrou, bonne_reponse: reponse };

      if (level === "A1" || level === "A2") {
        item.banque_mots = texteLacunaireBanque;
        if (level === "A1") {
          item.indice = "Cherchez, parmi les mots de la banque, celui dont le sens correspond à cette partie de la phrase.";
          tlAppliedTransformations.push({
            rule_id: "A2_TO_A1",
            applied_to: `items[${index}].indice`,
            evidence: "Amorce ajoutée en plus de la banque de mots (guidage fort) ; aucun mot de la banque n'est associé au trou.",
          });
        }
      } else {
        // B1/B2 : banque supprimée (autonomie forte/très forte),
        // justification contextuelle obligatoire.
        item.justification_required = true;
        item.justification_type = "contextual";
        item.justification_prompt = "Justifiez votre choix à partir du sens de la phrase (pourquoi ce mot et pas un autre ?).";
        tlAppliedTransformations.push({
          rule_id: level === "B2" ? "A2_TO_B2" : "A2_TO_B1",
          applied_to: `items[${index}].justification_prompt`,
          evidence: "Banque de mots supprimée, justification contextuelle obligatoire ajoutée.",
        });
        if (level === "B2") {
          // Ces trois trous acceptent chacun un seul mot cohérent avec le
          // contexte (pas deux mots proches en concurrence) : aucun effet de
          // sens/nuance supplémentaire n'est présent dans ce texte au-delà
          // de la justification contextuelle déjà demandée à B1.
          tlAppliedTransformations.push({
            rule_id: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
            applied_to: `items[${index}].justification_prompt`,
            evidence: "Aucun effet de sens entre mots proches n'est présent pour ce trou : justification contextuelle simple maintenue plutôt qu'une nuance inventée.",
          });
        }
      }

      item.correction = closedItemCorrection({ options: null, bonneReponse: reponse, preuve: phraseCorrigee });
      if (item.justification_prompt) item.correction.justification_ouverte = openJustificationCorrection(phraseCorrigee);
      return item;
    });

    exercises.push(exercise({
      code: "lexique-texte-lacunaire",
      title: texteLacunaire.titre,
      competence: "CE",
      format: "texte_lacunaire",
      level,
      instruction: `${texteLacunaire.consigne} ${texteLacunaire.texte}`,
      items: tlItems,
      source: texteLacunaire.source,
      duration: 300,
      appliedTransformations: tlAppliedTransformations,
      activityCode: "S01.LEXIQUE",
    }));
  }

  const reemploiOral = data.lexique_exercices.find((entry) => entry.type === "reemploi_oral");
  for (const level of LEVELS) {
    exercises.push(exercise({
      code: "lexique-reemploi-oral",
      title: reemploiOral.titre,
      competence: "EO",
      format: "production_orale",
      level,
      instruction: reemploiOral.consigne,
      items: [{ question: reemploiOral.consigne, bonne_reponse: reemploiOral.critere }],
      source: reemploiOral.source,
      duration: 180,
      extensionOf: "S01_CO_ACCUEIL_01",
      activityCode: "S01.LEXIQUE",
    }));
  }

  // ------------------------------------------------------------
  // Support visuel — 5 questions d'exploitation (S01.ACCUEIL),
  // jusqu'ici jamais exposées par le générateur.
  // ------------------------------------------------------------
  const visualThemes = deriveVisualThemes(data.visual.scene);
  const visualOrderAnswer = visualThemes.map((theme) => theme.label).join(", ");
  const redPanelTheme = visualThemes.find((theme) => theme.color === "rouge clair");
  // Trois questions fermées réelles (support-visuel) : nombre de thèmes,
  // ordre réel gauche->droite, thème du panneau rouge clair — les trois
  // calculées depuis data.visual.scene.elements, plus de placeholder.
  const VISUAL_ANSWERS = [
    visualThemes.length === 5 ? "Cinq" : String(visualThemes.length),
    visualOrderAnswer,
    redPanelTheme ? redPanelTheme.label : null,
  ];
  const visualLegend = visualThemes.map((theme) => `${theme.color} : ${theme.label}`).join(" | ");

  for (const level of LEVELS) {
    const visuelAppliedTransformations = [];
    const visuelItems = data.visual_questions.slice(0, 3).map((question, index) => {
      const item = { question, bonne_reponse: VISUAL_ANSWERS[index] };

      if (level === "A1") {
        // Légende explicite couleur -> thème (repérage direct) : calculée,
        // pas mémorisée à la main. Support d'observation légitime (Lot 2.1,
        // point 3, cas A) : la réponse EST visible dans le support, la
        // tâche consiste justement à la repérer — marqué assisted_retrieval
        // au lieu d'être traité comme une fuite ou réécrit artificiellement.
        item.indice = visualLegend;
        item.assisted_retrieval = true;
        visuelAppliedTransformations.push({
          rule_id: "A2_TO_A1",
          applied_to: `items[${index}].indice`,
          evidence: "Légende couleur -> thème affichée, dérivée de data.visual.scene.elements (repérage direct, support d'observation : assisted_retrieval=true).",
        });
      } else if (level === "B1" || level === "B2") {
        // Relation/classement fondés UNIQUEMENT sur les libellés visibles —
        // jamais une justification de l'ordre des panneaux (absente du
        // support).
        item.justification_required = true;
        item.justification_type = "support_evidence";
        item.justification_prompt = "Justifiez votre réponse en citant uniquement les libellés ou couleurs visibles sur le schéma.";
        visuelAppliedTransformations.push({
          rule_id: level === "B2" ? "A2_TO_B2" : "A2_TO_B1",
          applied_to: `items[${index}].justification_prompt`,
          evidence: "Justification obligatoire fondée sur les libellés visibles du schéma, sans aide ni légende.",
        });
        if (level === "B2") {
          // Le schéma est une liste plate de cinq thèmes indépendants, sans
          // relation ni hiérarchie déclarée entre eux : aucune synthèse
          // entre catégories n'est possible sans l'inventer.
          visuelAppliedTransformations.push({
            rule_id: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
            applied_to: `items[${index}].justification_prompt`,
            evidence: "Le support ne fournit aucune relation entre catégories (cinq panneaux indépendants) : synthèse non réalisée plutôt qu'inventée.",
          });
        }
      }

      item.correction = closedItemCorrection({ options: null, bonneReponse: item.bonne_reponse, preuve: visualLegend });
      if (item.justification_prompt) item.correction.justification_ouverte = openJustificationCorrection(visualLegend);
      return item;
    });

    exercises.push(exercise({
      code: "support-visuel",
      title: "Les cinq thèmes civiques du parcours",
      competence: "CE",
      format: "texte_lacunaire",
      level,
      instruction: "Observez le schéma des cinq thèmes puis répondez.",
      items: visuelItems,
      source: data.visual.resource_id,
      duration: 240,
      activityCode: "S01.ACCUEIL",
      appliedTransformations: visuelAppliedTransformations,
    }));
    exercises.push(exercise({
      code: "support-visuel-ouvert",
      title: "Votre lien avec les cinq thèmes",
      competence: "EE",
      format: "production_ecrite",
      level,
      instruction: "Répondez en une phrase justifiée à chacune des deux questions.",
      items: data.visual_questions.slice(3).map((question) => ({ question, bonne_reponse: "Réponse ouverte, justifiée par une phrase." })),
      source: data.visual.resource_id,
      duration: 240,
      activityCode: "S01.ACCUEIL",
    }));
  }

  // Lot 2 — co-dialogue : les 10 questions du QCM TCF restent servies à
  // tous les niveaux (même nombre d'items). Seules Q9 (devoir) et Q10
  // (règle) portent, dans la même réplique de Mme Rossi, un contraste
  // explicite entre deux notions voisines — les seules à supporter
  // réellement une nuance B2 au-delà de la justification. Pour les 8
  // autres (identification/chiffres factuels), aucune implication,
  // intention ou registre n'est présent dans le dialogue :
  // DIFF_TRANSFORMATION_NOT_SUPPORTED est déclaré plutôt qu'inventé.
  const CO_DIALOGUE_NUANCE_SUPPORTED_IDS = new Set([9, 10]);

  for (const level of LEVELS) {
    const coAppliedTransformations = [];
    const coItems = data.qcm_tcf.questions.map((question, index) => {
      const preuve = question.justification ?? null;
      const item = { ...itemFrom(question) };

      if (level === "A1") {
        // Jamais options.slice(0, 3) aveugle : la bonne réponse est
        // garantie dans les options réduites, les distracteurs retenus
        // sont deux options réelles déjà rédigées (pas inventées).
        const reduced = ensureAnswerInOptions(question.options, question.reponse, 3);
        item.options = reduced;
        // Indice orienté vers la ZONE du dialogue à réécouter, jamais la
        // réponse elle-même (Lot 2.1, point 3 : la justification réelle
        // contient presque toujours la réponse littéralement — remplacée
        // par un gabarit dérivé de la question, qui ne peut pas fuiter par
        // construction, vérifié par indice-validator.mjs).
        item.indice = orientingIndiceFromQuestion(question.enonce, "le dialogue");
        coAppliedTransformations.push({
          rule_id: "A2_TO_A1",
          applied_to: `items[${index}].indice`,
          evidence: `Indice orienté (zone à réécouter) affiché sans révéler la réponse de la question ${question.id} ; options réduites à ${reduced.length} avec bonne réponse garantie.`,
        });
      } else if (level === "B1") {
        item.justification_required = true;
        item.justification_type = "support_evidence";
        item.justification_prompt = "Justifiez votre choix en citant précisément un mot ou une phrase entendue dans le dialogue.";
        coAppliedTransformations.push({
          rule_id: "A2_TO_B1",
          applied_to: `items[${index}].justification_prompt`,
          evidence: `Justification obligatoire ajoutée (justification_required=true), appuyée sur le support réel de la question ${question.id}.`,
        });
      } else if (level === "B2") {
        item.justification_required = true;
        if (CO_DIALOGUE_NUANCE_SUPPORTED_IDS.has(question.id)) {
          item.justification_type = "nuance";
          item.justification_prompt = "Justifiez votre choix et précisez, avec les mots de Mme Rossi, en quoi cette notion se distingue de la notion voisine (droit/devoir/règle).";
          coAppliedTransformations.push({
            rule_id: "A2_TO_B2",
            applied_to: `items[${index}].justification_prompt`,
            evidence: `Nuance demandée : le dialogue oppose explicitement droit/devoir/règle dans la même réplique (question ${question.id}) — support suffisant, aucune invention.`,
          });
        } else {
          item.justification_type = "support_evidence";
          item.justification_prompt = "Justifiez votre choix en citant précisément un mot ou une phrase entendue dans le dialogue.";
          coAppliedTransformations.push({
            rule_id: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
            applied_to: `items[${index}].justification_prompt`,
            evidence: `Aucune implication/intention/registre n'est présente dans le support pour la question ${question.id} : justification simple maintenue plutôt qu'inventée.`,
          });
        }
      }

      // Correction serveur (jamais transmise au client avant libération —
      // "correction" est hors liste blanche du sanitizer).
      item.correction = closedItemCorrection({
        options: item.options ?? question.options,
        bonneReponse: question.reponse,
        preuve,
      });
      if (item.justification_prompt) {
        item.correction.justification_ouverte = openJustificationCorrection(preuve);
      }
      return item;
    });

    exercises.push(exercise({
      code: "co-dialogue",
      title: "Comprendre le dialogue d'accueil",
      competence: "CO",
      format: "qcm",
      level,
      instruction: data.qcm_tcf.consigne,
      items: coItems,
      source: data.qcm_tcf.resource_id,
      duration: level === "A1" ? 600 : 480,
      familyId: "S01_CO_ACCUEIL_01",
      activityCode: "S01.CO",
      appliedTransformations: coAppliedTransformations,
    }));

    // co-comprehension : 20 questions/micro-tâches sur le dialogue
    // (data.co_questions), jusqu'ici totalement absentes du JSON
    // généré. On ne garde ici que les catégories à réponse déterminée
    // (Compréhension globale / Repérage d'information / Lexique /
    // Vrai-Faux, ids 1-13) — auto-corrigeables par égalité stricte,
    // comme le fait déjà le bloc Structures existant.
    const closedIds = new Set([
      "Compréhension globale", "Repérage d'information", "Lexique", "Vrai/Faux",
    ]);
    const closedQuestions = data.co_questions.filter(
      (q) => q.niveaux.includes(level) && closedIds.has(q.categorie),
    );
    exercises.push(exercise({
      code: "co-comprehension",
      title: "Vingt questions sur le dialogue",
      competence: "CO",
      format: "texte_lacunaire",
      level,
      instruction: "Répondez en une phrase courte, d'après le dialogue.",
      items: closedQuestions.map((q) => ({
        question: q.question,
        bonne_reponse: q.reponse,
        explication: q.categorie,
      })),
      source: data.co.resource_id,
      duration: 600,
      familyId: "S01_CO_ACCUEIL_01",
      activityCode: "S01.CO",
    }));

    // co-approfondissement : Reformulation/Justification (ids 14-18),
    // réponse ouverte -> production_ecrite (évaluée par IA via
    // tcf-evaluate-answer), jamais comparée par égalité stricte de
    // chaîne. N'existe qu'à partir d'A2 (A1 n'a pas ces questions
    // dans co_questions.niveaux, cf. conception pédagogique v3).
    const openQuestions = data.co_questions.filter(
      (q) => q.niveaux.includes(level) && ["Reformulation", "Justification"].includes(q.categorie),
    );
    if (openQuestions.length > 0) {
      exercises.push(exercise({
        code: "co-approfondissement",
        title: "Approfondir : reformuler et justifier",
        // Compétence CO (pas CE) : la réponse est écrite mais la
        // compétence mesurée reste la compréhension du dialogue oral —
        // conserver la même compétence que le reste de la famille
        // S01_CO_ACCUEIL_01 (DIFF_COMPETENCE_CHANGED sinon).
        competence: "CO",
        format: "production_ecrite",
        level,
        instruction: "Répondez avec vos propres mots, en une ou deux phrases par question.",
        items: openQuestions.map((q) => ({ question: q.question, bonne_reponse: q.reponse })),
        source: data.co.resource_id,
        duration: 480,
        familyId: "S01_CO_ACCUEIL_01",
        activityCode: "S01.CO",
      }));
    }

    for (const [index, sourceExercise] of data.ateliers[level].exercices.entries()) {
      const rawItems = sourceExercise.items ?? [sourceExercise];
      exercises.push(exercise({
        code: `atelier-${index + 1}`,
        title: `Atelier ${level} — activité ${index + 1}`,
        competence: sourceExercise.competence,
        format: sourceExercise.format,
        level,
        instruction: sourceExercise.consigne,
        items: rawItems.map(itemFrom),
        source: sourceExercise.source,
        duration: 420,
        activityCode: "S01.ATELIER",
      }));
    }

    const grammarPoints = data.grammaire.filter((point) => point.niveau === level);
    exercises.push(exercise({
      code: "structures",
      title: `Structures utiles — ${level}`,
      competence: "Structures",
      format: level === "B1" || level === "B2" ? "transformation" : "texte_lacunaire",
      level,
      instruction: grammarPoints.map((point) => point.consigne).join(" "),
      items: grammarPoints.flatMap(expandGrammarPoint),
      source: grammarPoints.map((point) => point.source).join(" | "),
      duration: 420,
      activityCode: "S01.STRUCTURES",
    }));

    // EO : inclusion cumulative des prompts des niveaux <= niveau
    // courant (A1 sert d'échauffement à A2, etc.) — chaque prompt
    // reste réel et déjà rédigé dans data.eo_prompts ; on ne fabrique
    // rien, on augmente seulement le nombre de prises de parole
    // proposées par séance pour approcher le plancher de 6-10 exigé
    // par la mission, faute de quoi B1/A2 ne proposaient que 2 prises
    // de parole chacun.
    const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3 };
    const oralPrompts = data.eo_prompts.filter((prompt) => levelRank[prompt.niveau] <= levelRank[level]);
    const extensionOraleQuestions = data.co_questions.filter(
      (q) => q.niveaux.includes(level) && q.categorie === "Extension orale",
    );
    exercises.push(exercise({
      code: "eo",
      title: `Prendre la parole — ${level}`,
      competence: "EO",
      format: "production_orale",
      level,
      instruction: "Enregistrez vos réponses. Vous pourrez réécouter la transcription et le corrigé oral.",
      items: [
        ...oralPrompts.map(itemFrom),
        ...extensionOraleQuestions.map((q) => ({ question: q.question, bonne_reponse: q.reponse })),
      ],
      source: [...new Set(oralPrompts.map((p) => p.source))].join(" | "),
      duration: 480,
      extensionOf: "S01_CO_ACCUEIL_01",
      activityCode: "S01.PRODUCTION",
    }));
  }

  // Lot 2 — civique : servi à TOUS les niveaux, dix items conservés à
  // chaque niveau. Contenu linguistique (énoncés/options) identique par
  // manque de variante par niveau dans la source — gap documenté, pas une
  // simplification réalisée ici : la différenciation porte sur l'étayage
  // (indice), l'exigence de justification et la profondeur d'analyse
  // demandée, jamais sur les faits eux-mêmes.
  //
  // Seules les questions dont l'énoncé oppose explicitement deux notions
  // parmi droit/devoir/règle/démarche supportent réellement une analyse
  // distinctive B2 ; les questions purement factuelles (durées, comptages)
  // ne le supportent pas et déclarent DIFF_TRANSFORMATION_NOT_SUPPORTED.
  const CIVIQUE_CATEGORY_QUESTION_INDEXES = new Set([0, 1, 2, 5, 8]);

  for (const level of LEVELS) {
    const civiqueAppliedTransformations = [];
    let civiqueNeedsReview = false;
    const civiqueItems = data.qcm_civique.questions.map((question, index) => {
      const item = itemFrom(question);
      const preuve = question.justification ?? null;

      // Provenance réelle non validée (statut Supabase != validated_auto) :
      // l'item — donc tout l'exercice pour ce niveau — reste non publiable.
      // Jamais une validation générée : seule une revue humaine réelle lève
      // ce statut (cf. checklist readiness différenciation S01).
      if (!String(question.source ?? "").includes("validated_auto")) {
        item.needs_review = true;
        civiqueNeedsReview = true;
      }

      if (level === "A1") {
        // Indice orienté vers la règle à relire dans l'énoncé, jamais la
        // réponse elle-même (Lot 2.1, point 3) — la justification réelle
        // nomme presque toujours la réponse littéralement.
        item.indice = orientingIndiceFromQuestion(item.question, "l'énoncé");
        civiqueAppliedTransformations.push({
          rule_id: "A2_TO_A1",
          applied_to: `items[${index}].indice`,
          evidence: `Indice orienté (règle à relire) affiché sans révéler la réponse de la question ${index + 1}, situation adulte inchangée.`,
        });
      } else if (level === "B1") {
        item.justification_required = true;
        item.justification_type = "support_evidence";
        item.justification_prompt = "Justifiez votre choix à partir de la règle présentée dans l'énoncé, sans ajouter d'information nouvelle.";
        civiqueAppliedTransformations.push({
          rule_id: "A2_TO_B1",
          applied_to: `items[${index}].justification_prompt`,
          evidence: `Justification obligatoire ajoutée, appuyée sur la règle réellement présentée pour la question ${index + 1}.`,
        });
      } else if (level === "B2") {
        item.justification_required = true;
        if (CIVIQUE_CATEGORY_QUESTION_INDEXES.has(index)) {
          item.justification_type = "nuance";
          item.justification_prompt = "Justifiez votre choix, expliquez précisément pourquoi les autres réponses ne conviennent pas, et précisez s'il s'agit d'un droit, d'un devoir, d'une règle ou d'une démarche, uniquement à partir de la situation présentée.";
          civiqueAppliedTransformations.push({
            rule_id: "A2_TO_B2",
            applied_to: `items[${index}].justification_prompt`,
            evidence: `La question ${index + 1} oppose explicitement deux notions (droit/devoir/règle/démarche) dans son énoncé : distinction demandée à partir du contenu existant, aucune conséquence juridique ni exception inventée.`,
          });
        } else {
          item.justification_type = "support_evidence";
          item.justification_prompt = "Justifiez votre choix à partir de la règle présentée dans l'énoncé, sans ajouter d'information nouvelle.";
          civiqueAppliedTransformations.push({
            rule_id: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
            applied_to: `items[${index}].justification_prompt`,
            evidence: `La question ${index + 1} est purement factuelle (durée/comptage) : aucune distinction droit/devoir/règle/démarche n'y est présente, justification simple maintenue plutôt qu'une nuance inventée.`,
          });
        }
      }

      item.correction = closedItemCorrection({ options: item.options, bonneReponse: item.bonne_reponse, preuve });
      if (item.justification_prompt) item.correction.justification_ouverte = openJustificationCorrection(preuve);
      return item;
    });

    exercises.push(exercise({
      code: "civique",
      title: "Droits, devoirs et règles",
      competence: "CE",
      format: "qcm",
      level,
      instruction: "Lisez chaque situation puis choisissez la réponse directement justifiée par la règle présentée.",
      items: civiqueItems,
      source: data.qcm_civique.resource_id,
      duration: 600,
      activityCode: "S01.CIVIQUE",
      civicContent: true,
      civicFactIds: data.qcm_civique.questions.map((q) => q.metadata_code ?? q.id_supabase).filter(Boolean),
      appliedTransformations: civiqueAppliedTransformations,
      forceNeedsContentReview: civiqueNeedsReview,
    }));
  }

  for (const level of ["A1", "A2"]) {
    exercises.push(exercise({
      code: "ee-guidee-1",
      title: "Compléter une présentation",
      competence: "EE",
      format: "texte_lacunaire",
      level,
      instruction: data.ee_productions.guidee_1.consigne,
      items: data.ee_productions.guidee_1.reponses.map((answer, index) => ({
        question: `Mot manquant ${index + 1}`,
        bonne_reponse: answer,
      })),
      source: data.ee_productions.guidee_1.source,
      duration: 360,
      activityCode: "S01.PRODUCTION",
    }));
  }

  for (const level of ["A2", "B1"]) {
    exercises.push(exercise({
      code: "ee-guidee-2",
      title: data.ee_productions.guidee_2.titre,
      competence: "EE",
      format: "production_ecrite",
      level,
      instruction: data.ee_productions.guidee_2.consigne,
      items: [{ question: data.ee_productions.guidee_2.consigne, bonne_reponse: data.ee_productions.guidee_2.criteres }],
      source: data.ee_productions.guidee_2.source,
      duration: 600,
      activityCode: "S01.PRODUCTION",
    }));
  }

  for (const level of ["B1", "B2"]) {
    exercises.push(exercise({
      code: "ee-autonome",
      title: data.ee_productions.autonome.titre,
      competence: "EE",
      format: "production_ecrite",
      level,
      instruction: level === "B1" ? data.ee_productions.autonome.variante_niveau_bas : data.ee_productions.autonome.variante_niveau_haut,
      items: [{ question: data.ee_productions.autonome.consigne, bonne_reponse: data.ee_productions.autonome.criteres }],
      source: data.ee_productions.autonome.source,
      duration: 720,
      activityCode: "S01.PRODUCTION",
    }));
  }

  exercises = rewriteS01Instructions(exercises);

  const playlists = Object.fromEntries(LEVELS.map((level) => {
    const selected = exercises.filter((entry) => entry.niveau_vise === level);
    return [level, selected.map((entry, index) => ({
      ordre: index + 1,
      metadata_code: entry.metadata_code,
      activity_code: entry.contenu.metadata.activity_code,
      label: `Activité ${index + 1} sur ${selected.length}`,
      trainer_preview_required: true,
    }))];
  }));

  const belowFloorExercises = exercises.filter((entry) => entry.contenu.metadata.needs_content_review);
  const unsupportedTransformationExercises = exercises.filter((entry) =>
    (entry.contenu.metadata.applied_transformations ?? []).some((t) => t.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED"),
  );

  // Lot 2.1, point 7 : statut de publication honnête et exploitable, porté
  // par le corpus lui-même (le pont de publication n'est PAS modifié ici —
  // Lot 3). Toute transformation non supportée rend l'exercice concerné
  // publishable=false, avec les items concernés comme preuve.
  const publishability = {
    publishable_count: exercises.filter((entry) => !entry.contenu.metadata.needs_content_review).length,
    non_publishable_count: belowFloorExercises.length,
    by_exercise: exercises.map((entry) => ({
      metadata_code: entry.metadata_code,
      publishable: !entry.contenu.metadata.needs_content_review,
      needs_content_review: entry.contenu.metadata.needs_content_review,
    })),
    unsupported_transformations: unsupportedTransformationExercises.map((entry) => ({
      metadata_code: entry.metadata_code,
      publishable: false,
      items_concerned: (entry.contenu.metadata.applied_transformations ?? [])
        .filter((t) => t.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED")
        .map((t) => ({ applied_to: t.applied_to, evidence: t.evidence })),
    })),
  };

  const report = {
    generated_at: "2026-07-13",
    session_code: "S01",
    pivot_level: "A2",
    exercise_count: exercises.length,
    counts_by_level: Object.fromEntries(LEVELS.map((level) => [level, exercises.filter((entry) => entry.niveau_vise === level).length])),
    counts_by_competence: Object.fromEntries(["CO", "CE", "EE", "EO", "Structures"].map((competence) => [competence, exercises.filter((entry) => entry.competence === competence).length])),
    validation_rules: [
      { rule_id: "INTERACTIVE_FORMAT_SUPPORTED", status: exercises.every((entry) => SUPPORTED_FORMATS.has(entry.format)) ? "pass" : "fail" },
      { rule_id: "MINIMUM_FOUR_ACTIVITIES_PER_LEVEL", status: LEVELS.every((level) => playlists[level].length >= 4) ? "pass" : "fail" },
      {
        rule_id: "MINIMUM_TEN_ITEMS_AUTO_CORRECTED",
        status: belowFloorExercises.length === 0 ? "pass" : "warning",
        evidence: belowFloorExercises.map((entry) => `${entry.metadata_code} (${entry.contenu.items.length} items)`),
      },
      {
        rule_id: "MINIMUM_ORAL_PROMPTS",
        status: exercises.filter((entry) => entry.format === "production_orale").every((entry) => entry.contenu.items.length >= MIN_ORAL_PROMPTS)
          ? "pass" : "warning",
      },
      { rule_id: "TRAINER_PREVIEW_REQUIRED", status: exercises.every((entry) => entry.contenu.metadata.trainer_preview_required) ? "pass" : "fail" },
      { rule_id: "COMPETENCE_FAMILY_PRESERVED", status: exercises.filter((entry) => entry.family_id).every((entry) => entry.competence === (entry.family_id.includes("_CO_") ? "CO" : entry.competence)) ? "pass" : "fail" },
      { rule_id: "CIVIC_ON_ALL_LEVELS", status: LEVELS.every((level) => exercises.some((entry) => entry.niveau_vise === level && entry.civic_content)) ? "pass" : "fail" },
      {
        rule_id: "NO_UNSUPPORTED_TRANSFORMATION_PUBLISHED",
        status: unsupportedTransformationExercises.length === 0 ? "pass" : "warning",
        evidence: unsupportedTransformationExercises.map((entry) => `${entry.metadata_code} (needs_content_review=true, publishable=false)`),
      },
    ],
    warnings: [
      "Le MP3 définitif reste à produire avec une voix réelle.",
      "Les affirmations civiques doivent être validées contre la base officielle versionnée (civic_facts) avant publication — voir docs/pedagogie/checklist-readiness-differenciation-S01.md.",
      "Le chronométrage doit être calibré avec des données terrain.",
      "Le contenu civique est identique sur les 4 niveaux faute de variante linguistique par niveau dans la source — gap documenté, pas une simplification réalisée ici.",
      `${belowFloorExercises.length} exercice(s) autocorrigé(s) restent sous le plancher de 10 items par manque réel de matière première en banque (needs_content_review=true) — voir MINIMUM_TEN_ITEMS_AUTO_CORRECTED.`,
      `${unsupportedTransformationExercises.length} exercice(s) portent au moins une transformation DIFF_TRANSFORMATION_NOT_SUPPORTED — non publiables (voir report.publishability.unsupported_transformations). Le pont de publication bloque désormais tout lien apprenant portant ce statut (Lot 3).`,
    ],
    activities: ACTIVITY_DEFS,
    publishability,
  };

  const payload = { schema_version: "1.1", session_code: "S01", exercises, playlists, report };
  const baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  const differentiationValidation = validateS01DifferentiationPayload(payload, { baseline });
  report.differentiation_validation = differentiationValidation;
  const instructionIssues = Object.values(differentiationValidation.by_exercise)
    .flatMap((entry) => entry.rules)
    .filter((rule) => rule.rule_id.startsWith("INSTRUCTION_") && rule.status !== "pass");
  report.instruction_quality = {
    ...getS01InstructionPolicyStatus(),
    exercise_count: exercises.length,
    conforming_count: exercises.length - new Set(instructionIssues.map((rule) => rule.metadata_code)).size,
    issue_count: instructionIssues.length,
    issues: instructionIssues,
  };
  const coherenceIssues = differentiationValidation.rules
    .filter((rule) => rule.rule_id.startsWith("COHERENCE_") && rule.status !== "pass");
  report.exercise_coherence = {
    schema_version: "1.0",
    human_validation_status: "pending_pedagogical_owner",
    exercise_count: exercises.length,
    exercises_with_issues: new Set(coherenceIssues.map((rule) => rule.metadata_code)).size,
    issue_count: coherenceIssues.length,
    blocking_issue_count: coherenceIssues.filter((rule) => rule.status === "fail").length,
    warning_count: coherenceIssues.filter((rule) => rule.status === "warning").length,
    issues: coherenceIssues,
  };
  report.validation_rules.push({
    rule_id: "EXERCISE_COHERENCE_VALIDATION",
    status: coherenceIssues.some((rule) => rule.status === "fail") ? "fail" : coherenceIssues.length > 0 ? "warning" : "pass",
    evidence: [
      `${exercises.length} exercices controles`,
      `${new Set(coherenceIssues.map((rule) => rule.metadata_code)).size} exercice(s) avec anomalie`,
      `${coherenceIssues.filter((rule) => rule.status === "fail").length} regle(s) bloquante(s) en echec`,
    ],
  });
  report.validation_rules.push({
    rule_id: "INSTRUCTION_QUALITY_VALIDATION",
    status: instructionIssues.some((rule) => rule.status === "fail")
      ? "fail"
      : instructionIssues.length > 0 ? "warning" : "pass",
    evidence: [
      `${exercises.length} consignes contrôlées`,
      `${instructionIssues.length} erreur(s) ou avertissement(s)`,
      "validation humaine finale en attente",
    ],
  });
  report.publishability = {
    ...publishability,
    publishable_count: differentiationValidation.publishable_count,
    non_publishable_count: differentiationValidation.non_publishable_count,
    by_exercise: exercises.map((entry) => ({
      metadata_code: entry.metadata_code,
      needs_content_review: Boolean(entry.contenu?.metadata?.needs_content_review),
      publishable: differentiationValidation.by_exercise[entry.metadata_code].publishable,
      blocking_errors: differentiationValidation.by_exercise[entry.metadata_code].blocking_errors,
    })),
    validation_source: "report.differentiation_validation",
  };
  report.validation_rules.push({
    rule_id: "DIFFERENTIATION_VALIDATION",
    status: differentiationValidation.valid
      ? (differentiationValidation.publishable ? "pass" : "warning")
      : "fail",
    evidence: [
      `${differentiationValidation.publishable_count} publishable`,
      `${differentiationValidation.non_publishable_count} blocked`,
    ],
  });
  if (writeOutput) await writeJsonAtomically(OUTPUT_PATH, payload);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const payload = await buildInteractiveS01();
  console.log(`S01 interactive: ${payload.exercises.length} exercices générés dans ${OUTPUT_PATH}`);
  console.log(JSON.stringify(payload.report, null, 2));
}
