import { describe, expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { criticalTokenRecall, editDistance, errorRate, evaluateCandidate, normalizeTranscript, wordTokens } from "./lib/metrics.mjs";
import { assertUsableAudioFile, validateCanonicalResult } from "./lib/validation.mjs";

const fixtureDirectory = new URL("./fixtures/", import.meta.url);
const loadFixture = async (name) => JSON.parse(await readFile(new URL(name, fixtureDirectory), "utf8"));

describe("STT benchmark metrics", () => {
  it("normalizes French punctuation and apostrophes", () => {
    expect(normalizeTranscript("L\u2019information, c\u2019est 17 h !")).toBe("l information c est 17 h");
  });
  it("computes edit distance and word error rate", () => {
    expect(editDistance(["a", "b"], ["a", "c"])).toBe(1);
    expect(errorRate("bonjour monde", "bonjour", wordTokens)).toBe(0.5);
  });
  it("measures pedagogically critical token recall", () => {
    expect(criticalTokenRecall(["Lyon", "dix-sept"], "Train pour Lyon a dix-sept heures")).toBe(1);
    expect(criticalTokenRecall(["Lyon", "dix-sept"], "Train pour Lyon demain")).toBe(0.5);
  });
  it("accepts a strong candidate and rejects a lossy one", async () => {
    const reference = await loadFixture("reference.json");
    const good = await loadFixture("candidate-good.json");
    const bad = await loadFixture("candidate-bad.json");
    const thresholds = { max_wer: 0.12, min_critical_token_recall: 1, min_timestamp_coverage: 0.9, require_speaker_labels: false, min_speaker_label_ratio: 0.8 };
    expect(evaluateCandidate(reference, good, thresholds).eligible).toBe(true);
    const badEvaluation = evaluateCandidate(reference, bad, thresholds);
    expect(badEvaluation.eligible).toBe(false);
    expect(badEvaluation.gates.critical_token_recall).toBe(false);
    expect(badEvaluation.gates.timestamp_validity).toBe(false);
  });
});

describe("STT benchmark input safety", () => {
  it("validates the canonical provider result envelope", async () => {
    const good = await loadFixture("candidate-good.json");
    expect(validateCanonicalResult(good)).toEqual([]);
    expect(validateCanonicalResult({ ...good, provider: undefined })).not.toEqual([]);
  });
  it("rejects the repository fake MP3 marker", async () => {
    const filePath = join(tmpdir(), `captcf-fake-${process.pid}.mp3`);
    await writeFile(filePath, "FAKE-MP3::not-real-audio");
    await expect(assertUsableAudioFile(filePath)).rejects.toThrow("Corpus audio factice refuse");
  });
});
