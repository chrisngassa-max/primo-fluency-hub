import { describe, expect, it } from "vitest";
import corpus from "@/data/captcf-accueil-conversations-reference.json";

describe("corpus d'accueil — référence qualitative", () => {
  it("compte des conversations fictives, sans rôle de contrôle de sécurité", () => {
    expect(corpus.usage).toBe("qualitative_reference_not_security");
    expect(corpus.conversations.length).toBeGreaterThanOrEqual(30);
    expect(corpus.conversations.length).toBeLessThanOrEqual(36);
    for (const item of corpus.conversations) {
      expect(item.id).toBeTruthy();
      expect(["entrainement", "devoir", "evaluation"]).toContain(item.mode);
      expect(item.turns.length).toBeGreaterThanOrEqual(2);
    }
  });
});
