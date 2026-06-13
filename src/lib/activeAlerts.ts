export interface ActiveAlert {
  id: string;
  eleve_id: string | null;
  created_at: string;
}

export function dedupeAlertsByLearner<T extends ActiveAlert>(alerts: T[]): T[] {
  const seenLearners = new Set<string>();
  return alerts.filter((alert) => {
    const key = alert.eleve_id ?? `alert:${alert.id}`;
    if (seenLearners.has(key)) return false;
    seenLearners.add(key);
    return true;
  });
}

export function countLearnersWithAlerts(alerts: Pick<ActiveAlert, "id" | "eleve_id">[]): number {
  return new Set(alerts.map((alert) => alert.eleve_id ?? `alert:${alert.id}`)).size;
}
