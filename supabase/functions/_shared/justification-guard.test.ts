// Lot 2 — garde-fou justification obligatoire (défense en profondeur
// serveur, indépendante de la validation client).
import { describe, expect, it } from "vitest";
import {
  extractJustificationText,
  findMissingRequiredJustifications,
  hasNonEmptyJustification,
  isStructuredAnswer,
} from "./justification-guard.ts";

describe("isStructuredAnswer / extractJustificationText / hasNonEmptyJustification", () => {
  it("distingue une réponse structurée d'une chaîne simple, d'un tableau ou de null", () => {
    expect(isStructuredAnswer({ reponse: "A" })).toBe(true);
    expect(isStructuredAnswer("A")).toBe(false);
    expect(isStructuredAnswer(["A"])).toBe(false);
    expect(isStructuredAnswer(null)).toBe(false);
    expect(isStructuredAnswer(undefined)).toBe(false);
  });

  it("extrait et nettoie la justification d'une réponse structurée", () => {
    expect(extractJustificationText({ reponse: "A", justification: "  car... " })).toBe("car...");
    expect(extractJustificationText({ reponse: "A", justification: "   " })).toBe("");
    expect(extractJustificationText({ reponse: "A" })).toBe("");
    expect(extractJustificationText("A")).toBe("");
  });

  it("hasNonEmptyJustification reflète exactement extractJustificationText", () => {
    expect(hasNonEmptyJustification({ reponse: "A", justification: "car..." })).toBe(true);
    expect(hasNonEmptyJustification({ reponse: "A", justification: "" })).toBe(false);
    expect(hasNonEmptyJustification("A")).toBe(false);
  });
});

describe("findMissingRequiredJustifications", () => {
  const items = [
    { justification_required: false },
    { justification_required: true },
    { justification_required: true },
    {},
  ];

  it("ne signale rien quand toutes les justifications requises sont présentes", () => {
    const answers = {
      0: "A",
      1: { reponse: "B", justification: "Parce que le support le dit." },
      2: { reponse: "C", justification: "Explication réelle." },
      3: "D",
    };
    expect(findMissingRequiredJustifications(items, answers)).toEqual([]);
  });

  it("signale l'index d'un item requis dont la réponse est une simple chaîne (pas de justification du tout)", () => {
    const answers = { 0: "A", 1: "B", 2: { reponse: "C", justification: "ok" }, 3: "D" };
    expect(findMissingRequiredJustifications(items, answers)).toEqual([1]);
  });

  it("signale l'index d'un item requis dont la justification est vide ou blanche", () => {
    const answers = {
      0: "A",
      1: { reponse: "B", justification: "   " },
      2: { reponse: "C", justification: "" },
      3: "D",
    };
    expect(findMissingRequiredJustifications(items, answers)).toEqual([1, 2]);
  });

  it("ne signale jamais un item où justification_required est faux ou absent, même sans justification", () => {
    const answers = { 0: "A", 1: { reponse: "B", justification: "ok" }, 2: { reponse: "C", justification: "ok" }, 3: "D" };
    expect(findMissingRequiredJustifications(items, answers)).toEqual([]);
  });

  it("accepte les clés answers en index numérique ou en chaîne", () => {
    const answers = { "0": "A", "1": { reponse: "B", justification: "ok" }, 2: { reponse: "C", justification: "ok" }, "3": "D" };
    expect(findMissingRequiredJustifications(items, answers)).toEqual([]);
  });

  it("une réponse manquante (index absent de answers) pour un item requis est signalée", () => {
    const answers = { 0: "A", 2: { reponse: "C", justification: "ok" }, 3: "D" };
    expect(findMissingRequiredJustifications(items, answers)).toEqual([1]);
  });
});
