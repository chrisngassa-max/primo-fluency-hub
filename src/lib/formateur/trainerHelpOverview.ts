/**
 * Agrégation formateur — devoirs, autonomie des tentatives, aides présentées (Lot 5).
 * Pas de score de préparation TCF élève. Pas d’appel IA.
 */
import {
  classifyAttemptAutonomy,
  HINT_TRACE_SCHEMA,
  PRESENTED_HINT_KIND,
  type AutonomyStatus,
  type HelpLiveEvent,
} from "../../../supabase/functions/_shared/assistant-pedagogique/help-trace";

export type DevoirDisplayStatus = "actif" | "termine" | "expire" | "arrete" | "archive";

const DEVOIR_STATUS_LABELS: Record<DevoirDisplayStatus, string> = {
  actif: "Actif",
  termine: "Terminé",
  expire: "Expiré",
  arrete: "Arrêté",
  archive: "Archivé",
};

/** Mappe devoirs.statut vers un libellé formateur ; expire ≠ actif. */
export function presentDevoirStatus(statut: string): {
  key: DevoirDisplayStatus;
  label: string;
  isActive: boolean;
} {
  if (statut === "en_attente") {
    return { key: "actif", label: DEVOIR_STATUS_LABELS.actif, isActive: true };
  }
  if (statut === "fait") {
    return { key: "termine", label: DEVOIR_STATUS_LABELS.termine, isActive: false };
  }
  if (statut === "expire") {
    return { key: "expire", label: DEVOIR_STATUS_LABELS.expire, isActive: false };
  }
  if (statut === "arrete") {
    return { key: "arrete", label: DEVOIR_STATUS_LABELS.arrete, isActive: false };
  }
  if (statut === "archive") {
    return { key: "archive", label: DEVOIR_STATUS_LABELS.archive, isActive: false };
  }
  return { key: "archive", label: "Inconnu", isActive: false };
}

export function exerciseAllowsUnloggedClientHint(contenu: unknown): boolean {
  if (!contenu || typeof contenu !== "object") return false;
  const items = Array.isArray((contenu as { items?: unknown }).items)
    ? (contenu as { items: unknown[] }).items
    : [];
  return items.some((item) => {
    if (!item || typeof item !== "object") return false;
    const indice = (item as { indice?: unknown }).indice;
    return typeof indice === "string" && indice.trim().length > 0;
  });
}

export type AttemptOverviewInput = {
  attemptId: string;
  learnerId: string;
  sousCompetence: string | null;
  itemResults: Record<string, unknown> | unknown[] | null | undefined;
  helpEvents: HelpLiveEvent[];
  /** True si l’exercice porte un « Voir un indice » client non journalisé en live. */
  unloggedClientHintPossible: boolean;
  completedAt?: string | null;
  failed?: boolean;
};

export type AttemptOverviewRow = {
  attemptId: string;
  learnerId: string;
  sousCompetence: string;
  autonomy: AutonomyStatus;
  hints: Array<{ niveau_aide: number; origine: string; item_id: string }>;
};

export function buildAttemptOverview(input: AttemptOverviewInput): AttemptOverviewRow {
  const autonomy = classifyAttemptAutonomy({
    learnerId: input.learnerId,
    attemptId: input.attemptId,
    itemResults: input.itemResults,
    helpEvents: input.helpEvents,
    unloggedClientHintPossible: input.unloggedClientHintPossible,
  }).status;

  const hints = input.helpEvents
    .filter(
      (e) =>
        e.eleve_id === input.learnerId
        && e.payload.kind === PRESENTED_HINT_KIND
        && (e.payload.tentative_id === input.attemptId || e.payload.tentative_id === null),
    )
    .map((e) => ({
      niveau_aide: e.payload.niveau_aide,
      origine: e.payload.origine,
      item_id: e.payload.item_id,
    }));

  return {
    attemptId: input.attemptId,
    learnerId: input.learnerId,
    sousCompetence: input.sousCompetence?.trim() || "non_renseignee",
    autonomy,
    hints,
  };
}

