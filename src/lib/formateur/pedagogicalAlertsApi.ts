/**
 * Lecture et écriture de public.pedagogical_alerts via le client authentifié.
 * Les policies RLS filtrent les lignes. Aucun repli vers un calcul local.
 */

import type { PedagogicalAlertStatus } from "@/lib/formateur/pedagogicalAlertCycle";

export type AlertEvidence = {
  attempt_ids: string[];
  event_ids: string[];
  failures_count: number;
  max_help_uses: number;
  reason?: string;
};

export type PersistedPedagogicalAlert = {
  id: string;
  formateur_id: string;
  eleve_id: string;
  sous_competence: string;
  rule_id: string;
  status: PedagogicalAlertStatus;
  motif_classement: string | null;
  evidence: AlertEvidence;
  window_start: string;
  window_end: string;
};

export type PedagogicalAlertDraft = {
  eleveId: string;
  sousCompetence: string;
  ruleId: string;
  reason: string;
  windowStart: string;
  windowEnd: string;
  evidence: AlertEvidence;
};

export type AlertsAccessKind = "missing_migration" | "rls" | "network" | "rejected";

export class PedagogicalAlertsAccessError extends Error {
  readonly kind: AlertsAccessKind;

  constructor(kind: AlertsAccessKind, message: string) {
    super(message);
    this.name = "PedagogicalAlertsAccessError";
    this.kind = kind;
  }
}

type PostgrestError = { code?: string; message?: string };

export type PedagogicalAlertsClient = {
  from: (table: string) => {
    select: (columns: string) => AlertsFilter;
    update: (values: Record<string, unknown>) => AlertsFilter;
    insert: (values: Record<string, unknown>) => AlertsFilter;
  };
};

type AlertsFilter = {
  eq: (column: string, value: string) => AlertsFilter;
  order: (column: string, options: { ascending: boolean }) => AlertsFilter;
  select: (columns: string) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
  then: PromiseLike<{ data: unknown; error: PostgrestError | null }>["then"];
};

const SELECT_COLUMNS =
  "id, formateur_id, eleve_id, sous_competence, rule_id, status, motif_classement, evidence, window_start, window_end";

export function classifyAlertsError(error: PostgrestError | { message?: string }): PedagogicalAlertsAccessError {
  const code = "code" in error ? error.code ?? "" : "";
  const message = error.message ?? "Erreur inconnue";
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    /schema cache|does not exist|could not find the table/i.test(message)
  ) {
    return new PedagogicalAlertsAccessError(
      "missing_migration",
      "La table pedagogical_alerts est absente sur cette base. Le calcul local n’est pas une donnée enregistrée.",
    );
  }
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return new PedagogicalAlertsAccessError(
      "rls",
      "Accès refusé aux alertes enregistrées par les règles de sécurité.",
    );
  }
  if (/failed to fetch|networkerror|network request failed|fetch failed|load failed/i.test(message)) {
    return new PedagogicalAlertsAccessError(
      "network",
      "Impossible de joindre la base. Aucune alerte locale n’est présentée comme enregistrée.",
    );
  }
  return new PedagogicalAlertsAccessError("rejected", message);
}

function unwrap(result: { data: unknown; error: PostgrestError | null }) {
  if (result.error) throw classifyAlertsError(result.error);
  return result.data;
}

export async function listPedagogicalAlerts(
  client: PedagogicalAlertsClient,
  formateurId: string,
): Promise<PersistedPedagogicalAlert[]> {
  const result = await client
    .from("pedagogical_alerts")
    .select(SELECT_COLUMNS)
    .eq("formateur_id", formateurId)
    .order("updated_at", { ascending: false });
  const data = unwrap(result);
  return (data ?? []) as PersistedPedagogicalAlert[];
}

export async function confirmPedagogicalAlert(client: PedagogicalAlertsClient, alertId: string): Promise<void> {
  const result = await client
    .from("pedagogical_alerts")
    .update({ status: "confirme" })
    .eq("id", alertId)
    .eq("status", "nouveau")
    .select("id");
  const data = unwrap(result) as { id: string }[] | null;
  if (!data?.length) {
    throw new PedagogicalAlertsAccessError("rejected", "Aucune alerte confirmée. Le cycle ou l’accès a refusé l’opération.");
  }
}

export async function classifyPedagogicalAlert(
  client: PedagogicalAlertsClient,
  alertId: string,
  motifClassement: string,
): Promise<void> {
  const motif = motifClassement.trim();
  if (!motif) {
    throw new PedagogicalAlertsAccessError("rejected", "Un motif de classement est obligatoire.");
  }
  const result = await client
    .from("pedagogical_alerts")
    .update({ status: "classe", motif_classement: motif })
    .eq("id", alertId)
    .eq("status", "confirme")
    .select("id");
  const data = unwrap(result) as { id: string }[] | null;
  if (!data?.length) {
    throw new PedagogicalAlertsAccessError("rejected", "Aucune alerte classée. Le cycle ou l’accès a refusé l’opération.");
  }
}

export async function recordPedagogicalAlert(
  client: PedagogicalAlertsClient,
  formateurId: string,
  draft: PedagogicalAlertDraft,
): Promise<"created" | "duplicate"> {
  const result = await client.from("pedagogical_alerts").insert({
    formateur_id: formateurId,
    eleve_id: draft.eleveId,
    sous_competence: draft.sousCompetence,
    rule_id: draft.ruleId,
    status: "nouveau",
    window_start: draft.windowStart,
    window_end: draft.windowEnd,
    evidence: draft.evidence,
  });
  if (result.error?.code === "23505") return "duplicate";
  unwrap(result);
  return "created";
}
