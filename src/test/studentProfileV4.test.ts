import { describe, expect, it } from "vitest";
import {
  buildStudentProfileV4,
  deriveCecrlLevel,
  deriveFragilitePrincipale,
} from "@/lib/studentProfileV4";

describe("deriveCecrlLevel", () => {
  it("applies V4 score boundaries", () => {
    expect(deriveCecrlLevel(39)).toBe("A0");
    expect(deriveCecrlLevel(40)).toBe("A1");
    expect(deriveCecrlLevel(59)).toBe("A1");
    expect(deriveCecrlLevel(60)).toBe("A2");
    expect(deriveCecrlLevel(69)).toBe("A2");
    expect(deriveCecrlLevel(70)).toBe("B1");
    expect(deriveCecrlLevel(79)).toBe("B1");
    expect(deriveCecrlLevel(80)).toBe("B2");
  });
});

describe("deriveFragilitePrincipale", () => {
  it("returns the lowest scoring competence", () => {
    expect(deriveFragilitePrincipale({ CO: 75, CE: 42, EE: 61, EO: 80 })).toBe("CE");
  });

  it("uses CO > CE > EE > EO as tie-break order", () => {
    expect(deriveFragilitePrincipale({ CO: 50, CE: 50, EE: 50, EO: 50 })).toBe("CO");
    expect(deriveFragilitePrincipale({ CO: 80, CE: 40, EE: 40, EO: 40 })).toBe("CE");
    expect(deriveFragilitePrincipale({ CO: 80, CE: 80, EE: 30, EO: 30 })).toBe("EE");
  });
});

describe("buildStudentProfileV4", () => {
  it("maps existing profils_eleves fields to the canonical profile", () => {
    const profile = buildStudentProfileV4({
      id: "profile-row",
      eleve_id: "student-id",
      taux_reussite_co: 38,
      taux_reussite_ce: 63,
      taux_reussite_ee: 71,
      taux_reussite_eo: 84,
      type_erreur_dominant: "linguistique",
      priorites_pedagogiques: {
        langue_maternelle: "arabe",
        niveau_scolarisation: "secondaire",
      },
      seances_consecutives_sous_60: { CO: 2, CE: 0, EE: 1, EO: 0 },
      dernier_score_phase2_ce: "66",
      montee_auto_phase2: true,
      updated_at: "2026-06-04T00:00:00Z",
    });

    expect(profile.apprenant_id).toBe("student-id");
    expect(profile.score_co).toBe(38);
    expect(profile.niveau_co).toBe("A0");
    expect(profile.niveau_ce).toBe("A2");
    expect(profile.niveau_ee).toBe("B1");
    expect(profile.niveau_eo).toBe("B2");
    expect(profile.fragilite_principale).toBe("CO");
    expect(profile.type_erreur_dominant).toBe("linguistique");
    expect(profile.langue_maternelle).toBe("arabe");
    expect(profile.seances_consecutives_sous_60.CO).toBe(2);
    expect(profile.dernier_score_phase2_ce).toBe(66);
    expect(profile.montee_auto_phase2).toBe(true);
  });
});
