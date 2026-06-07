type MetadataSource = {
  metadata?: unknown;
  contenu?: Record<string, unknown> | null;
  sous_competence?: string | null;
  aides_disponibles?: string[] | null;
  nombre_ecoutes_max?: number | null;
  transcription_verrouillee?: boolean | null;
  objectif_tcf?: string | null;
  type_differenciation?: string | null;
};

const allowedDifferentiation = new Set([
  "demarrage", "remediation", "consolidation", "approfondissement", "bonus",
]);

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const boundedInteger = (value: unknown, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function structuredExerciseMetadata(exercise: MetadataSource) {
  const contenu = exercise.contenu ?? {};
  const nested = contenu.metadata;
  const directMetadata = exercise.metadata;
  const metadata = directMetadata && typeof directMetadata === "object" && !Array.isArray(directMetadata)
    ? directMetadata as Record<string, unknown>
    : nested && typeof nested === "object" && !Array.isArray(nested)
      ? nested as Record<string, unknown>
      : {};
  const objectif = text(exercise.objectif_tcf ?? metadata.objectif_tcf ?? contenu.objectif_tcf)?.toLowerCase();
  const differentiation = text(
    exercise.type_differenciation ?? metadata.type_differenciation ?? contenu.type_differenciation
  )?.toLowerCase();

  return {
    metadata_code: text(metadata.code),
    metadata_skill: text(metadata.skill),
    sous_competence: text(exercise.sous_competence ?? metadata.sub_skill ?? contenu.sous_competence),
    duree_limite_secondes: boundedInteger(
      metadata.time_limit_seconds ?? contenu.time_limit_seconds ?? contenu.duree_estimee_secondes,
      1,
      7200
    ),
    aides_disponibles: stringArray(
      exercise.aides_disponibles ?? metadata.aides_disponibles ?? contenu.aides_disponibles
    ),
    nombre_ecoutes_max: boundedInteger(
      exercise.nombre_ecoutes_max ?? metadata.nombre_ecoutes_max ?? contenu.nombre_ecoutes_max,
      1,
      10
    ),
    transcription_verrouillee: Boolean(
      exercise.transcription_verrouillee
      ?? metadata.transcription_verrouillee
      ?? contenu.transcription_verrouillee
      ?? false
    ),
    objectif_tcf: objectif ?? null,
    type_differenciation:
      differentiation && allowedDifferentiation.has(differentiation) ? differentiation : null,
  };
}
