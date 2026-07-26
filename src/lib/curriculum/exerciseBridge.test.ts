import { describe, expect, it } from "vitest";
import { inferCurriculumSessionCode } from "./sessionCode";

describe("inferCurriculumSessionCode", () => {
  it.each([
    ["Séance 1 : Faire connaissance et épeler son nom", "S01"],
    ["S1 : Faire connaissance", "S01"],
    ["S01 — Accueil, objectifs et cinq thèmes", "S01"],
    ["Séance 12 : La pharmacie", "S12"],
  ])("déduit le code curriculum depuis %s", (title, expected) => {
    expect(inferCurriculumSessionCode(title)).toBe(expected);
  });

  it.each([[null], [""], ["Atelier libre"], ["Séance 38 : hors parcours"]])(
    "refuse les titres non rattachables (%s)",
    (title) => expect(inferCurriculumSessionCode(title)).toBeNull(),
  );
});
