import { describe, expect, it } from "vitest";
import { buildDraft } from "./publish-s01-interactive.mjs";
import { buildInteractiveS01 } from "./generate-s01-interactive.mjs";

describe("publish-s01-interactive — adaptateur du pont existant", () => {
  it("ne fixe jamais pedagogical_status au-delà de 'draft'", async () => {
    const payload = await buildInteractiveS01();
    for (const entry of payload.exercises) {
      const draft = buildDraft(entry);
      expect(draft.pedagogical_status).toBe("draft");
    }
  });

  it("propage needs_content_review depuis contenu.metadata sans le perdre", async () => {
    const payload = await buildInteractiveS01();
    const belowFloor = payload.exercises.find((e) => e.contenu.metadata.needs_content_review);
    expect(belowFloor).toBeDefined();
    const draft = buildDraft(belowFloor);
    expect(draft.needs_content_review).toBe(true);
  });

  it("ne pose jamais family_id/extension_of_family_id comme colonne top-level (absente de la table exercices)", async () => {
    const payload = await buildInteractiveS01();
    const withFamily = payload.exercises.find((e) => e.family_id);
    expect(withFamily).toBeDefined();
    const draft = buildDraft(withFamily);
    expect(draft.family_id).toBeUndefined();
    expect(draft.extension_of_family_id).toBeUndefined();
    // La donnée n'est pas perdue : elle vit dans contenu.metadata (comme le
    // fait déjà publish-bridge-lib.mjs pour differentiation_contract.family_id).
    expect(draft.contenu.metadata.family_id).toBe(withFamily.family_id);
  });

  it("propage civic_content/civic_fact_ids réels (jamais fabriqués)", async () => {
    const payload = await buildInteractiveS01();
    const civic = payload.exercises.find((e) => e.civic_content);
    expect(civic).toBeDefined();
    const draft = buildDraft(civic);
    expect(draft.civic_content).toBe(true);
    expect(draft.civic_fact_ids.length).toBeGreaterThan(0);
  });

  it("le metadata_code de chaque draft reste unique (clé d'upsert idempotent)", async () => {
    const payload = await buildInteractiveS01();
    const drafts = payload.exercises.map(buildDraft);
    const codes = drafts.map((d) => d.metadata_code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
