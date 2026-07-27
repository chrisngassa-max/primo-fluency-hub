import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  pickCurriculumExercicesForPilot,
  selectLatestCurriculumRelease,
  type CurriculumExerciceRow,
} from "@/lib/curriculum/exerciseBridge";

function row(
  metadataCode: string,
  level: string,
  metadata: Record<string, unknown>,
): CurriculumExerciceRow {
  return {
    id: metadataCode,
    titre: metadataCode,
    consigne: "Consigne",
    competence: "CE",
    format: "qcm",
    niveau_vise: level,
    metadata_code: metadataCode,
    contenu: { metadata, items: [] },
  };
}

describe("curriculum exercise bridge", () => {
  it("préfère entièrement la dernière version publiée aux variantes historiques", () => {
    const rows = [
      row("cv2:S01:variant:A1", "A1", { niveau: "A1" }),
      row("cv2:S01:civic:01", "A2", {}),
      row("cv2:S01:v2:atelier:A1", "A1", { target_level: "A1" }),
      row("cv2:S01:v3:co-dialogue:A1", "A1", { target_level: "A1" }),
      row("cv2:S01:v3:atelier:A2", "A2", { target_level: "A2" }),
    ];

    expect(selectLatestCurriculumRelease(rows).map((exercise) => exercise.metadata_code))
      .toEqual(["cv2:S01:v3:co-dialogue:A1", "cv2:S01:v3:atelier:A2"]);
    expect(pickCurriculumExercicesForPilot(rows, "A2", true)).toHaveLength(2);
  });

  it("lit target_level et conserve le repli niveau pour les anciens contenus", () => {
    const versioned = row("cv2:S01:v3:atelier:B1", "B1", { target_level: "B1" });
    const legacy = row("cv2:S02:variant:A2", "A2", { niveau: "A2" });

    expect(pickCurriculumExercicesForPilot([versioned], "A2", true)).toEqual([versioned]);
    expect(pickCurriculumExercicesForPilot([legacy], "A2", true)).toEqual([legacy]);
  });
});