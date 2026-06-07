import { describe, expect, it } from "vitest";
import { attendanceLabel, qualitativeProgress } from "@/lib/qualitativeProgress";

describe("qualitativeProgress", () => {
  it("maps scores to the four learner-facing acquisition levels", () => {
    expect(qualitativeProgress(20).level).toBe("a_reprendre");
    expect(qualitativeProgress(40).level).toBe("en_cours");
    expect(qualitativeProgress(65).level).toBe("consolide");
    expect(qualitativeProgress(85).level).toBe("pret_niveau_superieur");
  });

  it("provides qualitative attendance labels", () => {
    expect(attendanceLabel(90)).toBe("Très régulière");
    expect(attendanceLabel(70)).toBe("Régulière");
    expect(attendanceLabel(40)).toBe("À renforcer");
  });
});
