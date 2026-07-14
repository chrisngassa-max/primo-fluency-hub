// Lot 2 — le rendu apprenant RÉEL (ExerciseItemForm, exporté depuis
// SeanceApprenant.tsx, pas une réimplémentation) et la correction SERVEUR
// RÉELLE (corrigerExerciceServer, exécutée en Node/Vitest) testés ensemble :
// on simule une vraie interaction utilisateur, on construit le payload avec
// la même fonction que la production (buildStructuredAnswer), et on le fait
// noter par le vrai moteur de correction serveur.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SeanceApprenant.tsx importe learnerSession.ts -> le client Supabase réel,
// qui exige des variables d'env absentes en test. On ne teste ici que les
// composants purs exportés (ExerciseItemForm/CorrectionGate) : aucun appel
// réseau n'est exercé, ce stub évite juste le crash au chargement du module.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ExerciseItemForm, CorrectionGate } from "@/pages/eleve/SeanceApprenant";
import { buildStructuredAnswer, isJustificationMissing } from "@/lib/curriculum/justificationAnswer";
import { corrigerExerciceServer } from "../../supabase/functions/_shared/correction-server.ts";
import { sanitizeItem } from "../../supabase/functions/_shared/session-content-sanitizer.ts";

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Item CO tel que produit par le générateur pour co-dialogue B1/B2 (forme
// complète, avant nettoyage par le sanitizer — le test vérifie les deux
// bouts de la chaîne).
const RAW_ITEM_B1 = {
  question: "Comment s'appelle l'apprenante du dialogue ?",
  options: ["Awa Diallo", "Awa Rossi", "Fatou Diallo"],
  bonne_reponse: "Awa Diallo",
  explication: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
  justification_prompt: "Justifiez votre réponse à partir d'un indice précis du dialogue.",
  justification_required: true,
};

describe("ExerciseItemForm + corrigerExerciceServer — justification B1/B2 testées ensemble", () => {
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

  it("le sanitizer transmet justification_prompt/justification_required au client mais jamais bonne_reponse/explication", () => {
    const sanitized = sanitizeItem(RAW_ITEM_B1);
    expect(sanitized.justification_prompt).toBe(RAW_ITEM_B1.justification_prompt);
    expect(sanitized.justification_required).toBe(true);
    expect(sanitized).not.toHaveProperty("bonne_reponse");
    expect(sanitized).not.toHaveProperty("explication");
  });

  it("affiche réellement le champ de justification avec la consigne, et l'apprenant peut y saisir du texte", () => {
    let lastValue = "";
    let lastJustification = "";

    act(() => root.render(
      <ExerciseItemForm
        item={RAW_ITEM_B1}
        index={0}
        total={1}
        locked={false}
        value={lastValue}
        onChange={(v) => { lastValue = v; }}
        justificationValue={lastJustification}
        onJustificationChange={(v) => { lastJustification = v; }}
        justificationError={null}
        onValidate={() => {}}
      />,
    ));

    expect(container.textContent).toContain(RAW_ITEM_B1.justification_prompt);
    const justificationField = container.querySelector("textarea#justification-0") as HTMLTextAreaElement;
    expect(justificationField).not.toBeNull();

    act(() => setNativeValue(justificationField, "Elle le dit explicitement au début du dialogue."));
    expect(lastJustification).toBe("Elle le dit explicitement au début du dialogue.");
  });

  it("une justification vide alors qu'elle est obligatoire produit une erreur pédagogique explicite affichée, sans effacer la réponse principale", () => {
    // Simule ce que fait handleValidateItem : isJustificationMissing() vrai
    // -> on NE construit PAS de payload, on affiche justificationError, et
    // on re-rend le formulaire avec la réponse principale intacte.
    const mainValue = "Awa Diallo";
    const justificationValue = "";
    const missing = isJustificationMissing(RAW_ITEM_B1, justificationValue);
    expect(missing).toBe(true);

    act(() => root.render(
      <ExerciseItemForm
        item={RAW_ITEM_B1}
        index={0}
        total={1}
        locked={false}
        value={mainValue}
        onChange={() => {}}
        justificationValue={justificationValue}
        onJustificationChange={() => {}}
        justificationError="Merci de justifier votre réponse avant de valider."
        onValidate={() => {}}
      />,
    ));

    expect(container.textContent).toContain("Merci de justifier votre réponse avant de valider.");
    // La réponse principale reste affichée/sélectionnée : le radio "Awa
    // Diallo" (= mainValue) est toujours coché, rien n'a été perdu.
    const checkedRadio = container.querySelector('button[role="radio"][data-state="checked"]');
    expect(checkedRadio?.id).toBe("0-Awa Diallo");
    const radios = Array.from(container.querySelectorAll('button[role="radio"]'));
    expect(radios.length).toBe(3);
  });

  it("réponse simple historique (pas de justification_prompt) : comportement inchangé, payload = chaîne simple, notée par le vrai moteur serveur", async () => {
    const payload = buildStructuredAnswer("Awa Diallo", "");
    expect(payload).toBe("Awa Diallo");

    const result = await corrigerExerciceServer({
      format: "qcm",
      competence: "CO",
      items: [{ ...RAW_ITEM_B1, justification_prompt: undefined, justification_required: undefined }],
      answers: { 0: payload },
      supabaseUrl: "https://example.invalid",
      serviceRoleKey: "test-key",
    });
    expect(result.correction[0].correct).toBe(true);
    expect(result.correction[0].learner_justification).toBeUndefined();
  });

  it("réponse structurée réelle (saisie via le composant) transmise telle quelle au vrai moteur de correction serveur, notée sur reponse_eleve uniquement", async () => {
    let mainValue = "";
    let justificationValue = "";

    act(() => root.render(
      <ExerciseItemForm
        item={RAW_ITEM_B1}
        index={0}
        total={1}
        locked={false}
        value={mainValue}
        onChange={(v) => { mainValue = v; }}
        justificationValue={justificationValue}
        onJustificationChange={(v) => { justificationValue = v; }}
        justificationError={null}
        onValidate={() => {}}
      />,
    ));

    // Sélectionne la bonne option (clic réel sur le radio du composant réel).
    const options = Array.from(container.querySelectorAll('button[role="radio"]'));
    const correctOption = options.find((el) => el.id === "0-Awa Diallo")!;
    act(() => correctOption.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(mainValue).toBe("Awa Diallo");

    const justificationField = container.querySelector("textarea#justification-0") as HTMLTextAreaElement;
    act(() => setNativeValue(justificationField, "Elle se présente explicitement au début du dialogue."));
    expect(justificationValue).toBe("Elle se présente explicitement au début du dialogue.");

    expect(isJustificationMissing(RAW_ITEM_B1, justificationValue)).toBe(false);
    const payload = buildStructuredAnswer(mainValue, justificationValue);
    expect(payload).toEqual({ reponse: "Awa Diallo", justification: "Elle se présente explicitement au début du dialogue." });

    const result = await corrigerExerciceServer({
      format: "qcm",
      competence: "CO",
      items: [RAW_ITEM_B1],
      answers: { 0: payload },
      supabaseUrl: "https://example.invalid",
      serviceRoleKey: "test-key",
    });
    expect(result.correction[0].correct).toBe(true);
    expect(result.correction[0].reponse_eleve).toBe("Awa Diallo");
    expect(result.correction[0].learner_justification).toBe("Elle se présente explicitement au début du dialogue.");
    expect(result.correction[0].bonne_reponse).toBe(RAW_ITEM_B1.bonne_reponse);
  });

  it("restitution après libération : CorrectionGate (rendu réel) affiche la justification de l'apprenant, jamais la bonne réponse quand la réponse est correcte", () => {
    act(() => root.render(
      <CorrectionGate
        correction={{
          status: "completed",
          released: true,
          correction_viewed_at: new Date().toISOString(),
          item_results: {
            "0": {
              question: RAW_ITEM_B1.question,
              reponse_donnee: "Awa Diallo",
              bonne_reponse: RAW_ITEM_B1.bonne_reponse,
              correct: true,
              explication: RAW_ITEM_B1.explication,
              learner_justification: "Elle se présente explicitement au début du dialogue.",
            },
          },
        } as any}
        onViewCorrection={() => {}}
      />,
    ));

    expect(container.textContent).toContain("Ta justification");
    expect(container.textContent).toContain("Elle se présente explicitement au début du dialogue.");
    // Bonne réponse : "Réponse attendue" ne doit PAS être affiché (seulement
    // pour les réponses fausses).
    expect(container.textContent).not.toContain("Réponse attendue");
  });
});
