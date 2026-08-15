import { describe, expect, it } from "vitest";
import { familyVariantToExerciceRow } from "../../supabase/functions/_shared/family-to-exercice-adapter.ts";

function familyFor(level: "A1" | "A2" | "B1" | "B2") {
  return {
    family_id: `${level}CO-TEST01`,
    schema_version: "slice-1.0",
    generated_levels: [level],
    source_document: { source_document_id: "source-1", content_hash: "sha256:abc" },
    facts: {
      facts_hash: "facts-hash",
      required: [{ fact_id: "fact_01", provenance: { segment_refs: ["segment-1"], chunk_refs: ["chunk-1"] } }],
    },
    level_contracts: { [level]: { target_level: level } },
    variants: {
      [level]: {
        target_level: level,
        transformation_id: level === "A2" ? "IDENTITY" : `A2_TO_${level}`,
        exercise: {
          title: "Annonce",
          instruction: "Écoutez.",
          format: "mixed",
          items: [{ id: "item_01" }],
        },
      },
    },
  } as any;
}

const baseFamily = familyFor("A2");

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
          target_level: "A2",
        },
      },
    });
  });

  it.each(["A1", "A2", "B1", "B2"] as const)("publishes niveau_vise %s with original MP3 ref metadata", (level) => {
    const row: any = familyVariantToExerciceRow(
      familyFor(level),
      "trainer-1",
      "script",
      "point-1",
      {
        source_id: "src-uuid",
        source_content_hash: "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        mime_type: "audio/mpeg",
      },
      "1.1",
    );
    expect(row.niveau_vise).toBe(level);
    expect(row.contenu.metadata.target_level).toBe(level);
    expect(row.contenu.metadata.referential_version).toBe("1.1");
    expect(row.contenu.metadata.source_id).toBe("source-1");
    expect(row.contenu.metadata.family_id).toBe(`${level}CO-TEST01`);
    expect(row.contenu.audio.source_id).toBe("src-uuid");
    expect(JSON.stringify(row)).not.toContain("storage_bucket");
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
