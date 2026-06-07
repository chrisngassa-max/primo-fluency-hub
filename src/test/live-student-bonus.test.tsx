import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TuileEleveLive } from "@/components/formateur/TuileEleveLive";
import type { EleveStateLive } from "@/hooks/useLiveSession";

function buildState(statut: EleveStateLive["statut"]): EleveStateLive {
  return {
    eleve_id: "student-1",
    statut,
    dernier_event_type: statut === "finished" ? "exercice_termine" : "exercice_demarre",
    derniere_activite: new Date().toISOString(),
    score_dernier_exercice: 88,
    exercice_id: "exercise-1",
    exercice_en_cours_id: statut === "playing" ? "exercise-1" : null,
    exercice_en_cours_titre: statut === "playing" ? "Lecture" : null,
    dernier_type_erreur: null,
  };
}

describe("TuileEleveLive bonus action", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows and triggers the bonus shortcut for a student who finished", () => {
    const onBonus = vi.fn();
    act(() => root.render(
      <TuileEleveLive
        prenom="Lina"
        nom="Martin"
        state={buildState("finished")}
        priorite={0}
        onBonus={onBonus}
      />,
    ));

    const button = container.querySelector('button[aria-label="Envoyer une activite bonus"]');
    expect(button).not.toBeNull();
    act(() => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onBonus).toHaveBeenCalledOnce();
  });

  it("does not show the bonus shortcut while the exercise is in progress", () => {
    act(() => root.render(
      <TuileEleveLive
        prenom="Lina"
        nom="Martin"
        state={buildState("playing")}
        priorite={0}
        onBonus={() => undefined}
      />,
    ));

    expect(container.querySelector('button[aria-label="Envoyer une activite bonus"]')).toBeNull();
  });
});
