export interface SummaryMember { eleve_id: string; nom: string; prenom: string; joined_at?: string }
export interface SummarySession { id: string; date_seance: string; duree_minutes: number; statut: string }
export interface SummaryPresence { session_id: string; eleve_id: string; present: boolean; commentaire: string | null }
export interface SummaryRow extends SummaryMember { planned: number; present: number; absent: number; attended: number }
// Versioned metadata in the existing observation field; free text is preserved.
const durationTag = /\[CAPTCF:presence_minutes=([^\]]*)\]/;
export function readPresenceDuration(comment: string | null) {
  const match = (comment ?? "").match(durationTag);
  return { comment: (comment ?? "").replace(durationTag, "").trim(), minutes: match ? (/^\d+$/.test(match[1]) ? Number(match[1]) : NaN) : null };
}
export function writePresenceDuration(comment: string, minutes: number | null) {
  const text = readPresenceDuration(comment).comment;
  return [text, minutes === null ? "" : `[CAPTCF:presence_minutes=${minutes}]`].filter(Boolean).join("\n") || null;
}
export const formatHours = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
export const parisDay = (date: string | Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date(date));
export function buildAttendanceSummary(members: SummaryMember[], sessions: SummarySession[], presences: SummaryPresence[], period?: { start: string; end: string }, now = new Date()) {
  const missing: string[] = [];
  const errors: string[] = [];
  const records = new Map<string, SummaryPresence>();
  for (const p of presences) {
    const key = `${p.session_id}:${p.eleve_id}`;
    if (records.has(key)) errors.push("Plusieurs appels pour un même participant et une même séance.");
    records.set(key, p);
  }
  const selected = sessions.filter(s => s.statut !== "annulee" && (!period || (parisDay(s.date_seance) >= period.start && parisDay(s.date_seance) <= period.end)));
  const rows: SummaryRow[] = [...new Map(members.map(m => [m.eleve_id, m])).values()].map(m => {
    const row = { ...m, planned: 0, present: 0, absent: 0, attended: 0 };
    for (const s of selected) {
      const record = records.get(`${s.id}:${m.eleve_id}`);
      // An actual saved call takes precedence over a later membership date (e.g. a transfer).
      if (!record && m.joined_at && new Date(s.date_seance) < new Date(m.joined_at)) continue;
      if (!Number.isInteger(s.duree_minutes) || s.duree_minutes < 0) {
        errors.push(`Durée de séance invalide : ${parisDay(s.date_seance)}.`);
        continue;
      }
      row.planned += s.duree_minutes;
      if (new Date(s.date_seance) > now) continue;
      if (!record || typeof record.present !== "boolean") {
        missing.push(`${m.nom} ${m.prenom} — ${parisDay(s.date_seance)}`);
        continue;
      }
      if (!record.present) { row.absent++; continue; }
      row.present++;
      const { minutes } = readPresenceDuration(record.commentaire);
      if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > s.duree_minutes)) {
        errors.push(`Durée suivie invalide : ${m.nom} ${m.prenom} — ${parisDay(s.date_seance)}.`);
        continue;
      }
      row.attended += minutes ?? s.duree_minutes;
      // Do not guess a duration from an unstructured historical observation.
      if (minutes === null && /partiel|retard|départ|depart|sorti|quitt/i.test(record.commentaire ?? "")) {
        errors.push(`Durée suivie à préciser dans l'appel : ${m.nom} ${m.prenom} — ${parisDay(s.date_seance)}.`);
      }
    }
    return row;
  }).sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
  return { rows, missing, errors: [...new Set(errors)] };
}
export const attendanceHeaders = ["Nom", "Prénom", "Nombre d’heures prévues", "Séances en présence", "Séances en absence", "Heures de présence"];
export const attendanceCells = (row: SummaryRow) => [row.nom, row.prenom, formatHours(row.planned), String(row.present), String(row.absent), formatHours(row.attended)];
