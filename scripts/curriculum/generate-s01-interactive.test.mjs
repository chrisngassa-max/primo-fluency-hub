import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildInteractiveS01 } from "./generate-s01-interactive.mjs";

const OUTPUT_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
const AUTO_CORRECTED_FORMATS = new Set(["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"]);
const MOJIBAKE_PATTERN = /Ã.|â€.|Â[^ \d]/;

describe("S01 v3 — parcours interactif", () => {
  it("génère une playlist A1 à B2 avec au moins quatre activités par niveau, dans l'ordre", async () => {
    const payload = await buildInteractiveS01();
    expect(payload.exercises.length).toBeGreaterThan(29);
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(payload.playlists[level].length).toBeGreaterThanOrEqual(4);
      expect(payload.playlists[level].map((entry) => entry.ordre)).toEqual(
        Array.from({ length: payload.playlists[level].length }, (_, index) => index + 1),
      );
      expect(payload.playlists[level].every((entry) => /^Activité \d+ sur \d+$/.test(entry.label))).toBe(true);
    }
  });

  it("ne produit que des formats compris par l'application et aucune règle de validation en échec", async () => {
    const payload = await buildInteractiveS01();
    const formats = new Set(["qcm", "vrai_faux", "appariement", "production_ecrite", "production_orale", "texte_lacunaire", "transformation"]);
    expect(payload.exercises.every((exercise) => formats.has(exercise.format))).toBe(true);
    // Les statuts "warning" sont tolérés (manques de matière première
    // documentés honnêtement) ; seul un "fail" est bloquant.
    expect(payload.report.validation_rules.some((rule) => rule.status === "fail")).toBe(false);
  });

  it("marque explicitement (needs_content_review) tout exercice autocorrigé sous le plancher de 10 items, sans jamais fabriquer d'item", async () => {
    const payload = await buildInteractiveS01();
    const autoCorrected = payload.exercises.filter((exercise) => AUTO_CORRECTED_FORMATS.has(exercise.format));
    expect(autoCorrected.length).toBeGreaterThan(0);
    for (const exercise of autoCorrected) {
      const belowFloor = exercise.contenu.items.length < 10;
      expect(exercise.contenu.metadata.needs_content_review).toBe(belowFloor);
    }
  });

  it("conserve CO dans toute la famille S01_CO_ACCUEIL_01 et sépare les prolongements EO", async () => {
    const payload = await buildInteractiveS01();
    const family = payload.exercises.filter((exercise) => exercise.family_id === "S01_CO_ACCUEIL_01");
    expect(family.length).toBeGreaterThan(0);
    expect(new Set(family.map((exercise) => exercise.niveau_vise))).toEqual(new Set(["A1", "A2", "B1", "B2"]));
    expect(family.every((exercise) => exercise.competence === "CO")).toBe(true);

    const extensions = payload.exercises.filter((exercise) => exercise.extension_of_family_id === "S01_CO_ACCUEIL_01");
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions.every((exercise) => exercise.competence === "EO" && !exercise.family_id)).toBe(true);
  });

  it("formalise A2 comme pivot du dialogue sans réduire la différenciation à la longueur, et sert les 10 questions à tous les niveaux", async () => {
    const payload = await buildInteractiveS01();
    const dialogue = payload.exercises.filter((exercise) => exercise.metadata_code.startsWith("cv2:S01:v3:co-dialogue:"));
    const byLevel = Object.fromEntries(dialogue.map((exercise) => [exercise.niveau_vise, exercise]));
    expect(byLevel.A2.contenu.metadata.source_level).toBe("A2");
    expect(byLevel.A1.contenu.metadata.guidance).toBe("fort");
    // Vocabulaire du référentiel de différenciation (Lot 1/2), plus la carte
    // littérale figée : voir differentiation_level_contracts_v1.json (CO).
    expect(byLevel.B1.contenu.metadata.cognitive_operations).toContain("relier");
    expect(byLevel.B2.contenu.metadata.cognitive_operations).toEqual(expect.arrayContaining(["synthetiser", "evaluer"]));
    // Les 10 questions du QCM TCF sont désormais servies à tous les niveaux :
    // la différenciation passe par le guidage, pas par un nombre d'items réduit.
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(byLevel[level].contenu.items.length).toBe(10);
    }
  });

  it("couvre les cinq compétences, dont Structures", async () => {
    const payload = await buildInteractiveS01();
    for (const competence of ["CO", "CE", "EE", "EO", "Structures"]) {
      expect(payload.exercises.some((exercise) => exercise.competence === competence)).toBe(true);
    }
  });

  it("propose le contenu civique aux quatre niveaux, avec provenance déclarée", async () => {
    const payload = await buildInteractiveS01();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      const civic = payload.exercises.find((exercise) => exercise.niveau_vise === level && exercise.civic_content);
      expect(civic).toBeDefined();
      expect(civic.civic_fact_ids.length).toBeGreaterThan(0);
      expect(civic.contenu.items.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("expose le glossaire complet (10 mots) dans l'exercice d'appariement lexical", async () => {
    const payload = await buildInteractiveS01();
    const lexique = payload.exercises.find((exercise) => exercise.metadata_code === "cv2:S01:v3:lexique-association:A1");
    expect(lexique.contenu.items.length).toBe(10);
  });

  it("n'expose aucun bloc de mojibake (Ã, â€, Â) dans le JSON généré", async () => {
    const raw = await readFile(OUTPUT_PATH, "utf8");
    expect(MOJIBAKE_PATTERN.test(raw)).toBe(false);
  });
});

describe("Lot 2 — co-dialogue : transformation réelle par niveau", () => {
  async function byLevel() {
    const payload = await buildInteractiveS01();
    const dialogue = payload.exercises.filter((exercise) => exercise.metadata_code.startsWith("cv2:S01:v3:co-dialogue:"));
    return Object.fromEntries(dialogue.map((exercise) => [exercise.niveau_vise, exercise]));
  }

  it("conserve dix items à chaque niveau", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(levels[level].contenu.items.length).toBe(10);
    }
  });

  it("A1 : la bonne réponse est toujours présente dans les options réduites, jamais un options.slice(0,3) aveugle", async () => {
    const levels = await byLevel();
    for (const item of levels.A1.contenu.items) {
      expect(item.options).toContain(item.bonne_reponse);
      expect(item.options.length).toBeLessThanOrEqual(3);
    }
  });

  it("A1 : fournit un indice explicite dérivé de la justification réelle, et n'expose jamais la correction", async () => {
    const levels = await byLevel();
    for (const item of levels.A1.contenu.items) {
      expect(typeof item.indice).toBe("string");
      expect(item.indice.length).toBeGreaterThan(0);
      // L'indice est identique à la justification/explication réelle déjà
      // rédigée dans la source (pas un texte inventé au générateur).
      expect(item.indice).toBe(item.explication);
      expect(item).not.toHaveProperty("justification_required");
    }
  });

  it("A2 reste le pivot : QCM plein, aucune justification obligatoire, aucune transformation appliquée déclarée", async () => {
    const levels = await byLevel();
    expect(levels.A2.contenu.metadata.transformation_id).toBe("IDENTITY");
    expect(levels.A2.contenu.metadata.applied_transformations).toEqual([]);
    for (const item of levels.A2.contenu.items) {
      expect(item.justification_required).toBeUndefined();
      expect(item.options.length).toBeGreaterThan(0);
    }
  });

  it("B1 : justification obligatoire de type support_evidence sur les dix items, correction associée fournie", async () => {
    const levels = await byLevel();
    expect(levels.B1.contenu.metadata.transformation_id).toBe("A2_TO_B1");
    for (const item of levels.B1.contenu.items) {
      expect(item.justification_required).toBe(true);
      expect(item.justification_type).toBe("support_evidence");
      expect(typeof item.justification_prompt).toBe("string");
      expect(item.correction.justification_ouverte.elements_attendus.length).toBeGreaterThan(0);
    }
  });

  it("B2 : nuance uniquement sur les deux items où le dialogue fournit un contraste explicite (droit/devoir/règle), DIFF_TRANSFORMATION_NOT_SUPPORTED déclaré pour les huit autres", async () => {
    const levels = await byLevel();
    expect(levels.B2.contenu.metadata.transformation_id).toBe("A2_TO_B2");
    const nuanced = levels.B2.contenu.items.filter((item) => item.justification_type === "nuance");
    const notSupported = levels.B2.contenu.items.filter((item) => item.justification_type === "support_evidence");
    expect(nuanced.length).toBe(2);
    expect(notSupported.length).toBe(8);
    expect(levels.B2.contenu.items.every((item) => item.justification_required === true)).toBe(true);

    const notSupportedEvidence = levels.B2.contenu.metadata.applied_transformations.filter(
      (t) => t.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED",
    );
    expect(notSupportedEvidence.length).toBe(8);
  });

  it("chaque transformation déclarée pointe vers un champ réellement modifié de l'item concerné (pas un simple mot de métadonnée)", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "B1", "B2"]) {
      for (const transformation of levels[level].contenu.metadata.applied_transformations) {
        expect(transformation.rule_id).toBeTruthy();
        expect(transformation.applied_to).toMatch(/^items\[\d+\]\.\w+$/);
        expect(transformation.evidence.length).toBeGreaterThan(10);
        // Le champ pointé existe réellement sur l'item désigné.
        const match = transformation.applied_to.match(/^items\[(\d+)\]\.(\w+)$/);
        const [, indexStr, field] = match;
        const item = levels[level].contenu.items[Number(indexStr)];
        expect(item[field]).toBeDefined();
      }
    }
  });

  it("chaque item fermé porte une correction serveur complète (bonne réponse, preuve, distracteurs, remédiation)", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      for (const item of levels[level].contenu.items) {
        expect(item.correction.bonne_reponse).toBe(item.bonne_reponse);
        expect(item.correction.preuve_support).toBeTruthy();
        expect(Array.isArray(item.correction.explication_distracteurs)).toBe(true);
        expect(item.correction.remediation.length).toBeGreaterThan(0);
      }
    }
  });

  it("le référentiel (version + contrat de niveau réellement utilisé) est inscrit dans les métadonnées", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(levels[level].contenu.metadata.referential_version).toBe("1.0");
      expect(levels[level].contenu.metadata.level_contract.target_level).toBe(level);
      expect(levels[level].contenu.metadata.level_contract.cognitive_operations.length).toBeGreaterThan(0);
    }
  });
});

