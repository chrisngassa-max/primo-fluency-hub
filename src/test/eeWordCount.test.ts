import { describe, expect, it } from "vitest";
import {
  countFrenchWords,
  eeWordCountStatus,
  resolveEeMinWords,
} from "@/lib/eeWordCount";

describe("eeWordCount", () => {
  it("counts French words", () => {
    expect(countFrenchWords("Bonjour   le monde")).toBe(3);
    expect(countFrenchWords("")).toBe(0);
  });

  it("resolves minimum from EE code", () => {
    expect(resolveEeMinWords({ metadataCode: "EE2", consigne: "Écrivez." })).toBe(60);
    expect(resolveEeMinWords({ metadataCode: "EE1", consigne: "Écrivez." })).toBe(20);
  });

  it("parses range in consigne", () => {
    expect(resolveEeMinWords({ consigne: "Rédigez 60-80 mots sur votre quartier." })).toBe(60);
  });

  it("blocks when below minimum", () => {
    const status = eeWordCountStatus("mot mot", 20);
    expect(status.ok).toBe(false);
    expect(status.message).toContain("trop courte");
  });

  it("allows when at minimum", () => {
    const text = Array.from({ length: 20 }, (_, i) => `mot${i}`).join(" ");
    const status = eeWordCountStatus(text, 20);
    expect(status.ok).toBe(true);
  });
});
