// Lot 1 (correctif, suite) — parseDifferentiationLevelStrict().
//
// Test de parité RÉELLE (pas une duplication de spec) : ce fichier importe
// directement l'adaptateur Deno (./referential-loader.ts, exécuté ici via
// Vitest/esbuild) ET l'adaptateur Node
// (scripts/curriculum/lib/differentiation-referential.mjs), et compare leur
// comportement sur les mêmes entrées.
import { describe, expect, it } from "vitest";
import * as deno from "./referential-loader.ts";
// deno-lint-ignore-file -- import Node volontaire pour la parité croisée.
import * as node from "../../../scripts/curriculum/lib/differentiation-referential.mjs";

const VALID_INPUTS = [
  "A1", "A2", "B1", "B2",
  "a1", "a2", "b1", "b2",
  " A1 ", "\tB2\n",
];

const INVALID_INPUTS = [
  "ZZ", "", "A1X", "B3", "A", "AA", "b2extra", " ", "null", "undefined",
  null, undefined, 123, {}, [], true, ["A1"],
];

describe("parseDifferentiationLevelStrict — API additive (Deno + Node)", () => {
  it("est exportée par les deux adaptateurs", () => {
    expect(typeof deno.parseDifferentiationLevelStrict).toBe("function");
    expect(typeof node.parseDifferentiationLevelStrict).toBe("function");
  });

  it("accepte les quatre niveaux valides, insensible à la casse et aux espaces, identique Deno/Node", () => {
    for (const input of VALID_INPUTS) {
      const denoResult = deno.parseDifferentiationLevelStrict(input);
      const nodeResult = node.parseDifferentiationLevelStrict(input);
      expect(denoResult).toBe(nodeResult);
      expect(["A1", "A2", "B1", "B2"]).toContain(denoResult);
    }
  });

  it("rejette toute entrée invalide (dont \"ZZ\") en levant une exception, identique Deno/Node — plus de coercion silencieuse vers A1", () => {
    for (const input of INVALID_INPUTS) {
      expect(() => deno.parseDifferentiationLevelStrict(input), `Deno: ${JSON.stringify(input)}`).toThrow();
      expect(() => node.parseDifferentiationLevelStrict(input), `Node: ${JSON.stringify(input)}`).toThrow();
    }
  });

  it("lève une DifferentiationLevelError explicite (pas une exception générique) côté Deno et côté Node", () => {
    expect(() => deno.parseDifferentiationLevelStrict("ZZ")).toThrow(deno.DifferentiationLevelError);
    expect(() => node.parseDifferentiationLevelStrict("ZZ")).toThrow(node.DifferentiationLevelError);

    let denoThrew = false;
    try {
      deno.parseDifferentiationLevelStrict("ZZ");
    } catch (error) {
      denoThrew = true;
      expect(String((error as Error).message)).toContain("ZZ");
      expect(String((error as Error).message)).toMatch(/A1.*A2.*B1.*B2/);
    }
    expect(denoThrew).toBe(true);

    let nodeThrew = false;
    try {
      node.parseDifferentiationLevelStrict("ZZ");
    } catch (error) {
      nodeThrew = true;
      expect(String(error.message)).toContain("ZZ");
      expect(String(error.message)).toMatch(/A1.*A2.*B1.*B2/);
    }
    expect(nodeThrew).toBe(true);
  });

  it("ne change rien au comportement historique de normalizeDifferentiationLevel (ZZ -> A1, toujours coercé, jamais levé)", () => {
    expect(deno.normalizeDifferentiationLevel("ZZ")).toBe("A1");
    expect(node.normalizeDifferentiationLevel("ZZ")).toBe("A1");
    expect(deno.normalizeDifferentiationLevel(undefined)).toBe("A2");
    expect(node.normalizeDifferentiationLevel(undefined)).toBe("A2");
    // Les deux fonctions coexistent : normalizeDifferentiationLevel() ne
    // lève jamais, parseDifferentiationLevelStrict() lève toujours sur la
    // même entrée invalide.
    expect(() => deno.parseDifferentiationLevelStrict("ZZ")).toThrow();
    expect(() => node.parseDifferentiationLevelStrict("ZZ")).toThrow();
  });

  it("expose la même liste DIFFERENTIATION_LEVELS des deux côtés", () => {
    expect([...deno.DIFFERENTIATION_LEVELS]).toEqual([...node.DIFFERENTIATION_LEVELS]);
    expect([...deno.DIFFERENTIATION_LEVELS]).toEqual(["A1", "A2", "B1", "B2"]);
  });
});
