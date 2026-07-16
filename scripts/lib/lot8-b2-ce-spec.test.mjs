import { describe, expect, it } from "vitest";
import {
  LOT8_B2_CE_SLOTS,
  buildDeterministicExercise,
  checkEntryConstraints,
  checkTextWordCount,
  countDistinctThemes,
  countWords,
  finalizeDraftExercise,
  normalizeVraiFauxItem,
  summarizeManifest,
} from "./lot8-b2-ce-spec.mjs";
import { runValidationChain } from "../../supabase/functions/_shared/validation-chain.ts";
import { hasUsableContent } from "../../supabase/functions/_shared/exercise-search.ts";

describe("lot8-b2-ce-spec", () => {
  it("définit exactement 5 slots B2 CE", () => {
    expect(LOT8_B2_CE_SLOTS).toHaveLength(5);
    expect(LOT8_B2_CE_SLOTS.map((s) => s.metadata_code)).toEqual([
      "sf-p0:B2:CE:001",
      "sf-p0:B2:CE:002",
      "sf-p0:B2:CE:003",
      "sf-p0:B2:CE:004",
      "sf-p0:B2:CE:005",
    ]);
  });

  it("normalise vrai/faux avec options canoniques", () => {
    const item = normalizeVraiFauxItem({ question: "Test ?", bonne_reponse: "Vrai" });
    expect(item.bonne_reponse).toBe("vrai");
    expect(item.options).toEqual(["vrai", "faux"]);
  });

  it("gabarits déterministes : texte 150–250 mots et ≥3 thèmes", () => {
    const drafts = LOT8_B2_CE_SLOTS.map((slot) => buildDeterministicExercise(slot));
    for (const draft of drafts) {
      expect(checkTextWordCount(draft)).toBe(true);
      expect(draft.niveau_vise).toBe("B2");
      expect(draft.competence).toBe("CE");
      expect(draft.source).toBe("search_first_p0");
      expect(draft.difficulte).toBe(5);
      expect(draft.niveau_guidage).toBe("autonome");
      for (const item of draft.contenu.items) {
        expect(item.correction?.bonne_reponse).toBe(item.bonne_reponse);
        expect(item.correction?.preuve_support).toBeTruthy();
        expect(item.correction?.remediation).toBeTruthy();
        if (Array.isArray(item.options) && item.options.length > 1) {
          expect(item.correction?.explication_distracteurs).toHaveLength(item.options.length - 1);
        }
      }
    }
    expect(countDistinctThemes(drafts.map((d) => ({ draft: d })))).toBeGreaterThanOrEqual(3);
  });

  it("validation generated_strict : pas de codes interdits", async () => {
    for (const slot of LOT8_B2_CE_SLOTS) {
      const draft = buildDeterministicExercise(slot);
      const validation = await runValidationChain(
        { id: draft.metadata_code, ...draft },
        { profile: "generated_strict", context: { targetNiveauVise: "B2", targetThemeId: draft.theme } },
      );
      const checks = checkEntryConstraints(draft, validation);
      expect(hasUsableContent(draft)).toBe(true);
      expect(validation.status).not.toBe("rejected");
      expect(checks.noForbiddenCodes).toBe(true);
      expect(checks.textWordCountOk).toBe(true);
    }
  });

  it("distribution formats : 3 qcm, 1 vf, 1 texte_lacunaire", () => {
    const summary = summarizeManifest(
      LOT8_B2_CE_SLOTS.map((slot) => ({
        draft: buildDeterministicExercise(slot),
      })),
    );
    expect(summary.formats).toEqual({ qcm: 3, vrai_faux: 1, texte_lacunaire: 1 });
  });

  it("countWords ignore espaces superflus", () => {
    expect(countWords("  un   deux  trois  ")).toBe(3);
  });

  it("finalizeDraftExercise conserve metadata CE3", () => {
    const slot = LOT8_B2_CE_SLOTS[0];
    const draft = finalizeDraftExercise(slot, {
      titre: "T",
      consigne: "C",
      contenu: { texte: "x".repeat(160), items: [{ question: "Q?", bonne_reponse: "a" }] },
    });
    expect(draft.contenu.metadata.code).toBe("CE3");
    expect(draft.contenu.metadata.time_limit_seconds).toBeGreaterThan(0);
  });
});
