import { describe, expect, it } from "vitest";
import {
  collectQueryErrors,
  formatStudentRealName,
  PERIODE_DEPUIS_DEBUT,
  resolvePeriodBounds,
  resolveStudentExportLabel,
  studentExportLabel,
} from "@/lib/reportExportPrivacy";

describe("reportExportPrivacy", () => {
  it("studentExportLabel uses letters without PII", () => {
    expect(studentExportLabel(0)).toBe("Apprenant_A");
    expect(studentExportLabel(1)).toBe("Apprenant_B");
    expect(studentExportLabel(26)).toBe("Apprenant_A_2");
  });

  it("formatStudentRealName joins prenom and nom", () => {
    expect(formatStudentRealName({ id: "1", prenom: "Marie", nom: "Dupont" })).toBe("Marie Dupont");
    expect(formatStudentRealName({ id: "1" })).toBe("Élève");
  });

  it("resolveStudentExportLabel uses real names by default", () => {
    const eleves = [
      { id: "bbb-uuid", prenom: "Bob", nom: "Martin" },
      { id: "aaa-uuid", prenom: "Alice", nom: "Durand" },
    ];
    expect(resolveStudentExportLabel("aaa-uuid", eleves)).toBe("Alice Durand");
    expect(resolveStudentExportLabel("bbb-uuid", eleves)).toBe("Bob Martin");
  });

  it("resolvePeriodBounds handles depuis_le_debut", () => {
    const start = "2025-01-01T00:00:00.000Z";
    const bounds = resolvePeriodBounds(PERIODE_DEPUIS_DEBUT, start);
    expect(bounds.dateDebut.toISOString()).toBe(start);
    expect(bounds.nbJours).toBeGreaterThan(0);
    expect(bounds.label).toContain("Depuis le");
  });

  it("resolvePeriodBounds handles fixed day windows", () => {
    const bounds = resolvePeriodBounds("30");
    expect(bounds.nbJours).toBe(30);
    expect(bounds.label).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("collectQueryErrors surfaces failed Supabase queries", () => {
    const errors = collectQueryErrors(
      [{ error: null }, { error: { message: "permission denied" } }],
      ["profil", "resultats"],
    );
    expect(errors).toEqual(["resultats: permission denied"]);
  });
});
