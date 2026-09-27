export type CurriculumSessionLink = {
  session_id: string;
  exercice_id: string;
  ordre: number;
  statut: "planifie";
  bloc: "curriculum";
  eleve_id: null;
};

export type SessionLinkError = "SOURCE_REQUIRED" | "FACTS_REQUIRED" | "SESSION_REQUIRED" | "EXERCISE_REQUIRED" | "LINK_NOT_FOUND";

export type SessionLinkResult =
  | { ok: true; links: CurriculumSessionLink[] }
  | { ok: false; error: SessionLinkError };

export type SessionLinkInput = {
  sourceId?: string | null;
  facts?: readonly unknown[] | null;
  sessionId?: string | null;
  exerciceId?: string | null;
};

function guard(input: SessionLinkInput): SessionLinkError | null {
  if (!input.sourceId?.trim()) return "SOURCE_REQUIRED";
  if (!input.facts?.length) return "FACTS_REQUIRED";
  if (!input.sessionId?.trim()) return "SESSION_REQUIRED";
  if (!input.exerciceId?.trim()) return "EXERCISE_REQUIRED";
  return null;
}

export function linkPublishedExerciseToSession(
  links: readonly CurriculumSessionLink[],
  input: SessionLinkInput,
): SessionLinkResult {
  const error = guard(input);
  if (error) return { ok: false, error };
  const sessionId = input.sessionId!.trim();
  const exerciceId = input.exerciceId!.trim();
  const existing = links.find((link) => link.session_id === sessionId && link.exercice_id === exerciceId);
  if (existing) return { ok: true, links: [...links] };
  const ordre = links.reduce((max, link) => Math.max(max, link.ordre), 0) + 1;
  return {
    ok: true,
    links: [...links, {
      session_id: sessionId,
      exercice_id: exerciceId,
      ordre,
      statut: "planifie",
      bloc: "curriculum",
      eleve_id: null,
    }],
  };
}

export function unlinkPublishedExerciseFromSession(
  links: readonly CurriculumSessionLink[],
  input: SessionLinkInput,
): SessionLinkResult {
  const error = guard(input);
  if (error) return { ok: false, error };
  const sessionId = input.sessionId!.trim();
  const exerciceId = input.exerciceId!.trim();
  const next = links.filter((link) => !(link.session_id === sessionId && link.exercice_id === exerciceId));
  if (next.length === links.length) return { ok: false, error: "LINK_NOT_FOUND" };
  return { ok: true, links: next };
}