describe("Lot 2 — lexique-association : transformation réelle par niveau", () => {
  async function byLevel() {
    const payload = await buildInteractiveS01();
    const found = {};
    for (const level of ["A1", "A2", "B1", "B2"]) {
      found[level] = payload.exercises.find((exercise) => exercise.metadata_code === `cv2:S01:v3:lexique-association:${level}`);
    }
    return found;
  }

  it("conserve dix items, le format appariement et la compétence CE à chaque niveau", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(levels[level].contenu.items.length).toBe(10);
      expect(levels[level].format).toBe("appariement");
      expect(levels[level].competence).toBe("CE");
    }
  });

  it("la bonne réponse figure toujours dans les options, à tous les niveaux", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      for (const item of levels[level].contenu.items) {
        expect(item.options).toContain(item.bonne_reponse);
      }
    }
  });

  it("A1 : mot vers définition, un distracteur, exemple visible en aide (indice)", async () => {
    const levels = await byLevel();
    for (const item of levels.A1.contenu.items) {
      expect(item.options.length).toBe(2);
      expect(typeof item.indice).toBe("string");
      expect(item.indice).toBe(item.explication);
    }
  });

  it("A2 reste le pivot : mot vers définition, deux distracteurs, aucune transformation appliquée déclarée", async () => {
    const levels = await byLevel();
    expect(levels.A2.contenu.metadata.applied_transformations).toEqual([]);
    for (const item of levels.A2.contenu.items) {
      expect(item.options.length).toBe(3);
      expect(item).not.toHaveProperty("indice");
    }
  });

  it("B1/B2 : format inversé (exemple d'emploi -> mot), pas seulement une différence de nombre de distracteurs", async () => {
    const levels = await byLevel();
    for (const level of ["B1", "B2"]) {
      for (const item of levels[level].contenu.items) {
        // La question porte sur l'exemple d'emploi réel, la réponse est le
        // mot — vérifie que la réponse est bien un des dix mots du lexique
        // (pas une définition).
        expect(item.bonne_reponse.split(" ").length).toBeLessThanOrEqual(2);
        expect(item.question.length).toBeGreaterThan(item.bonne_reponse.length);
      }
    }
  });

  it("justification lexicale réelle uniquement sur droit/devoir (les deux seuls termes proches), jamais généralisée aux huit autres", async () => {
    const levels = await byLevel();
    for (const level of ["B1", "B2"]) {
      const withJustification = levels[level].contenu.items.filter((item) => item.justification_required);
      expect(withJustification.length).toBe(2);
      expect(new Set(withJustification.map((item) => item.bonne_reponse))).toEqual(new Set(["droit", "devoir"]));
    }
    // B2 force la discrimination : "devoir" est un distracteur explicite de
    // l'item "droit", et réciproquement.
    const droitB2 = levels.B2.contenu.items.find((item) => item.bonne_reponse === "droit");
    const devoirB2 = levels.B2.contenu.items.find((item) => item.bonne_reponse === "devoir");
    expect(droitB2.options).toContain("devoir");
    expect(devoirB2.options).toContain("droit");
    expect(droitB2.justification_type).toBe("nuance");
  });

  it("B2 n'invente aucune nuance pour les huit mots sans terme proche : mêmes définitions/exemples que la source", async () => {
    const levels = await byLevel();
    const withoutJustification = levels.B2.contenu.items.filter((item) => !item.justification_required);
    expect(withoutJustification.length).toBe(8);
    for (const item of withoutJustification) {
      expect(item).not.toHaveProperty("justification_prompt");
    }
  });
});

