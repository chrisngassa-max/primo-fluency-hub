import { describe, expect, it } from "vitest";
import {
  createDefaultSessionTemplateV4,
  validateSessionTemplateV4,
} from "@/lib/sessionTemplateV4";

describe("SessionTemplateV4", () => {
  it("creates the five required phases for the CE/CO MVP", () => {
    const template = createDefaultSessionTemplateV4({
      theme: "logement",
      objectif_commun: "Comprendre une annonce de logement et une information pratique.",
    });

    expect(Object.keys(template.phases)).toEqual([
      "phase1_ouverture",
      "phase2_tronc_commun",
      "phase3_atelier_cible",
      "phase4_mise_en_commun",
      "phase5_devoir",
    ]);
    expect(template.mvp_competences).toEqual(["CE", "CO"]);
    expect(template.phases.phase1_ouverture.collective).toBe(true);
    expect(template.phases.phase4_mise_en_commun.collective).toBe(true);
    expect(validateSessionTemplateV4(template)).toEqual([]);
  });

  it("keeps the phase 2 automatic upgrade rule stable", () => {
    const template = createDefaultSessionTemplateV4({
      theme: "logement",
      objectif_commun: "Comprendre une annonce de logement.",
      competence_commune: "CO",
    });

    expect(template.phases.phase2_tronc_commun.competence_commune).toBe("CO");
    expect(template.phases.phase2_tronc_commun.regle_montee).toEqual({
      seuil_score: 80,
      nb_seances_consecutives: 2,
      action: "upgrade_support_niveau_suivant",
    });
  });

  it("rejects non-neutral student-facing messages", () => {
    const template = createDefaultSessionTemplateV4({
      theme: "logement",
      objectif_commun: "Comprendre une annonce de logement.",
    });
    template.phases.phase3_atelier_cible.message_apprenant_template = "Tu es faible en CO, remédiation.";

    expect(validateSessionTemplateV4(template)).toContain("phase3_student_message_not_neutral");
  });
});
