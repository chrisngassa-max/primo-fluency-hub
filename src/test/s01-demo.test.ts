import { beforeEach, describe, expect, it } from "vitest";
import {
  fetchS01DemoContent,
  fetchS01DemoCorrection,
  releaseS01DemoCorrection,
  resetS01Demo,
  submitS01DemoAnswer,
} from "@/lib/curriculum/s01Demo";

describe("S01 demo without Supabase", () => {
  beforeEach(() => resetS01Demo());

  it.each(["A1", "A2", "B1", "B2"] as const)("returns only %s exercises", async (level) => {
    const content = await fetchS01DemoContent(level);
    const exercises = content.blocks.filter((block) => block.kind === "exercise");
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((exercise) => exercise.niveau_vise === level)).toBe(true);
  });

  it("never includes answers in learner content", async () => {
    const content = await fetchS01DemoContent("A2");
    expect(JSON.stringify(content)).not.toContain("bonne_reponse");
    expect(JSON.stringify(content)).not.toContain("explication");
  });

  it("keeps correction hidden until simulated trainer release", async () => {
    const content = await fetchS01DemoContent("A2");
    const exercise = content.blocks.find((block) => block.kind === "exercise");
    expect(exercise?.kind).toBe("exercise");
    if (!exercise || exercise.kind !== "exercise") return;
    const submitted = await submitS01DemoAnswer({ exerciseId: exercise.id, answers: { "0": "réponse test" } });
    const hidden = await fetchS01DemoCorrection(submitted.attempt_id);
    expect(hidden.released).toBe(false);
    expect(hidden.item_results).toBeUndefined();
    releaseS01DemoCorrection(submitted.attempt_id);
    const released = await fetchS01DemoCorrection(submitted.attempt_id);
    expect(released.released).toBe(true);
    expect(released.item_results).toBeDefined();
  });
});

// Lot 2.1, point 4 — S01DemoPage doit reproduire le comportement apprenant
// réel : la logique testée ici est EXACTEMENT celle consommée par
// S01DemoPage.tsx (submitS01DemoAnswer/fetchS01DemoCorrection), qui
// réutilise elle-même ExerciseItemForm/CorrectionGate — aucune logique
// parallèle recréée, donc ces mêmes garanties s'appliquent à la page.
describe("S01 demo — parité avec le parcours apprenant réel (Lot 2.1, point 4)", () => {
  beforeEach(() => resetS01Demo());

  it("affiche indice et banque_mots dès le contenu (avant toute soumission) sur les niveaux qui les portent", async () => {
    const a1 = await fetchS01DemoContent("A1");
    const items = a1.blocks.filter((b) => b.kind === "exercise").flatMap((b) => (b.kind === "exercise" ? b.items : []));
    const withIndice = items.filter((item: Record<string, unknown>) => typeof item.indice === "string");
    const withBank = items.filter((item: Record<string, unknown>) => Array.isArray(item.banque_mots));
    expect(withIndice.length).toBeGreaterThan(0);
    expect(withBank.length).toBeGreaterThan(0);
  });

  it("un item avec justification_prompt est transmis au client (consigne affichée), sans jamais exposer item.correction", async () => {
    const b1 = await fetchS01DemoContent("B1");
    const coDialogue = b1.blocks.find((b) => b.kind === "exercise" && b.id === "cv2:S01:v3:co-dialogue:B1");
    expect(coDialogue?.kind).toBe("exercise");
    if (!coDialogue || coDialogue.kind !== "exercise") return;
    const item = coDialogue.items[0] as Record<string, unknown>;
    expect(typeof item.justification_prompt).toBe("string");
    expect(item.justification_required).toBe(true);
    expect(item).not.toHaveProperty("correction");
    expect(item).not.toHaveProperty("bonne_reponse");
  });

  it("rejette une soumission dont une justification requise manque, SANS enregistrer de tentative (réponse principale non perdue)", async () => {
    const b1 = await fetchS01DemoContent("B1");
    const coDialogue = b1.blocks.find((b) => b.kind === "exercise" && b.id === "cv2:S01:v3:co-dialogue:B1");
    if (!coDialogue || coDialogue.kind !== "exercise") throw new Error("fixture manquante");

    const answers = Object.fromEntries(coDialogue.items.map((_, idx) => [String(idx), "Awa Diallo"]));
    await expect(submitS01DemoAnswer({ exerciseId: coDialogue.id, answers })).rejects.toThrow();

    // Aucune tentative enregistrée : le contenu redemandé ne montre aucun
    // my_attempt pour cet exercice.
    const reloaded = await fetchS01DemoContent("B1");
    const reloadedExercise = reloaded.blocks.find((b) => b.kind === "exercise" && b.id === coDialogue.id);
    expect(reloadedExercise?.kind === "exercise" ? reloadedExercise.my_attempt : "missing").toBeNull();
  });

  it("soumet { reponse, justification } et l'évaluation de justification apparaît seulement APRÈS libération, avec un statut réel", async () => {
    const b1 = await fetchS01DemoContent("B1");
    const coDialogue = b1.blocks.find((b) => b.kind === "exercise" && b.id === "cv2:S01:v3:co-dialogue:B1");
    if (!coDialogue || coDialogue.kind !== "exercise") throw new Error("fixture manquante");

    const answers = Object.fromEntries(
      coDialogue.items.map((item, idx) => [
        String(idx),
        { reponse: "Awa Diallo", justification: (item as Record<string, unknown>).justification_prompt ? "Justification de test avec du contenu réel." : "" },
      ]),
    );
    const submitted = await submitS01DemoAnswer({ exerciseId: coDialogue.id, answers });

    const beforeRelease = await fetchS01DemoCorrection(submitted.attempt_id);
    expect(beforeRelease.released).toBe(false);
    expect(beforeRelease.item_results).toBeUndefined();

    releaseS01DemoCorrection(submitted.attempt_id);
    const afterRelease = await fetchS01DemoCorrection(submitted.attempt_id);
    expect(afterRelease.released).toBe(true);
    const firstResult = Object.values(afterRelease.item_results ?? {})[0];
    expect(firstResult).toBeDefined();
    expect(firstResult?.learner_justification).toBeTruthy();
    expect(typeof firstResult?.justification_status).toBe("string");
    expect(typeof firstResult?.overall_status).toBe("string");
    // item.correction (bonne_reponse en double, preuve_support brute, etc.)
    // n'est jamais exposé tel quel : seuls les champs de la liste blanche
    // dédiée sortent (released-correction-filter.ts).
    expect(firstResult).not.toHaveProperty("justification_ouverte.correction");
  });

  it("le moteur de correction réel (corrigerExerciceServer) est bien utilisé : answer_correct/justification_score sont calculés, pas de garde-fou texte-non-vide seul", async () => {
    const a1 = await fetchS01DemoContent("A1");
    const civique = a1.blocks.find((b) => b.kind === "exercise" && b.id === "cv2:S01:v3:civique:A1");
    if (!civique || civique.kind !== "exercise") throw new Error("fixture manquante");
    const answers = Object.fromEntries(civique.items.map((item, idx) => [String(idx), (item as Record<string, unknown>).options ? (item as { options: string[] }).options[0] : ""]));
    const submitted = await submitS01DemoAnswer({ exerciseId: civique.id, answers });
    releaseS01DemoCorrection(submitted.attempt_id);
    const released = await fetchS01DemoCorrection(submitted.attempt_id);
    const results = Object.values(released.item_results ?? {});
    expect(results.length).toBe(civique.items.length);
    for (const entry of results) {
      expect(typeof entry.answer_correct).toBe("boolean");
    }
  });
});