export function groupAttemptsByLearnerAndSkill(rows: AttemptOverviewRow[]): Map<
  string,
  { mesurables_autonomes: AttemptOverviewRow[]; aidees: AttemptOverviewRow[]; non_mesurables: AttemptOverviewRow[] }
> {
  const map = new Map<
    string,
    { mesurables_autonomes: AttemptOverviewRow[]; aidees: AttemptOverviewRow[]; non_mesurables: AttemptOverviewRow[] }
  >();
  for (const row of rows) {
    const key = `${row.learnerId}::${row.sousCompetence}`;
    const bucket = map.get(key) ?? {
      mesurables_autonomes: [],
      aidees: [],
      non_mesurables: [],
    };
    if (row.autonomy === "autonome") bucket.mesurables_autonomes.push(row);
    else if (row.autonomy === "aidee") bucket.aidees.push(row);
    else bucket.non_mesurables.push(row);
    map.set(key, bucket);
  }
  return map;
}

/** Difficultés répétées avant séance — agrège preuves pour le seuil Lot 5. */
export function collectDifficultyEvidence(input: {
  attempts: AttemptOverviewInput[];
  windowStart: Date;
  windowEnd: Date;
}): Array<{
  eleveId: string;
  sousCompetence: string;
  failuresInWindow: number;
  maxHelpUsesInWindow: number;
  at: string;
}> {
  type Acc = {
    failures: number;
    maxHelpKeys: Set<string>;
    latest: string;
  };
  const byKey = new Map<string, Acc>();

  for (const attempt of input.attempts) {
    const at = attempt.completedAt ? new Date(attempt.completedAt) : null;
    if (!at || at < input.windowStart || at > input.windowEnd) continue;
    const skill = attempt.sousCompetence?.trim() || "non_renseignee";
    const key = `${attempt.learnerId}::${skill}`;
    const acc = byKey.get(key) ?? {
      failures: 0,
      maxHelpKeys: new Set<string>(),
      latest: attempt.completedAt!,
    };
    if (attempt.failed) acc.failures += 1;
    if (attempt.completedAt && attempt.completedAt > acc.latest) acc.latest = attempt.completedAt;
    byKey.set(key, acc);
  }

  // Aides niveau max : une fois par présentation (élève+item+niveau+tentative), pas par tentative.
  for (const attempt of input.attempts) {
    for (const event of attempt.helpEvents) {
      if (event.payload.kind !== PRESENTED_HINT_KIND || event.payload.niveau_aide < 3) continue;
      if (event.eleve_id !== attempt.learnerId) continue;
      const presentedAt = new Date(event.payload.presented_at);
      if (presentedAt < input.windowStart || presentedAt > input.windowEnd) continue;
      const skill = (event.payload.sous_competence?.trim()
        || attempt.sousCompetence?.trim()
        || "non_renseignee");
      const key = `${event.eleve_id}::${skill}`;
      const acc = byKey.get(key) ?? {
        failures: 0,
        maxHelpKeys: new Set<string>(),
        latest: event.payload.presented_at,
      };
      const dedupe = [
        event.payload.exercice_id,
        event.payload.item_id,
        String(event.payload.niveau_aide),
        event.payload.tentative_id ?? "null",
      ].join("|");
      acc.maxHelpKeys.add(dedupe);
      if (event.payload.presented_at > acc.latest) acc.latest = event.payload.presented_at;
      byKey.set(key, acc);
    }
  }

  return [...byKey.entries()].map(([key, acc]) => {
    const [eleveId, sousCompetence] = key.split("::");
    return {
      eleveId,
      sousCompetence,
      failuresInWindow: acc.failures,
      maxHelpUsesInWindow: acc.maxHelpKeys.size,
      at: acc.latest,
    };
  });
}

export { HINT_TRACE_SCHEMA, PRESENTED_HINT_KIND };
