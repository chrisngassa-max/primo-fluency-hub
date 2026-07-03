import { describe, expect, it } from "vitest";
import {
  collectQueryErrors,
  resolveStudentExportLabel,
  studentExportLabel,
} from "@/lib/reportExportPrivacy";

describe("reportExportPrivacy", () => {
  it("studentExportLabel uses letters without PII", () => {
    expect(studentExportLabel(0)).toBe("Apprenant_A");
    expect(studentExportLabel(1)).toBe("Apprenant_B");
    expect(studentExportLabel(26)).toBe("Apprenant_A_2");
  });

  it("resolveStudentExportLabel is stable per group ordering", () => {
    const eleves = [
      { id: "bbb-uuid" },
      { id: "aaa-uuid" },
    ];
    expect(resolveStudentExportLabel("aaa-uuid", eleves)).toBe("Apprenant_A");
    expect(resolveStudentExportLabel("bbb-uuid", eleves)).toBe("Apprenant_B");
  });

  it("collectQueryErrors surfaces failed Supabase queries", () => {
    const errors = collectQueryErrors(
      [{ error: null }, { error: { message: "permission denied" } }],
      ["profil", "resultats"],
    );
    expect(errors).toEqual(["resultats: permission denied"]);
  });
});
