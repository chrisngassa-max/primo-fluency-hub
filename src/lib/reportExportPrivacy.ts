/** Opaque labels for reports exported to external AI tools (no PII). */

export function studentExportLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const suffix = index >= 26 ? `_${Math.floor(index / 26) + 1}` : "";
  return `Apprenant_${letter}${suffix}`;
}

export function resolveStudentExportLabel(
  eleveId: string,
  eleves: Array<{ id: string }> | undefined,
): string {
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
