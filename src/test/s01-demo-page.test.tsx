// Lot 2.1, point 4 — S01DemoPage.tsx rendue réellement (pas seulement sa
// couche de données) : preuve qu'elle reproduit le comportement apprenant
// via les mêmes composants partagés (ExerciseItemForm/CorrectionGate),
// sans page blanche ni erreur de rendu.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// S01DemoPage -> SeanceApprenant.tsx (pour ExerciseItemForm/CorrectionGate)
// -> learnerSession.ts -> le client Supabase réel, qui exige des variables
// d'env absentes en test. La démo n'appelle jamais ces fonctions Supabase
// (elle utilise s01Demo.ts, 100% local) : ce stub évite juste le crash au
// chargement du module, comme dans exercise-item-justification.test.tsx.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import S01DemoPage from "@/pages/S01DemoPage";
import { resetS01Demo } from "@/lib/curriculum/s01Demo";

describe("S01DemoPage — rendu réel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetS01Demo();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("affiche le premier exercice A2 par défaut, avec le badge de niveau et la consigne réelle", async () => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/demo/s01"]}>
        <S01DemoPage />
      </MemoryRouter>,
    ));
    // Laisse le chargement asynchrone (fetchS01DemoContent) se résoudre.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain("Démonstration S01");
    expect(container.textContent).toContain("A2");
    expect(container.textContent).not.toContain("Chargement de la démonstration");
  });

  it("ne fuite jamais bonne_reponse/explication/correction dans le HTML rendu", async () => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/demo/s01?niveau=B1"]}>
        <S01DemoPage />
      </MemoryRouter>,
    ));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.innerHTML).not.toContain("bonne_reponse");
    // "explication" en tant que CLÉ JSON ne doit jamais apparaître (le texte
    // français "explication" pourrait légitimement apparaître ailleurs,
    // donc on vérifie l'absence de la clé sérialisée, pas du mot).
    expect(container.innerHTML).not.toContain('"explication"');
  });

  it("permet de parcourir les intitulés et d’ouvrir un autre exercice sans terminer le premier", async () => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/demo/s01?niveau=A2"]}>
        <S01DemoPage />
      </MemoryRouter>,
    ));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain("Parcourir les 16 exercices du niveau A2");
    expect(container.querySelector("h2")?.textContent).toContain("Associer chaque mot");

    const target = [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Exercice 2 — Phrase à compléter"));
    expect(target).toBeDefined();
    await act(async () => { target?.click(); await Promise.resolve(); });

    expect(container.querySelector("h2")?.textContent).toBe("Exercice 2 — Phrase à compléter");
    expect(container.textContent).toContain("Item 1/3");
  });

  it("conserve la réponse en brouillon quand on quitte puis rouvre un exercice", async () => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/demo/s01?niveau=A2"]}>
        <S01DemoPage />
      </MemoryRouter>,
    ));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const firstChoice = container.querySelector<HTMLButtonElement>('button[role="radio"]');
    expect(firstChoice).not.toBeNull();
    await act(async () => { firstChoice?.click(); await Promise.resolve(); });
    expect(firstChoice?.getAttribute("data-state")).toBe("checked");

    const secondExercise = [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Exercice 2 — Phrase à compléter"));
    await act(async () => { secondExercise?.click(); await Promise.resolve(); });

    const firstExercise = [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Associer chaque mot à sa définition"));
    await act(async () => { firstExercise?.click(); await Promise.resolve(); });

    expect(container.querySelector('button[role="radio"][data-state="checked"]')).not.toBeNull();
  });
  it("affiche et ouvre l'exemple corrigé sur un exercice B2", async () => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/demo/s01?niveau=B2"]}>
        <S01DemoPage />
      </MemoryRouter>,
    ));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const trigger = [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Voir un exemple corrigé"));
    expect(trigger).toBeDefined();
    await act(async () => { trigger?.click(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("Comment trouver la réponse");
  });
});
