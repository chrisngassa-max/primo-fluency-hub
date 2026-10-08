import { describe, expect, it } from "vitest";
import {
  canFormateurReadAttempt,
  canFormateurReadLiveEvent,
  filterHelpEventsForFormateur,
} from "./trainerAccess";

const FORMATEUR = "f0000000-0000-4000-8000-000000000001";
const OTHER = "f0000000-0000-4000-8000-000000000099";
const SESSION = "20000000-0000-4000-8000-000000000001";
const OTHER_SESSION = "20000000-0000-4000-8000-000000000099";
const LEARNER = "10000000-0000-4000-8000-000000000001";
const EXERCISE = "62b06150-7942-4c41-bab9-fdba0a4d852c";

describe("Lot 5 — accès formateur (miroir RLS)", () => {
  it("événement d’aide visible uniquement par le formateur autorisé", () => {
    const event = { session_id: SESSION, eleve_id: LEARNER };
    const owned = [{ sessionId: SESSION, formateurId: FORMATEUR }];
    expect(canFormateurReadLiveEvent({ formateurId: FORMATEUR, event, sessionsOwned: owned })).toBe(true);
    expect(canFormateurReadLiveEvent({ formateurId: OTHER, event, sessionsOwned: owned })).toBe(false);
  });

  it("autre formateur / autre groupe refusé", () => {
    const event = { session_id: OTHER_SESSION, eleve_id: LEARNER };
    const owned = [{ sessionId: SESSION, formateurId: FORMATEUR }];
    expect(canFormateurReadLiveEvent({ formateurId: FORMATEUR, event, sessionsOwned: owned })).toBe(false);
    const filtered = filterHelpEventsForFormateur(
      [event, { session_id: SESSION, eleve_id: LEARNER }],
      FORMATEUR,
      owned,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].session_id).toBe(SESSION);
  });

  it("tentative : formateur de l’exercice seulement", () => {
    const attempt = { exercise_id: EXERCISE, learner_id: LEARNER };
    const owned = [{ exerciseId: EXERCISE, formateurId: FORMATEUR }];
    expect(canFormateurReadAttempt({ formateurId: FORMATEUR, attempt, exercisesOwned: owned })).toBe(true);
    expect(canFormateurReadAttempt({ formateurId: OTHER, attempt, exercisesOwned: owned })).toBe(false);
  });
});