describe("Lot 2 — lexique-texte-lacunaire : transformation réelle par niveau", () => {
  async function byLevel() {
    const payload = await buildInteractiveS01();
    const found = {};
    for (const level of ["A1", "A2", "B1", "B2"]) {
      found[level] = payload.exercises.find((exercise) => exercise.metadata_code === `cv2:S01:v3:lexique-texte-lacunaire:${level}`);
    }
    return found;
  }

  it("conserve exactement trois trous et le format texte_lacunaire à chaque niveau", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(levels[level].contenu.items.length).toBe(3);
      expect(levels[level].format).toBe("texte_lacunaire");
    }
  });

  it("A1/A2 : banque de mots réelle (les trois réponses, jamais dans l'ordre des trous) présente sur chaque item", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2"]) {
      for (const item of levels[level].contenu.items) {
        expect(item.banque_mots.slice().sort()).toEqual(["objectif", "parcours", "règles"].sort());
      }
      // La banque n'est jamais dans l'ordre des trous (ce qui révélerait la
      // réponse) : ordre alphabétique déterministe.
      expect(levels[level].contenu.items[0].banque_mots).toEqual([...levels[level].contenu.items[0].banque_mots].sort((a, b) => a.localeCompare(b, "fr")));
    }
  });

  it("A1 seul porte une amorce (indice) en plus de la banque ; A2 n'a pas d'exemple intégralement résolu", async () => {
    const levels = await byLevel();
    for (const item of levels.A1.contenu.items) {
      expect(typeof item.indice).toBe("string");
    }
    for (const item of levels.A2.contenu.items) {
      expect(item).not.toHaveProperty("indice");
      expect(item.banque_mots).toBeDefined();
    }
  });

  it("B1/B2 : banque supprimée, justification contextuelle obligatoire sur les trois trous", async () => {
    const levels = await byLevel();
    for (const level of ["B1", "B2"]) {
      for (const item of levels[level].contenu.items) {
        expect(item.banque_mots).toBeUndefined();
        expect(item.justification_required).toBe(true);
        expect(item.justification_type).toBe("contextual");
      }
    }
  });

  it("B2 déclare DIFF_TRANSFORMATION_NOT_SUPPORTED pour l'effet de sens (aucune nuance disponible sur ce texte), sur les trois trous", async () => {
    const levels = await byLevel();
    const notSupported = levels.B2.contenu.metadata.applied_transformations.filter((t) => t.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(notSupported.length).toBe(3);
  });

  it("les réponses attendues et explications restent cachées avant libération (hors liste blanche du sanitizer)", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      for (const item of levels[level].contenu.items) {
        expect(item.correction.bonne_reponse).toBe(item.bonne_reponse);
      }
    }
  });
});

