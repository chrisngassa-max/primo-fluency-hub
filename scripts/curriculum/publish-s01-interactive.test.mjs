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

  it("pose explicitement statut='draft'/is_live_ready=false/pedagogical_status='draft' sur CHAQUE draft (4e relecture, point 6)", async () => {
    // Revirement assumé par rapport à la version précédente de ce test (qui
    // vérifiait l'absence de ces clés) : décision explicite du porteur
    // projet, la réingestion doit désormais reposer ces trois champs à
    // chaque exécution, y compris sur une ligne déjà published/is_live_ready
    // (voir test suivant, qui simule exactement ce cas via upsertExercice).
    const payload = await buildInteractiveS01();
    for (const entry of payload.exercises) {
      const draft = buildDraft(entry);
      expect(draft.statut).toBe("draft");
      expect(draft.is_live_ready).toBe(false);
      expect(draft.pedagogical_status).toBe("draft");
    }
  });

  it("une réingestion referme une ligne existante déjà published/is_live_ready=true (simulation upsertExercice)", async () => {
    // Simule exactement le chemin réel : upsertExercice (publish-bridge.mjs)
    // fait un UPDATE({...draft, formateur_id, point_a_maitriser_id}) sur une
    // ligne existante. On vérifie ici que le payload construit par
    // buildDraft, une fois fusionné comme le ferait cet UPDATE, referme bien
    // une ligne préalablement exposée — sans dépendre d'une vraie base
    // (aucune instance Postgres disponible dans cet environnement).
    const payload = await buildInteractiveS01();
    const entry = payload.exercises[0];
    const existingRowBeforeReingestion = {
      id: "existing-row-id",
      metadata_code: entry.metadata_code,
      statut: "published",
      is_live_ready: true,
      pedagogical_status: "published",
    };
    const draft = buildDraft(entry);
    const updatePayload = { ...draft, formateur_id: "formateur-1", point_a_maitriser_id: "point-1" };
    const rowAfterReingestion = { ...existingRowBeforeReingestion, ...updatePayload };

    expect(rowAfterReingestion.statut).toBe("draft");
    expect(rowAfterReingestion.is_live_ready).toBe(false);
    expect(rowAfterReingestion.pedagogical_status).toBe("draft");
  });
});
