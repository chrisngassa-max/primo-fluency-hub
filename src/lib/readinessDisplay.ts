/** Affichage IPE formateur — types et helpers (algo_version 1) */

export type ReadinessBande = "fragile" | "construction" | "proche_seuil" | "pret";
export type ReadinessConfiance = "haute" | "moyenne" | "insuffisante";
export type ReadinessCompetence = "CO" | "CE" | "EE" | "EO" | "ST" | "GLOBAL";
export type ReadinessObjectif = "A2" | "B1";

export interface ReadinessSnapshot {
  id: string;
  eleve_id: string;
  competence: ReadinessCompetence;
  score: number;
  bande: ReadinessBande;
  confiance: ReadinessConfiance;
  composantes: Record<string, unknown>;
  algo_version: number;
  window_start: string;
  window_end: string;
  created_at: string;
}

export interface ReadinessBandConfig {
  min: number;
  max: number;
  message_formateur: string;
  recommandation: string;
}

export interface ReadinessConfigJson {
  algo_version: number;
  disclaimer_fr: string;
  objectifs: Record<
    ReadinessObjectif,
    { libelle: string; niveau_requis_scale: number }
  >;
  bands: Record<ReadinessBande, ReadinessBandConfig>;
  confidence_rules: {
    message_insuffisant: string;
    staleness_days: number;
  };
  affichage: {
    mention_obligatoire: string;
  };
}

export const EPREUVES: ReadinessCompetence[] = ["CO", "CE", "EE", "EO"];

export const COMPETENCE_LABELS: Record<ReadinessCompetence, string> = {
  CO: "Compréhension orale",
  CE: "Compréhension écrite",
  EE: "Expression écrite",
  EO: "Expression orale",
  ST: "Structures (socle)",
  GLOBAL: "IPE global",
};

export const BANDE_LABELS: Record<ReadinessBande, string> = {
  fragile: "Fragile",
  construction: "En construction",
  proche_seuil: "Proche du seuil",
  pret: "Prêt",
};

export const BANDE_COLORS: Record<
  ReadinessBande,
  { bg: string; text: string; bar: string; border: string }
> = {
  fragile: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    bar: "bg-red-500",
    border: "border-red-200 dark:border-red-900",
  },
  construction: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-900",
  },
  proche_seuil: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-400",
    bar: "bg-sky-500",
    border: "border-sky-200 dark:border-sky-900",
  },
  pret: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    bar: "bg-emerald-500",
    border: "border-emerald-200 dark:border-emerald-900",
  },
};

export const STALE_SNAPSHOT_DAYS = 7;

export function latestSnapshotsByCompetence(
  rows: ReadinessSnapshot[],
): Map<ReadinessCompetence, ReadinessSnapshot> {
  const map = new Map<ReadinessCompetence, ReadinessSnapshot>();
  for (const row of rows) {
    if (!map.has(row.competence)) {
      map.set(row.competence, row);
    }
  }
  return map;
}

export function isSnapshotStale(latest: ReadinessSnapshot | undefined): boolean {
  if (!latest) return true;
  const days =
    (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24);
  return days > STALE_SNAPSHOT_DAYS;
}

export function resolveObjectifFromParcours(input: {
  niveauCible?: string | null;
  typeDemarche?: string | null;
}): ReadinessObjectif {
  const cible = (input.niveauCible ?? "").toUpperCase();
  if (cible.includes("B1") || cible.includes("B2")) return "B1";
  if (input.typeDemarche === "naturalisation") return "B1";
  return "A2";
}

export function scoreTrend(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

/** Regroupe l'historique par semaine (lundi) — dernier snapshot de la semaine */
export function bucketSnapshotsWeekly(
  rows: ReadinessSnapshot[],
  competences: ReadinessCompetence[],
): Array<{ week: string; label: string } & Partial<Record<ReadinessCompetence, number>>> {
  const byWeek = new Map<string, Map<ReadinessCompetence, ReadinessSnapshot>>();

  for (const row of rows) {
    if (!competences.includes(row.competence)) continue;
    const d = new Date(row.created_at);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    if (!byWeek.has(key)) byWeek.set(key, new Map());
    const compMap = byWeek.get(key)!;
    const existing = compMap.get(row.competence);
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      compMap.set(row.competence, row);
    }
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, compMap]) => {
      const point: { week: string; label: string } & Partial<
        Record<ReadinessCompetence, number>
      > = {
        week,
        label: new Date(week).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        }),
      };
      for (const c of competences) {
        const snap = compMap.get(c);
        if (snap) point[c] = Number(snap.score);
      }
      return point;
    });
}

export interface DevoirsPeriodCounts {
  aFaire: number;
  enCours: number;
  termines: number;
  retard: number;
}

export function categorizeDevoirs(
  devoirs: Array<{
    statut: string;
    date_echeance: string;
    nb_reussites_consecutives: number;
    created_at: string;
  }>,
  periodStart: Date,
): DevoirsPeriodCounts {
  const now = new Date();
  const counts: DevoirsPeriodCounts = {
    aFaire: 0,
    enCours: 0,
    termines: 0,
    retard: 0,
  };

  for (const d of devoirs) {
    const created = new Date(d.created_at);
    if (created < periodStart) continue;

    const overdue =
      d.statut === "expire" ||
      (d.statut === "en_attente" && new Date(d.date_echeance) < now);

    if (d.statut === "fait") {
      counts.termines += 1;
    } else if (overdue) {
      counts.retard += 1;
    } else if (d.statut === "en_attente" && d.nb_reussites_consecutives > 0) {
      counts.enCours += 1;
    } else if (d.statut === "en_attente") {
      counts.aFaire += 1;
    }
  }

  return counts;
}

export interface WeightedError {
  typeId: string;
  label: string;
  weight: number;
  occurrences: number;
  gravite: number;
}

export function topWeightedErrors(
  events: Array<{ type_erreur_id: string | null; event_type: string }>,
  typesMap: Map<string, { label: string; gravite: number }>,
  limit = 3,
): WeightedError[] {
  const counts = new Map<string, number>();
  for (const ev of events) {
    if (
      !ev.type_erreur_id ||
      !["reponse_incorrecte", "erreur_repetee"].includes(ev.event_type)
    ) {
      continue;
    }
    counts.set(ev.type_erreur_id, (counts.get(ev.type_erreur_id) ?? 0) + 1);
  }

  const weighted: WeightedError[] = [];
  for (const [typeId, occurrences] of counts) {
    const meta = typesMap.get(typeId);
    const gravite = meta?.gravite ?? 3;
    weighted.push({
      typeId,
      label: meta?.label ?? typeId,
      weight: occurrences * (gravite / 5),
      occurrences,
      gravite,
    });
  }

  return weighted.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