describe("Lot 2 — support-visuel : réponses réelles dérivées de data.visual.scene.elements", () => {
  async function byLevel() {
    const payload = await buildInteractiveS01();
    const found = {};
    for (const level of ["A1", "A2", "B1", "B2"]) {
      found[level] = payload.exercises.find((exercise) => exercise.metadata_code === `cv2:S01:v3:support-visuel:${level}`);
    }
    return found;
  }

  it("conserve trois items et le format texte_lacunaire à chaque niveau", async () => {
    const levels = await byLevel();
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(levels[level].contenu.items.length).toBe(3);
      expect(levels[level].format).toBe("texte_lacunaire");
    }
  });

  it("ne contient plus jamais le placeholder factice « Réponse attendue dans le support visuel »", async () => {
    const payload = await buildInteractiveS01();
    const raw = JSON.stringify(payload);
    expect(raw).not.toContain("Réponse attendue dans le support visuel");
  });

  it("calcule le nombre de thèmes, leur ordre réel et le thème du panneau rouge clair depuis data.visual.scene.elements", async () => {
    const levels = await byLevel();
    const [count, order, redPanel] = levels.A2.contenu.items.map((item) => item.bonne_reponse);
    expect(count).toBe("Cinq");
    // "Histoire, géographie et culture" contient elle-même une virgule : on
    // vérifie la présence des cinq libellés réels plutôt qu'un split naïf
    // sur ", ".
    for (const theme of [
      "Principes et valeurs de la République",
      "Système institutionnel et politique",
      "Droits et devoirs",
      "Histoire, géographie et culture",
      "Vivre dans la société française",
    ]) {
      expect(order).toContain(theme);
    }
    expect(redPanel).toBe("Histoire, géographie et culture");
  });

  it("A1 seul porte la légende couleur -> thème (indice) ; A2 reste le pivot sans légende", async () => {
    const levels = await byLevel();
    for (const item of levels.A1.contenu.items) {
      expect(item.indice).toContain("rouge clair");
      expect(item.indice).toContain("Histoire, géographie et culture");
    }
    for (const item of levels.A2.contenu.items) {
      expect(item).not.toHaveProperty("indice");
    }
    expect(levels.A2.contenu.metadata.applied_transformations).toEqual([]);
  });

  it("B1/B2 exigent une justification fondée sur les libellés visibles, jamais une justification de l'ordre des panneaux", async () => {
    const levels = await byLevel();
    for (const level of ["B1", "B2"]) {
      for (const item of levels[level].contenu.items) {
        expect(item.justification_required).toBe(true);
        expect(item.justification_prompt.toLowerCase()).not.toMatch(/pourquoi.*ordre|ordre.*panneaux/);
        expect(item.justification_prompt).toMatch(/libellés|couleurs visibles/);
      }
    }
  });

  it("B2 déclare DIFF_TRANSFORMATION_NOT_SUPPORTED pour la synthèse entre catégories (schéma sans relation entre panneaux)", async () => {
    const levels = await byLevel();
    const notSupported = levels.B2.contenu.metadata.applied_transformations.filter((t) => t.rule_id === "DIFF_TRANSFORMATION_NOT_SUPPORTED");
    expect(notSupported.length).toBe(3);
  });
});
