import { describe, expect, it } from "vitest";
import {
  buildVariantHints,
  filterPublishedResources,
  matchDeroulePhase,
  normalizePhaseKey,
  pickLatestPublishedResources,
  pickResourceByKind,
  resolvePublishedResourceIds,
} from "./curriculum-adapt-lib.ts";

describe("curriculum-adapt-lib", () => {
  const rows = [
    { id: "u1", session_id: "s1", resource_id: "adaptation-rules-json", kind: "adaptation_rules_json", version: 1, chemin: "S01/a.json", statut: "draft" },
    { id: "u2", session_id: "s1", resource_id: "adaptation-rules-json", kind: "adaptation_rules_json", version: 2, chemin: "S01/b.json", statut: "published" },
    { id: "u3", session_id: "s1", resource_id: "deroule-180min-json", kind: "deroule_json", version: 1, chemin: "S01/c.json", statut: "published" },
    { id: "u4", session_id: "s1", resource_id: "deroule-180min-json", kind: "deroule_json", version: 2, chemin: "S01/d.json", statut: "published" },
  ];

  it("filterPublishedResources exclut brouillons et quarantaine", () => {
    expect(filterPublishedResources(rows)).toHaveLength(3);
    expect(filterPublishedResources(rows).every((r) => r.statut === "published")).toBe(true);
  });

  it("pickLatestPublishedResources garde la version max par resource_id", () => {
    const latest = pickLatestPublishedResources(rows);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.resource_id === "adaptation-rules-json")?.version).toBe(2);
    expect(latest.find((r) => r.resource_id === "deroule-180min-json")?.version).toBe(2);
  });

  it("resolvePublishedResourceIds mappe kind et uuid vers resource_id publie", () => {
    const latest = pickLatestPublishedResources(rows);
    const resolved = resolvePublishedResourceIds(
      ["adaptation_rules_json", "u4", "inconnu"],
      latest,
    );
    expect(resolved).toEqual(["adaptation-rules-json", "deroule-180min-json"]);
  });

  it("pickResourceByKind retourne la ressource publiee la plus recente", () => {
    const resource = pickResourceByKind(rows, "deroule_json");
    expect(resource?.version).toBe(2);
    expect(resource?.chemin).toBe("S01/d.json");
  });

  it("normalizePhaseKey et matchDeroulePhase", () => {
    const deroule = [
      { phase: "Ateliers differencies", duree_min: 60, description: "Groupes A1-B2" },
    ];
    expect(normalizePhaseKey("Ateliers differencies")).toBe("ateliers_differencies");
    expect(matchDeroulePhase(deroule, "ateliers_differencies")?.duree_min).toBe(60);
  });

  it("buildVariantHints priorise les variantes DB publiees", () => {
    const hints = buildVariantHints(
      { A2: { consigne: "Consigne A2 depuis JSON" } },
      [{ id: "ev1", support_id: "sup", niveau: "A2", version: 1, statut: "published" }],
    );
    expect(hints.A2).toBe("variant-db:ev1");
    expect(hints.A1).toBeUndefined();
  });
});
