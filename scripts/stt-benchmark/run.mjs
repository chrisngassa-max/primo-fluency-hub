#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCandidate } from "./lib/metrics.mjs";
import { assertUsableAudioFile, validateCanonicalResult } from "./lib/validation.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const manifestArgument = process.argv[2];
if (!manifestArgument) throw new Error("Usage: node scripts/stt-benchmark/run.mjs <manifest.json> [report.json]");
const manifestPath = resolve(process.cwd(), manifestArgument);
const manifestDirectory = dirname(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await assertUsableAudioFile(resolve(manifestDirectory, manifest.audio_path));
const reference = JSON.parse(await readFile(resolve(manifestDirectory, manifest.reference_path), "utf8"));
const candidates = await Promise.all(manifest.candidate_paths.map(async (candidatePath) => JSON.parse(await readFile(resolve(manifestDirectory, candidatePath), "utf8"))));
for (const candidate of candidates) {
  const errors = validateCanonicalResult(candidate);
  if (errors.length) throw new Error(`${candidate.provider ?? "candidate"} invalide: ${errors.join(", ")}`);
  if (candidate.audio_id !== reference.audio_id) throw new Error(`audio_id divergent: ${candidate.audio_id} != ${reference.audio_id}`);
}
const evaluations = candidates.map((candidate) => evaluateCandidate(reference, candidate, manifest.thresholds));
const report = {
  schema_version: "1.0",
  generated_at: new Date().toISOString(),
  corpus_id: manifest.corpus_id,
  audio_id: reference.audio_id,
  thresholds: manifest.thresholds,
  evaluations,
  eligible_providers: evaluations.filter((evaluation) => evaluation.eligible).map(({ provider, model }) => ({ provider, model })),
  decision_ready: evaluations.length >= 2 && evaluations.some((evaluation) => evaluation.eligible),
};
const reportText = `${JSON.stringify(report, null, 2)}\n`;
const outputPath = process.argv[3] ? resolve(process.cwd(), process.argv[3]) : resolve(scriptDirectory, "benchmark-report.json");
await writeFile(outputPath, reportText, "utf8");
process.stdout.write(reportText);
