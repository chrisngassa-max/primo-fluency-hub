import { describe, expect, it } from "vitest";
import { buildExerciseMetadataV4 } from "@/lib/exerciseMetadataV4";

describe("buildExerciseMetadataV4", () => {
  it("normalizes the pilot metadata fields", () => {
    const metadata = buildExerciseMetadataV4({
      theme: "Préfecture",
      sous_competence: " reperage_info ",
      niveau_guidage: "semi-guide",
      outils_aide: ["Lexique", "photo", "inconnu", "photo"],
      duree_estimee_min: "12.4",
      autonomie_requise: "Moyenne",
      objectif_tcf: "Comprendre Info Explicite",
      regle_montee_auto: true,
    });

    expect(metadata).toEqual({
      theme: "prefecture",
      sous_competence: "reperage_info",
      niveau_guidage: "semi_guide",
      outils_aide: ["lexique", "photo"],
      duree_estimee_min: 12,
      autonomie_requise: "moyenne",
      objectif_tcf: "comprendre_info_explicite",
      regle_montee_auto: true,
    });
  });

  it("drops unknown values instead of inventing metadata", () => {
    const metadata = buildExerciseMetadataV4({
      theme: "cinema",
      niveau_guidage: "difficile",
      outils_aide: ["hors_liste"],
      duree_estimee_min: "abc",
      autonomie_requise: "seul",
      regle_montee_auto: false,
    });

    expect(metadata.theme).toBeNull();
    expect(metadata.niveau_guidage).toBeNull();
    expect(metadata.outils_aide).toEqual([]);
    expect(metadata.duree_estimee_min).toBeNull();
    expect(metadata.autonomie_requise).toBeNull();
    expect(metadata.regle_montee_auto).toBe(false);
  });
});
