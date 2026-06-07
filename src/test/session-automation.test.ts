import { describe, expect, it, vi } from "vitest";
import { calibrateRetrospective, determineBlocksToLaunch } from "../../supabase/functions/prepare-session-start/logic.ts";
import { parseNbQuestions, validateDiagnosticQuestions } from "../../supabase/functions/generate-diagnostic-test/logic.ts";
import { buildDurationPrompt, buildFocusPrompt, parseTargetDurationMinutes } from "../../supabase/functions/generate-exercises/logic.ts";
import { buildGenerationBatchSizes, clampExerciseCount } from "@/components/formateur/wizard/generation-settings";

describe("Edge Functions business logic", () => {
  describe("prepare-session-start", () => {
    it("should return blocks: [] when generation_automatique_activee is false and no specific block is requested", () => {
      const result = determineBlocksToLaunch(false, null);
      expect(result.blocks).toEqual([]);
      expect(result.automatic).toBe(false);
    });

    it("should allow manual block launch even when generation_automatique_activee is false", () => {
      const result = determineBlocksToLaunch(false, "diagnostic");
      expect(result.blocks).toEqual(["diagnostic"]);
      expect(result.automatic).toBe(false);
    });

    it("should launch all blocks when requestedBlock is not specified and generation is active", () => {
      const result = determineBlocksToLaunch(true, null);
      expect(result.blocks).toEqual(["retrospective", "diagnostic", "core"]);
      expect(result.automatic).toBe(true);
    });

    it("should launch only the requested block when requestedBlock is specified and generation is active", () => {
      const result = determineBlocksToLaunch(true, "core");
      expect(result.blocks).toEqual(["core"]);
      expect(result.automatic).toBe(false);
    });

    it("keeps the requested retrospective volume and warns when duration is too short", () => {
      const calibration = calibrateRetrospective(8, 10);
      expect(calibration.count).toBe(8);
      expect(calibration.estimatedMinutes).toBe(24);
      expect(calibration.warning).toContain("Le nombre choisi a ete conserve");
    });

    it("does not warn when the retrospective duration is sufficient", () => {
      expect(calibrateRetrospective(3, 12).warning).toBeNull();
    });
  });

  describe("generate-diagnostic-test", () => {
    it("parses and constrains question counts to 5-30 range", () => {
      expect(parseNbQuestions(15, null)).toBe(15);
      expect(parseNbQuestions(null, 25)).toBe(25);
      expect(parseNbQuestions(null, null)).toBe(10); // default
      expect(parseNbQuestions(3, null)).toBe(5);    // min
      expect(parseNbQuestions(35, null)).toBe(30);   // max
    });

    it("validates diagnostic questions correctly", () => {
      const validQuestions = [
        { competence: "CO", choix: ["A", "B", "C", "D"], consigne: "Q1", bonne_reponse: "A", explication: "X", niveau: "A1", difficulte: 2 },
        { competence: "CE", choix: ["A", "B", "C", "D"], consigne: "Q2", bonne_reponse: "B", explication: "Y", niveau: "A1", difficulte: 2 },
      ];

      expect(validateDiagnosticQuestions(validQuestions, 2)).toBeNull();

      // Mismatched count
      expect(validateDiagnosticQuestions(validQuestions, 3)).toContain("Nombre de questions invalide");

      // Wrong options count for QCM
      const invalidQcm = [
        { competence: "CO", choix: ["A", "B", "C"], consigne: "Q1", bonne_reponse: "A", explication: "X", niveau: "A1", difficulte: 2 },
      ];
      expect(validateDiagnosticQuestions(invalidQcm, 1)).toContain("QCM invalide");
    });
  });

  describe("generate-exercises - focus_pedagogique prompt", () => {
    it("returns correct focus prompt for grammaire", () => {
      const prompt = buildFocusPrompt("Structures", "grammaire");
      expect(prompt).toContain("GRAMMAIRE");
      expect(prompt).toContain("conjugaison, les accords");
    });

    it("returns correct focus prompt for vocabulaire", () => {
      const prompt = buildFocusPrompt("Structures", "vocabulaire");
      expect(prompt).toContain("VOCABULAIRE");
      expect(prompt).toContain("lexique utile, les definitions");
    });

    it("returns empty prompt for other competencies or null focus", () => {
      expect(buildFocusPrompt("CO", "grammaire")).toBe("");
      expect(buildFocusPrompt("Structures", null)).toBe("");
    });

    it("constrains and injects the target duration", () => {
      expect(parseTargetDurationMinutes(null)).toBe(12);
      expect(parseTargetDurationMinutes(0)).toBe(1);
      expect(parseTargetDurationMinutes(90)).toBe(60);
      expect(buildDurationPrompt(7)).toContain("420");
    });
  });

  describe("targeted exercise wizard settings", () => {
    it("supports one to thirty exercises", () => {
      expect(clampExerciseCount(0)).toBe(1);
      expect(clampExerciseCount(31)).toBe(30);
    });

    it("splits large generations into stable batches", () => {
      expect(buildGenerationBatchSizes(1)).toEqual([1]);
      expect(buildGenerationBatchSizes(12)).toEqual([5, 5, 2]);
      expect(buildGenerationBatchSizes(30)).toEqual([5, 5, 5, 5, 5, 5]);
    });
  });
});
