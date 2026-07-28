import { describe, expect, it } from "vitest";
import { familyVariantToExerciceRow } from "../../supabase/functions/_shared/family-to-exercice-adapter.ts";

describe("familyVariantToExerciceRow", () => {
  it("publishes the A2 CO variant with its traceability metadata", () => {
    const row = familyVariantToExerciceRow({
      family_id: "A2CO-TEST01",
      schema_version: "slice-1.0",
      source_document: { source_document_id: "source-1", content_hash: "sha256:abc" },
      facts: {
        facts_hash: "facts-hash",
        required: [{ fact_id: "F1", provenance: { segment_refs: ["segment-1"], chunk_refs: ["chunk-1"] } }],
      },
      variants: {
        A2: {
          exercise: {
            title: "Annonce",
            instruction: "Écoutez.",
            format: "mixed",
            items: [{ id: "I1" }],
          },
        },
      },
    } as any, "trainer-1", "Bonjour, le train part à dix-sept heures.", "point-1");

    expect(row).toMatchObject({
      formateur_id: "trainer-1",
      point_a_maitriser_id: "point-1",
      titre: "Annonce",
      consigne: "Écoutez.",
      competence: "CO",
      format: "qcm",
      niveau_vise: "A2",
      contenu: {
        items: [{ id: "I1" }],
        script_audio: "Bonjour, le train part à dix-sept heures.",
        metadata: {
          differentiation_family_id: "A2CO-TEST01",
          source_document_id: "source-1",
          facts_hash: "facts-hash",
        },
      },
    });
  });
});
