import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkedExamplePanel } from "@/components/learner/WorkedExamplePanel";

describe("WorkedExamplePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.querySelectorAll('[data-radix-portal]').forEach((portal) => portal.remove());
    container.remove();
  });

  it("masque le corrigé avant le clic puis affiche le modèle et les étapes", async () => {
    act(() => root.render(
      <WorkedExamplePanel example={{
        level: "B2",
        format: "texte_lacunaire",
        instruction: "Complétez avec un mot.",
        question: "Le train a dix minutes de ________.",
        highlighted_text: "dix minutes",
        response: "retard",
        completed_response: "Le train a dix minutes de retard.",
        explanation_steps: ["Je lis la phrase.", "Je choisis le mot cohérent."],
      }} />,
    ));

    expect(container.textContent).toContain("Voir un exemple corrigé");
    expect(document.body.textContent).not.toContain("Le train a dix minutes de retard.");

    const trigger = container.querySelector<HTMLButtonElement>("button");
    await act(async () => { trigger?.click(); await Promise.resolve(); });

    expect(document.body.textContent).toContain("Exemple corrigé");
    expect(document.body.textContent).toContain("Le train a dix minutes de retard.");
    expect(document.body.textContent).toContain("Comment trouver la réponse");
    expect(document.body.textContent).toContain("niveau B2");
    expect(document.querySelector("span.underline")?.textContent).toBe("dix minutes");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain("h-[100dvh]");
    expect(dialog?.className).toContain("sm:max-w-xl");
  });

  it("ne rend aucun bouton lorsque l'exemple est absent", () => {
    act(() => root.render(<WorkedExamplePanel example={null} />));
    expect(container.textContent).toBe("");
  });
});
