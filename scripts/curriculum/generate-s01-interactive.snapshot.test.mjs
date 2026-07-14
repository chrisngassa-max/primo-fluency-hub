// Lot 0 — garde-fou de non-régression du corpus S01-v3.
//
// Compare le payload régénéré par buildInteractiveS01() à l'enveloppe figée
// dans __snapshots__/s01-v3-corpus-baseline.json (nombre d'exercices, ordre,
// identifiants fonctionnels, nombre d'items, durée). Le texte des items peut
// évoluer au Lot 2 ; cette enveloppe ne doit jamais bouger sans décision
// explicite de régénération du snapshot lui-même.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildInteractiveS01 } from "./generate-s01-interactive.mjs";
import { diffAgainstBaseline } from "./lib/s01-snapshot-diff.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE_PATH = join(
  ROOT,
  "content",
  "curriculum",
  "v2",
  "S01-v3",
  "__snapshots__",
  "s01-v3-corpus-baseline.json",
);

async function loadBaseline() {
  return JSON.parse(await readFile(BASELINE_PATH, "utf8"));
}

describe("S01-v3 — non-régression de l'enveloppe du corpus (Lot 0)", () => {
  it("ne fait disparaître, apparaître ni déplacer aucun exercice, et conserve niveau/compétence/format/famille/activité/items/durée", async () => {
    const baseline = await loadBaseline();
    const payload = await buildInteractiveS01();
    expect(diffAgainstBaseline(baseline, payload)).toEqual([]);
  });

  it("respecte les totaux par niveau, compétence, format et activité déclarés dans le snapshot", async () => {
    const baseline = await loadBaseline();
    const payload = await buildInteractiveS01();

    const byLevel = {};
    const byCompetence = {};
    const byFormat = {};
    const byActivity = {};
    for (const entry of payload.exercises) {
      byLevel[entry.niveau_vise] = (byLevel[entry.niveau_vise] ?? 0) + 1;
      byCompetence[entry.competence] = (byCompetence[entry.competence] ?? 0) + 1;
      byFormat[entry.format] = (byFormat[entry.format] ?? 0) + 1;
      const activityCode = entry.contenu?.metadata?.activity_code ?? null;
      if (activityCode) byActivity[activityCode] = (byActivity[activityCode] ?? 0) + 1;
    }

    expect(byLevel).toEqual(baseline.totals.by_level);
    expect(byCompetence).toEqual(baseline.totals.by_competence);
    expect(byFormat).toEqual(baseline.totals.by_format);
    expect(byActivity).toEqual(baseline.totals.by_activity_code);
    expect(Object.fromEntries(Object.entries(payload.playlists).map(([lvl, list]) => [lvl, list.length])))
      .toEqual(baseline.playlist_lengths);
  });

  it("preuve : le comparateur détecte réellement une régression injectée dans une fixture mutée, sans jamais modifier le snapshot ou le corpus réels", async () => {
    const baseline = await loadBaseline();
    const payload = await buildInteractiveS01();
    const [firstCode] = baseline.order;

    // Le comparateur, sur les données réelles non modifiées, ne remonte rien.
    expect(diffAgainstBaseline(baseline, payload)).toEqual([]);

    // Fixture A — copie du baseline avec un nombre d'items falsifié : doit
    // être détecté comme violation `item_count`.
    const mutatedItemCount = structuredClone(baseline);
    mutatedItemCount.exercises[firstCode].item_count += 1;
    const violationsItemCount = diffAgainstBaseline(mutatedItemCount, payload);
    expect(violationsItemCount.some((v) => v.startsWith(`${firstCode}: item_count`))).toBe(true);

    // Fixture B — copie du baseline avec une position décalée : doit être
    // détectée comme violation `position`.
    const mutatedPosition = structuredClone(baseline);
    mutatedPosition.exercises[firstCode].position += 1;
    const violationsPosition = diffAgainstBaseline(mutatedPosition, payload);
    expect(violationsPosition.some((v) => v.startsWith(`${firstCode}: position`))).toBe(true);

    // Fixture C — copie du baseline avec une durée modifiée : doit être
    // détectée comme violation `duree_limite_secondes`.
    const mutatedDuration = structuredClone(baseline);
    mutatedDuration.exercises[firstCode].duree_limite_secondes += 60;
    const violationsDuration = diffAgainstBaseline(mutatedDuration, payload);
    expect(violationsDuration.some((v) => v.startsWith(`${firstCode}: duree_limite_secondes`))).toBe(true);

    // Fixture D — copie du PAYLOAD (jamais du générateur réel) avec un
    // exercice retiré : doit être détectée comme `disparu`.
    const mutatedPayload = structuredClone(payload);
    mutatedPayload.exercises = mutatedPayload.exercises.filter((e) => e.metadata_code !== firstCode);
    const violationsDisparu = diffAgainstBaseline(baseline, mutatedPayload);
    expect(violationsDisparu).toContain(`disparu: ${firstCode}`);

    // Fixture E — copie du PAYLOAD avec un exercice fantôme ajouté : doit
    // être détectée comme `apparu`.
    const mutatedPayloadExtra = structuredClone(payload);
    mutatedPayloadExtra.exercises.push({
      ...mutatedPayloadExtra.exercises[0],
      metadata_code: "cv2:S01:v3:fixture-fantome:A1",
    });
    const violationsApparu = diffAgainstBaseline(baseline, mutatedPayloadExtra);
    expect(violationsApparu).toContain("apparu: cv2:S01:v3:fixture-fantome:A1");
  });
});
