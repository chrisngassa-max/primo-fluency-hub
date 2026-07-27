import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_TSX_PATH = join(dirname(fileURLToPath(import.meta.url)), "App.tsx");

/**
 * Contrat d'architecture (2e relecture indépendante, points 6/10) :
 * "ancienne route apprenant inaccessible". Pas de rendu React ici (pas de
 * fixture RTL disponible dans ce dépôt pour App.tsx, qui a de lourdes
 * dépendances de contexte) — on vérifie directement le contrat de routage
 * dans le code source : toute route apprenant `exercices-interactifs/s01`
 * doit rediriger, jamais rendre S01InteractiveExercises directement. Le
 * chemin formateur (`parcours/:sessionCode/exercices-interactifs`, path
 * différent) n'est pas concerné et continue de rendre le composant.
 */
describe("App.tsx — contrat de routage apprenant (2e relecture indépendante)", () => {
  const source = readFileSync(APP_TSX_PATH, "utf8");

  it("toute route apprenant exercices-interactifs/s01 redirige (Navigate), ne rend jamais S01InteractiveExercises", () => {
    const routeLines = source
      .split("\n")
      .filter((line) => line.includes('path="exercices-interactifs/s01"'));

    expect(routeLines.length).toBeGreaterThan(0);
    for (const line of routeLines) {
      expect(line).toContain("Navigate");
      expect(line).not.toContain("S01InteractiveExercises");
    }
  });

  it("le chemin formateur continue de rendre S01InteractiveExercises comme outil de test", () => {
    const formateurLine = source
      .split("\n")
      .find((line) => line.includes('path="parcours/:sessionCode/exercices-interactifs"'));
    expect(formateurLine).toBeDefined();
    expect(formateurLine).toContain("S01InteractiveExercises");
  });

  it("la route apprenant /eleve/seances/:sessionCode existe bien (parcours intégré)", () => {
    const count = (source.match(/path="seances\/:sessionCode"/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2); // sandbox + mode normal
  });
});
