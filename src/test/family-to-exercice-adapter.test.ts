import { describe, expect, it } from "vitest";
import { familyVariantToExerciceRow } from "../../supabase/functions/_shared/family-to-exercice-adapter.ts";

const baseFamily = {
  family_id: "A2CO-TEST01",
  schema_version: "slice-1.0",
  source_document: { source_document_id: "source-1", content_hash: "sha256:abc" },
  facts: {
    facts_hash: "facts-hash",
    required: [{ fact_id: "fact_01", provenance: { segment_refs: ["segment-1"], chunk_refs: ["chunk-1"] } }],
  },
  variants: {
    A2: {
      exercise: {
        title: "Annonce",
        instruction: "Écoutez.",
        format: "mixed",
        items: [{ id: "item_01" }],
      },
    },
  },
} as any;

describe("familyVariantToExerciceRow", () => {
  it("publishes the A2 CO variant with its traceability metadata", () => {
    const row = familyVariantToExerciceRow(
      baseFamily, "trainer-1", "Bonjour, le train part à dix-sept heures.", "point-1",
    );

    expect(row).toMatchObject({
      formateur_id: "trainer-1",
      point_a_maitriser_id: "point-1",
      titre: "Annonce",
      consigne: "Écoutez.",
      competence: "CO",
      format: "qcm",
      niveau_vise: "A2",
      contenu: {
        items: [{ id: "item_01" }],
        script_audio: "Bonjour, le train part à dix-sept heures.",
        metadata: {
          differentiation_family_id: "A2CO-TEST01",
          source_document_id: "source-1",
          facts_hash: "facts-hash",
        },
      },
    });
  });

  it("embarque une référence audio stable (sans bucket/path) quand audioRef est fourni", () => {
    const audioRef = {
      source_id: "src-uuid",
      source_content_hash: "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      mime_type: "audio/mpeg",
    };
    const row: any = familyVariantToExerciceRow(baseFamily, "trainer-1", "script", "point-1", audioRef);

    expect(row.contenu.audio).toEqual(audioRef);
    // Sécurité : JAMAIS de bucket/chemin Storage dans contenu.
    expect(row.contenu.audio).not.toHaveProperty("storage_bucket");
    expect(row.contenu.audio).not.toHaveProperty("storage_path");
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("storage_bucket");
    expect(serialized).not.toContain("storage_path");
  });

  it("n'ajoute pas de clé audio quand audioRef est null (exercice non audio)", () => {
    const row: any = familyVariantToExerciceRow(baseFamily, "trainer-1", "script", "point-1", null);
    expect(row.contenu).not.toHaveProperty("audio");
  });

  it("n'ajoute pas de clé audio quand audioRef est omis (rétrocompatibilité)", () => {
    const row: any = familyVariantToExerciceRow(baseFamily, "trainer-1", "script", "point-1");
    expect(row.contenu).not.toHaveProperty("audio");
    // Les autres champs restent intacts.
    expect(row.contenu.script_audio).toBe("script");
    expect(row.contenu.items).toEqual([{ id: "item_01" }]);
  });
});
