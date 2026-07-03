/** Labels for reports exported to external AI tools. */

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

/** Fetch students of a group with join fallback (RLS-safe). */
export async function fetchGroupStudentsForReports(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        in: (col: string, vals: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  },
  groupId: string,
): Promise<StudentProfile[]> {
  const { data: members, error: membersErr } = await supabase
    .from("group_members")
    .select("eleve_id")
    .eq("group_id", groupId);
  if (membersErr) throw membersErr;

  const ids = ((members ?? []) as { eleve_id: string }[]).map((m) => m.eleve_id);
  if (!ids.length) return [];

  const { data: joined, error: joinErr } = await supabase
    .from("group_members")
    .select("eleve_id, profiles!group_members_eleve_id_fkey(id, prenom, nom)")
    .eq("group_id", groupId);
  if (joinErr) throw joinErr;

  const fromJoin = ((joined ?? []) as { profiles: StudentProfile | null }[])
    .map((m) => m.profiles)
    .filter((p): p is StudentProfile => !!p?.id);

  if (fromJoin.length >= ids.length) {
    return fromJoin.sort((a, b) =>
      formatStudentRealName(a).localeCompare(formatStudentRealName(b), "fr"),
    );
  }

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .in("id", ids);
  if (profErr) throw profErr;

  return ((profiles ?? []) as StudentProfile[]).sort((a, b) =>
    formatStudentRealName(a).localeCompare(formatStudentRealName(b), "fr"),
  );
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
