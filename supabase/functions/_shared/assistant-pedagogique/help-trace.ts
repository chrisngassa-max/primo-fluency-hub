import type { ActivityMode } from "../assistant-accueil/contract-v1.ts";

export const HINT_TRACE_SCHEMA = "lot3_v1";
export const PRESENTED_HINT_KIND = "indice_presente";

export type HelpOrigin = "banque" | "generation_directe";
export type AutonomyStatus = "autonome" | "aidee" | "non_mesurable";

export type HintTrace = {
  schema: typeof HINT_TRACE_SCHEMA;
  logged: true;
  presented: boolean;
  origin?: HelpOrigin | null;
};

export type PresentedHintPayload = {
  kind: typeof PRESENTED_HINT_KIND;
  exercice_id: string;
  item_id: string;
  tentative_id: string | null;
  sous_competence: string | null;
  mode: ActivityMode;
  niveau: string;
  aide_type: "indice";
  origine: HelpOrigin;
  contenu_version: string;
  niveau_aide: number;
  presented_at: string;
};

export type HelpLiveEvent = {
  event_type: "aide_demandee";
  session_id: string;
  eleve_id: string;
  payload: PresentedHintPayload;
};

export type RecordPresentedHintInput = {
  authUserId: string;
  eleveId: string;
  exerciseId: string;
  attemptId: string | null;
  itemId: string;
  sessionId: string | null;
  sousCompetence: string | null;
  mode: ActivityMode;
  niveau: string;
  niveauAide: number;
  origine: HelpOrigin;
  contenuVersion: string;
  presentedAt: string;
};

export type RecordPresentedHintResult =
  | { ok: true; event: HelpLiveEvent }
  | { ok: false; reason: "evaluation" | "acces_refuse" | "niveau_invalide" | "session_requise" | "identifiants_invalides"; event?: undefined };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function recordPresentedHint(input: RecordPresentedHintInput): RecordPresentedHintResult {
  if (input.authUserId !== input.eleveId || !isUuid(input.authUserId) || !isUuid(input.eleveId)) {
    return { ok: false, reason: "acces_refuse" };
  }
  if (input.mode === "evaluation") {
    return { ok: false, reason: "evaluation" };
  }
  if (!Number.isInteger(input.niveauAide) || input.niveauAide < 1) {
    return { ok: false, reason: "niveau_invalide" };
  }
  if (!isUuid(input.sessionId)) {
    return { ok: false, reason: "session_requise" };
  }
  if (!isUuid(input.exerciseId) || !input.itemId.trim()) {
    return { ok: false, reason: "identifiants_invalides" };
  }
  const tentativeId = isUuid(input.attemptId) ? input.attemptId : null;
  return {
    ok: true,
    event: {
      event_type: "aide_demandee",
      session_id: input.sessionId,
      eleve_id: input.eleveId,
      payload: {
        kind: PRESENTED_HINT_KIND,
        exercice_id: input.exerciseId,
        item_id: input.itemId.trim(),
        tentative_id: tentativeId,
        sous_competence: input.sousCompetence?.trim() || null,
        mode: input.mode,
        niveau: input.niveau,
        aide_type: "indice",
        origine: input.origine,
        contenu_version: input.contenuVersion,
        niveau_aide: input.niveauAide,
        presented_at: input.presentedAt,
      },
    },
  };
}

export function filterHelpEventsForLearner(events: HelpLiveEvent[], authUserId: string): HelpLiveEvent[] {
  if (!isUuid(authUserId)) return [];
  return events.filter((event) => event.eleve_id === authUserId);
}

function isCompleteHintTrace(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const trace = value as Record<string, unknown>;
  return trace.schema === HINT_TRACE_SCHEMA && trace.logged === true && typeof trace.presented === "boolean";
}

export function buildHintTrace(presented: boolean, origin: HelpOrigin | null = null): HintTrace {
  return {
    schema: HINT_TRACE_SCHEMA,
    logged: true,
    presented,
    origin: presented ? origin : null,
  };
}

/**
 * Construit hint_trace côté serveur uniquement.
 * Ignore toute hint_trace fournie par le client (logged/presented forgés).
 * Si un événement d’aide présentée existe pour l’item, presented=true même si hint_used client=false.
 */
export function resolveTrustedHintTrace(input: {
  learnerId: string;
  exerciseId: string;
  itemId: string;
  clientHintUsed: boolean;
  clientHintTrace?: unknown;
  presentedEvents: HelpLiveEvent[];
}): HintTrace {
  void input.clientHintTrace; // jamais lu — défense explicite contre forge client
  const own = filterHelpEventsForLearner(input.presentedEvents, input.learnerId).filter(
    (event) =>
      event.payload.kind === PRESENTED_HINT_KIND
      && event.payload.exercice_id === input.exerciseId
      && event.payload.item_id === input.itemId,
  );
  const fromEvents = own.length > 0;
  const presented = fromEvents || input.clientHintUsed === true;
  const origin = fromEvents ? own[0].payload.origine : null;
  return buildHintTrace(presented, origin);
}

/** Même présentation = même élève/session/exercice/item/niveau/tentative (hors presented_at). */
export function isDuplicatePresentedHint(
  existing: HelpLiveEvent[],
  candidate: HelpLiveEvent,
): boolean {
  if (candidate.event_type !== "aide_demandee" || candidate.payload.kind !== PRESENTED_HINT_KIND) {
    return false;
  }
  return existing.some((event) =>
    event.event_type === "aide_demandee"
    && event.eleve_id === candidate.eleve_id
    && event.session_id === candidate.session_id
    && event.payload.kind === PRESENTED_HINT_KIND
    && event.payload.exercice_id === candidate.payload.exercice_id
    && event.payload.item_id === candidate.payload.item_id
    && event.payload.niveau_aide === candidate.payload.niveau_aide
    && event.payload.tentative_id === candidate.payload.tentative_id
    && event.payload.origine === candidate.payload.origine
  );
}

export function classifyAttemptAutonomy(input: {
  learnerId: string;
  attemptId: string;
  itemResults: Record<string, unknown> | unknown[] | null | undefined;
  helpEvents: HelpLiveEvent[];
  /**
   * Lot 5 : parcours « Voir un indice » client sans événement live possible.
   * Dans ce cas une absence d’aide journalisée ne prouve pas l’autonomie.
   */
  unloggedClientHintPossible?: boolean;
}): { status: AutonomyStatus } {
  const items = Array.isArray(input.itemResults)
    ? input.itemResults
    : input.itemResults && typeof input.itemResults === "object"
    ? Object.values(input.itemResults)
    : [];
  if (!items.length) return { status: "non_mesurable" };

  let complete = true;
  let presented = false;
  for (const item of items) {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const trace = row.hint_trace;
    if (!isCompleteHintTrace(trace)) {
      complete = false;
      break;
    }
    const typed = trace as HintTrace;
    if (typed.presented === true || row.hint_used === true) presented = true;
  }
  if (!complete) return { status: "non_mesurable" };

  const ownEvents = filterHelpEventsForLearner(input.helpEvents, input.learnerId)
    .filter((event) => event.payload.kind === PRESENTED_HINT_KIND
      && (event.payload.tentative_id === input.attemptId || event.payload.tentative_id === null));
  if (ownEvents.length > 0) presented = true;

  if (presented) return { status: "aidee" };
  // hint_used=false historique / chemin client non journalisé : jamais autonome.
  if (input.unloggedClientHintPossible === true) return { status: "non_mesurable" };
  return { status: "autonome" };
}
