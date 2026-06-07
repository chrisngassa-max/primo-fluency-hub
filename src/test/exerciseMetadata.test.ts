import { describe, expect, it } from "vitest";
import { structuredExerciseMetadata } from "@/lib/exerciseMetadata";

describe("structuredExerciseMetadata", () => {
  it("normalizes generated metadata into database columns", () => {
    expect(structuredExerciseMetadata({
      metadata: {
        code: "CO2",
        skill: "Compréhension orale",
        sub_skill: "Identifier le lieu",
        time_limit_seconds: 90,
        aides_disponibles: ["lexique", "indice"],
        nombre_ecoutes_max: 2,
        transcription_verrouillee: true,
        objectif_tcf: "Comprendre_Info_Explicite",
        type_differenciation: "Consolidation",
      },
      contenu: {},
    })).toEqual({
      metadata_code: "CO2",
      metadata_skill: "Compréhension orale",
      sous_competence: "Identifier le lieu",
      duree_limite_secondes: 90,
      aides_disponibles: ["lexique", "indice"],
      nombre_ecoutes_max: 2,
      transcription_verrouillee: true,
      objectif_tcf: "comprendre_info_explicite",
      type_differenciation: "consolidation",
    });
  });

  it("reads legacy contenu and rejects out-of-range values", () => {
    expect(structuredExerciseMetadata({
      contenu: {
        duree_estimee_secondes: 120,
        nombre_ecoutes_max: 99,
        objectif_tcf: "",
        aides_disponibles: ["exemple"],
      },
    })).toMatchObject({
      duree_limite_secondes: 120,
      nombre_ecoutes_max: null,
      objectif_tcf: null,
      aides_disponibles: ["exemple"],
    });
  });
});
