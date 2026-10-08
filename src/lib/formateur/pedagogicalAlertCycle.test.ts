import { describe, expect, it } from "vitest";
import {
  evaluateRepeatedDifficultyAlert,
  REPEATED_DIFFICULTY_RULE,
  transitionPedagogicalAlert,
} from "./pedagogicalAlertCycle";

describe("Lot 5 — cycle signalements et seuils", () => {
  it("seuil : 3 échecs / 7 jours déclenche une alerte", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const hit = evaluateRepeatedDifficultyAlert({
      eleveId: "e1",
      sousCompetence: "reperer_info_explicite",
      failuresInWindow: 3,
      maxHelpUsesInWindow: 0,
      at: "2026-10-06T12:00:00.000Z",
    }, now);
    expect(hit.triggered).toBe(true);
    expect(hit.ruleId).toBe(REPEATED_DIFFICULTY_RULE.id);
    expect(hit.reason).toMatch(/3 échecs/);
  });

  it("seuil : 2 recours à l’aide niveau max / 7 jours déclenche", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const hit = evaluateRepeatedDifficultyAlert({
      eleveId: "e1",
      sousCompetence: "reperer_info_explicite",
      failuresInWindow: 1,
      maxHelpUsesInWindow: 2,
      at: "2026-10-05T12:00:00.000Z",
    }, now);
    expect(hit.triggered).toBe(true);
    expect(hit.reason).toMatch(/niveau 3/);
  });

  it("sous le seuil ou hors fenêtre : pas d’alerte", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    expect(evaluateRepeatedDifficultyAlert({
      eleveId: "e1",
      sousCompetence: "x",
      failuresInWindow: 2,
      maxHelpUsesInWindow: 1,
      at: "2026-10-06T12:00:00.000Z",
    }, now).triggered).toBe(false);
    expect(evaluateRepeatedDifficultyAlert({
      eleveId: "e1",
      sousCompetence: "x",
      failuresInWindow: 5,
      maxHelpUsesInWindow: 5,
      at: "2026-09-20T12:00:00.000Z",
    }, now).triggered).toBe(false);
  });

  it("transitions nouveau → confirmé → classé avec motif", () => {
    const c = transitionPedagogicalAlert({ from: "nouveau", to: "confirme" });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.status).toBe("confirme");

    const denied = transitionPedagogicalAlert({ from: "confirme", to: "classe" });
    expect(denied.ok).toBe(false);

    const done = transitionPedagogicalAlert({
      from: "confirme",
      to: "classe",
      motifClassement: "Remédiation planifiée en séance",
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.status).toBe("classe");
    expect(done.motifClassement).toBe("Remédiation planifiée en séance");
  });

  it("Lot 5B : saut nouveau → classe et inverse refusés", () => {
    expect(transitionPedagogicalAlert({
      from: "nouveau",
      to: "classe",
      motifClassement: "saut interdit",
    }).ok).toBe(false);
    expect(transitionPedagogicalAlert({ from: "confirme", to: "nouveau" }).ok).toBe(false);
    expect(transitionPedagogicalAlert({ from: "classe", to: "confirme" }).ok).toBe(false);
  });
});
