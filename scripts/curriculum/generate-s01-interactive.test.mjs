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
    expect(byLevel.B1.contenu.metadata.cognitive_operations).toContain("justifier");
    expect(byLevel.B2.contenu.metadata.cognitive_operations).toContain("nuancer");
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
