import { describe, expect, it } from "vitest";
import {
  collectQueryErrors,
  fetchGroupStudentsForReports,
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

  it("fetchGroupStudentsForReports uses formateur-group-members edge function", async () => {
    const groupId = "group-a";
    const students = await fetchGroupStudentsForReports(
      {
        functions: {
          invoke: async () => ({
            data: {
              members: [
                {
                  group_id: groupId,
                  eleve_id: "e2",
                  eleve: { id: "e2", prenom: "Bob", nom: "Martin" },
                },
                {
                  group_id: "other-group",
                  eleve_id: "e9",
                  eleve: { id: "e9", prenom: "Zoe", nom: "Test" },
                },
                {
                  group_id: groupId,
                  eleve_id: "e1",
                  eleve: { id: "e1", prenom: "Alice", nom: "Durand" },
                },
              ],
            },
            error: null,
          }),
        },
        from: () => {
          throw new Error("direct query should not run when edge succeeds");
        },
      },
      groupId,
    );
    expect(students).toEqual([
      { id: "e1", prenom: "Alice", nom: "Durand" },
      { id: "e2", prenom: "Bob", nom: "Martin" },
    ]);
  });

  it("fetchGroupStudentsForReports falls back to group_members join", async () => {
    const groupId = "group-b";
    const students = await fetchGroupStudentsForReports(
      {
        functions: {
          invoke: async () => ({ data: { members: [] }, error: null }),
        },
        from: (table: string) => ({
          select: () => ({
            eq: async () => {
              if (table === "group_members") {
                return {
                  data: [
                    {
                      eleve_id: "e1",
                      profiles: { id: "e1", prenom: "Alice", nom: "Durand" },
                    },
                  ],
                  error: null,
                };
              }
              return { data: [], error: null };
            },
            in: async () => ({ data: [], error: null }),
          }),
        }),
      },
      groupId,
    );
    expect(students).toEqual([{ id: "e1", prenom: "Alice", nom: "Durand" }]);
  });
});
