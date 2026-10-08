import { describe, expect, it } from "vitest";
import { buildAttendanceSummary, formatHours, readPresenceDuration, writePresenceDuration } from "../lib/attendanceSummary";
import { createAttendancePdf } from "../lib/attendanceSummaryPdf";

const member = { eleve_id: "a", nom: "Évrard", prenom: "Anaïs", joined_at: "2026-09-01T08:00:00Z" };
const sessions = [
  { id: "1", date_seance: "2026-10-01T08:00:00Z", duree_minutes: 180, statut: "terminee" },
  { id: "2", date_seance: "2026-10-02T08:00:00Z", duree_minutes: 90, statut: "terminee" },
  { id: "3", date_seance: "2026-10-03T08:00:00Z", duree_minutes: 120, statut: "terminee" },
  { id: "4", date_seance: "2026-10-04T08:00:00Z", duree_minutes: 180, statut: "annulee" },
  { id: "5", date_seance: "2026-10-08T08:00:00Z", duree_minutes: 180, statut: "planifiee" },
];
const presences = [
  { session_id: "1", eleve_id: "a", present: true, commentaire: writePresenceDuration("Départ anticipé", 150) },
  { session_id: "2", eleve_id: "a", present: false, commentaire: null },
  { session_id: "4", eleve_id: "a", present: true, commentaire: null },
  { session_id: "5", eleve_id: "a", present: false, commentaire: null },
];
const now = new Date("2026-10-07T12:00:00Z");
describe("bilan de présence", () => {
  it("reconciles recorded calls, partial attendance, cancellation, missing calls and future calls", () => {
    const result = buildAttendanceSummary([member], sessions, presences, undefined, now);
    expect(result.rows[0]).toMatchObject({ planned: 570, present: 1, absent: 1, attended: 150 });
    expect(result.missing).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(formatHours(750)).toBe("12 h 30");
  });
  it("uses inclusive Paris calendar days and excludes sessions before joining", () => {
    const result = buildAttendanceSummary([member], sessions, presences, { start: "2026-10-02", end: "2026-10-03" }, now);
    expect(result.rows[0]).toMatchObject({ planned: 210, present: 0, absent: 1, attended: 0 });
    const late = buildAttendanceSummary([{ ...member, joined_at: "2026-10-03T07:00:00Z" }], sessions, [], undefined, now);
    expect(late.rows[0].planned).toBe(300);
    const midnight = { ...sessions[0], date_seance: "2026-10-01T22:30:00Z" };
    expect(buildAttendanceSummary([member], [midnight], [], { start: "2026-10-02", end: "2026-10-02" }, now).rows[0].planned).toBe(180);
  });
  it("does not treat an unsaved call as an absence", () => {
    const result = buildAttendanceSummary([member], sessions, [], undefined, now);
    expect(result.rows[0]).toMatchObject({ present: 0, absent: 0, attended: 0 });
    expect(result.missing).toHaveLength(3);
  });
  it("preserves observations and validates partial duration including zero", () => {
    expect(readPresenceDuration(writePresenceDuration("Observation", 0))).toEqual({ comment: "Observation", minutes: 0 });
    expect(writePresenceDuration(writePresenceDuration("Observation", 90)!, 60)).toBe("Observation\n[CAPTCF:presence_minutes=60]");
    const invalid = [{ ...presences[0], commentaire: writePresenceDuration("", 200) }];
    expect(buildAttendanceSummary([member], sessions, invalid, undefined, now).errors).toHaveLength(1);
    expect(buildAttendanceSummary([member], sessions, [{ ...presences[0], commentaire: "Présence partielle" }], undefined, now).errors).toHaveLength(1);
  });
  it("uses the full scheduled duration for a normal presence and detects duplicate calls", () => {
    const call = { ...presences[0], commentaire: null };
    expect(buildAttendanceSummary([member], sessions, [call], undefined, now).rows[0].attended).toBe(180);
    expect(buildAttendanceSummary([member], sessions, [call, call], undefined, now).errors).toHaveLength(1);
  });
  it("keeps modest groups on one landscape A4 page and repeats headers for large groups", () => {
    const row = buildAttendanceSummary([member], sessions, presences, undefined, now).rows[0];
    const small = createAttendancePdf("Groupe A", "Préparation TCF IRN", "Du 01/10/2026 au 07/10/2026", Array.from({ length: 20 }, () => row));
    expect(small.getNumberOfPages()).toBe(1);
    expect(small.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
    expect(small.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
    const large = createAttendancePdf("Groupe A", "Préparation TCF IRN", "Ensemble de la formation", Array.from({ length: 60 }, () => row));
    expect(large.getNumberOfPages()).toBeGreaterThan(1);
    for (const page of large.internal.pages.slice(1)) expect(page.join("\n")).toContain("(Nom)");
  });
});
