import { describe, expect, it } from "vitest";
import {
  buildDraft,
  buildPublicationPlan,
  publishS01Interactive,
} from "./publish-s01-interactive.mjs";

function makeEntry(metadataCode, needsContentReview = false) {
  return {
    metadata_code: metadataCode,
    titre: metadataCode,
    consigne: "Choisissez la réponse.",
    competence: "CE",
    format: "qcm",
    niveau_vise: "A2",
    difficulte: 2,
    duree_limite_secondes: 60,
    source: "fixture",
    civic_content: false,
    contenu: {
      items: [{
        question: "Quelle réponse est correcte ?",
        options: ["Oui", "Non"],
        bonne_reponse: "Oui",
        correction: { preuve_support: "Le support indique Oui." },
      }],
      metadata: {
        transformation_id: "IDENTITY",
        applied_transformations: [],
        trainer_preview_required: true,
        needs_content_review: needsContentReview,
      },
    },
  };
}

function fixturePayload() {
  return {
    schema_version: "1.1",
    session_code: "S01",
    exercises: [
      makeEntry("fixture:valid:A2"),
      makeEntry("fixture:blocked:A2", true),
    ],
    playlists: { A2: [] },
  };
}

describe("pont S01 — garde de publication LOT 3", () => {
  it("le dry-run distingue les brouillons à ingérer des liens apprenant", async () => {
    const payload = fixturePayload();
    const report = await publishS01Interactive({ dryRun: true, payload, baseline: null });
    expect(report.aborted).toBe(false);
    expect(report.would_upsert_drafts).toHaveLength(2);
    expect(report.would_link).toEqual(["fixture:valid:A2"]);
    expect(report.blocked_variants.map((item) => item.metadata_code)).toEqual(["fixture:blocked:A2"]);
  });

  it("un exercice bloqué reste un brouillon consultable avec son rapport structuré", () => {
    const payload = fixturePayload();
    const plan = buildPublicationPlan(payload, null);
    const blocked = payload.exercises[1];
    const draft = buildDraft(blocked, plan.differentiation_validation);
    expect(draft.statut).toBe("draft");
    expect(draft.is_live_ready).toBe(false);
    expect(draft.needs_content_review).toBe(true);
    expect(draft.contenu.metadata.publishable).toBe(false);
    expect(draft.contenu.metadata.validation_report.blocking_errors.length).toBeGreaterThan(0);
  });

  it("une variante conforme reste en draft à l'ingestion mais est éligible au lien", () => {
    const payload = fixturePayload();
    const plan = buildPublicationPlan(payload, null);
    const linkable = plan.linkable[0];
    const draft = buildDraft(linkable.entry, plan.differentiation_validation);
    expect(plan.blocked_variants.some((item) => item.metadata_code === linkable.entry.metadata_code)).toBe(false);
    expect(draft.statut).toBe("draft");
    expect(draft.is_live_ready).toBe(false);
    expect(draft.contenu.metadata.publishable).toBe(true);
    expect(draft.needs_content_review).toBe(false);
  });
});