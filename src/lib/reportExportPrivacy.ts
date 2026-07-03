/** Labels for reports exported to external AI tools. */

import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentProfile = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
};

/** Solo formateur mode: real names in exports. Set VITE_FORMATEUR_SHOW_REAL_NAMES=false for opaque IDs. */
export const FORMATEUR_SHOW_REAL_NAMES =
  import.meta.env.VITE_FORMATEUR_SHOW_REAL_NAMES !== "false";

export function studentExportLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const suffix = index >= 26 ? `_${Math.floor(index / 26) + 1}` : "";
  return `Apprenant_${letter}${suffix}`;
}

export function formatStudentRealName(profile: StudentProfile | undefined): string {
  if (!profile) return "Élève";
  const name = [profile.prenom, profile.nom].filter(Boolean).join(" ").trim();
  return name || "Élève";
}

export function resolveStudentExportLabel(
  eleveId: string,
  eleves: StudentProfile[] | undefined,
): string {
  if (FORMATEUR_SHOW_REAL_NAMES && eleves?.length) {
    const student = eleves.find((e) => e.id === eleveId);
    if (student) return formatStudentRealName(student);
  }
  if (!eleves?.length) return "Apprenant";
  const sorted = [...eleves].sort((a, b) => a.id.localeCompare(b.id));
  const idx = sorted.findIndex((e) => e.id === eleveId);
  return studentExportLabel(idx >= 0 ? idx : 0);
}

export type SupabaseQueryResult = { error?: { message: string } | null };

export function collectQueryErrors(
  results: SupabaseQueryResult[],
  labels: string[],
): string[] {
  const errors: string[] = [];
  results.forEach((res, i) => {
    if (res.error) {
      errors.push(`${labels[i]}: ${res.error.message}`);
    }
  });
  return errors;
}

type EdgeGroupMember = {
  group_id: string;
  eleve_id: string;
  eleve?: { id: string; prenom?: string | null; nom?: string | null } | null;
};

function sortStudents(students: StudentProfile[]): StudentProfile[] {
  return [...students].sort((a, b) =>
    formatStudentRealName(a).localeCompare(formatStudentRealName(b), "fr"),
  );
}

function profileFromMemberRow(row: {
  eleve_id: string;
  profiles?: StudentProfile | StudentProfile[] | null;
  eleve?: StudentProfile | null;
}): StudentProfile | null {
  const embedded = row.profiles ?? row.eleve;
  if (!embedded) return null;
  if (Array.isArray(embedded)) {
    const first = embedded.find((p) => p?.id);
    return first?.id ? first : null;
  }
  return embedded.id ? embedded : null;
}

async function fetchProfilesForEleveIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<StudentProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as StudentProfile[];
}

async function fetchProfilesViaGroupMembersJoin(
  supabase: SupabaseClient,
  groupId: string,
): Promise<StudentProfile[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("eleve_id, profiles!group_members_eleve_id_fkey(id, prenom, nom)")
    .eq("group_id", groupId);
  if (error) return [];

  const profiles: StudentProfile[] = [];
  for (const row of data ?? []) {
    const profile = profileFromMemberRow(row as { eleve_id: string; profiles?: StudentProfile | null });
    if (profile) profiles.push(profile);
  }
  return profiles;
}

async function fetchProfilesViaEdgeFunction(
  supabase: SupabaseClient,
  groupId: string,
): Promise<StudentProfile[]> {
  const { data, error } = await supabase.functions.invoke<{ members?: EdgeGroupMember[]; error?: string }>(
    "formateur-group-members",
  );
  if (error || data?.error) return [];

  return (data?.members ?? [])
    .filter((member) => member.group_id === groupId && member.eleve?.id)
    .map((member) => ({
      id: member.eleve!.id,
      prenom: member.eleve!.prenom,
      nom: member.eleve!.nom,
    }));
}

function mergeStudentProfiles(
  ids: string[],
  sources: StudentProfile[][],
): StudentProfile[] {
  const byId = new Map<string, StudentProfile>();
  for (const source of sources) {
    for (const profile of source) {
      if (profile?.id) byId.set(profile.id, profile);
    }
  }
  for (const id of ids) {
    if (!byId.has(id)) byId.set(id, { id, prenom: null, nom: null });
  }
  return sortStudents([...byId.values()]);
}

/** Fetch students of a group (RLS-safe with edge-function fallback). */
export async function fetchGroupStudentsForReports(
  supabase: SupabaseClient,
  groupId: string,
): Promise<StudentProfile[]> {
  const edgeProfiles = await fetchProfilesViaEdgeFunction(supabase, groupId);
  if (edgeProfiles.length > 0) {
    return sortStudents(edgeProfiles);
  }

  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("eleve_id")
    .eq("group_id", groupId);
  if (membersErr) throw membersErr;

  const ids = [...new Set(((members ?? []) as { eleve_id: string }[]).map((m) => m.eleve_id).filter(Boolean))];
  if (!ids.length) return [];

  const [directProfiles, joinProfiles] = await Promise.all([
    fetchProfilesForEleveIds(supabase, ids),
    fetchProfilesViaGroupMembersJoin(supabase, groupId),
  ]);

  return mergeStudentProfiles(ids, [directProfiles, joinProfiles]);
}

export const PERIODE_DEPUIS_DEBUT = "depuis_le_debut";

export function resolvePeriodBounds(
  periode: string,
  periodStart?: string | null,
): { dateDebut: Date; dateFin: Date; nbJours: number; label: string } {
  const dateFin = new Date();
  if (periode === PERIODE_DEPUIS_DEBUT) {
    const dateDebut = periodStart ? new Date(periodStart) : new Date(0);
    const nbJours = Math.max(
      1,
      Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return {
      dateDebut,
      dateFin,
      nbJours,
      label: periodStart
        ? `Depuis le ${dateDebut.toLocaleDateString("fr-FR")}`
        : "Depuis le début (toutes les données)",
    };
  }
  const nbJours = parseInt(periode, 10);
  const dateDebut = new Date();
  dateDebut.setDate(dateDebut.getDate() - nbJours);
  return {
    dateDebut,
    dateFin,
    nbJours,
    label: `${dateDebut.toLocaleDateString("fr-FR")} à ${dateFin.toLocaleDateString("fr-FR")}`,
  };
}
